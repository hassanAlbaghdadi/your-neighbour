import "server-only";
import { headers } from "next/headers";
import { getStripeClient } from "@/lib/stripe/client";
import { createServiceRoleClient } from "@/lib/supabase/serviceRole";
import type { OrderResult } from "@/lib/services/orders/create-order";

// How long a pending order can hold its pickup-capacity slot before the
// Stripe session expires and the webhook frees it again (see
// cancel-expired-order.ts). Kept short — same-week pickup orders don't
// need a 24h-default hold on a slot someone else might want — and 30
// minutes is as short as it goes: Stripe rejects an `expires_at` less than
// 30 minutes or more than 24 hours from creation.
//
// Back here rather than in a shared module: it was briefly lifted out so
// checkout could quote the number to the customer, and that sentence is
// gone. Nothing outside this file needs it.
const SESSION_EXPIRY_SECONDS = 30 * 60;

async function getBaseUrl(): Promise<string> {
  // A configured origin wins over the request's own headers. These URLs
  // decide where Stripe sends a paying customer back to, and
  // `x-forwarded-host` is attacker-supplied in principle — Vercel
  // overwrites it in production, which narrows the exposure a lot, but
  // pinning the origin removes it rather than relying on the platform.
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) {
    return configured.replace(/\/+$/, "");
  }

  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  const protocol =
    headerList.get("x-forwarded-proto") ??
    (host?.startsWith("localhost") ? "http" : "https");
  return `${protocol}://${host}`;
}

/**
 * Creates a Stripe Checkout Session for an already-created (unpaid) order
 * and records the session id on it. The order itself is the source of
 * truth for capacity/idempotency — this just gets the customer to a page
 * that can pay for it.
 */
export async function createCheckoutSessionForOrder(
  order: OrderResult,
): Promise<string> {
  const baseUrl = await getBaseUrl();

  const session = await getStripeClient().checkout.sessions.create({
    mode: "payment",
    // Pinned to card rather than left for Stripe to manage from the
    // Dashboard's payment-method settings. Two things that decision buys:
    //
    // 1. Apple Pay and Google Pay ride on "card" automatically -- Stripe
    //    shows them as buttons above the card form whenever the customer's
    //    own browser/device supports a wallet, no separate type needed. So
    //    this doesn't trade wallets away; it's the documented fix when a
    //    wallet isn't rendering even though the account supports it
    //    (docs.stripe.com/testing/wallets, "Enable wallets for your
    //    integration"), because it stops depending on whatever the
    //    Dashboard's Dynamic Payment Methods toggle happens to be set to.
    // 2. It keeps the actual payment page to card + wallets only. Without
    //    this, any other method later switched on in the Dashboard for an
    //    unrelated reason (a BNPL option, a bank redirect, ...) would
    //    appear here too -- on a same-day local pickup order, those are
    //    friction, not choice.
    //
    // What this can't fix: a customer's own device or browser not
    // supporting a wallet (Safari never shows Google Pay; Chrome needs a
    // card saved to a signed-in Google account and "allow sites to check
    // for payment methods" turned on; neither wallet renders in a private/
    // incognito window). That's real device state, not something either
    // Stripe or this code can override.
    payment_method_types: ["card"],
    customer_email: order.customerEmail,
    client_reference_id: order.id,
    metadata: { order_id: order.id },
    line_items: order.items.map((item) => ({
      quantity: item.quantity,
      price_data: {
        currency: "cad",
        unit_amount: Math.round(item.unitPrice * 100),
        product_data: {
          name: item.variantLabel
            ? `${item.productName} — ${item.variantLabel}`
            : item.productName,
        },
      },
    })),
    success_url: `${baseUrl}/confirmation/${order.id}`,
    cancel_url: `${baseUrl}/checkout`,
    expires_at: Math.floor(Date.now() / 1000) + SESSION_EXPIRY_SECONDS,
  }, {
    // Keyed on the order, which is itself client-generated and stable
    // across resubmits, so a retried action returns the session that
    // already exists instead of leaving a second live one behind. That
    // matters beyond tidiness: two live sessions for one order means the
    // first one's `expired` webhook can fire while the customer is still
    // paying on the second.
    idempotencyKey: `checkout_session_${order.id}`,
  });

  if (!session.url) {
    throw new Error("Stripe did not return a checkout URL.");
  }

  const supabase = createServiceRoleClient();
  const { error } = await supabase
    .from("orders")
    .update({ stripe_checkout_session_id: session.id })
    .eq("id", order.id);
  if (error) {
    throw new Error(`Failed to record checkout session: ${error.message}`);
  }

  return session.url;
}
