import "server-only";
import type Stripe from "stripe";
import { headers } from "next/headers";
import { getStripeClient } from "@/lib/stripe/client";
import { createServiceRoleClient } from "@/lib/supabase/serviceRole";
import { SERVICE_FEE_LABEL, toCents } from "@/lib/pricing/order-totals";
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
  const lineItems = buildLineItems(order);

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
    line_items: lineItems,
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

/**
 * The order's line items plus the service fee, as its own Stripe line.
 *
 * A separate line rather than spread across the item prices: Stripe's own
 * payment page then itemises it exactly the way the order summary did one
 * screen earlier, so the customer meets no number they haven't already
 * seen and agreed to. Checkout in `payment` mode doesn't let anyone edit
 * line items, so it can't be dropped on the way through.
 *
 * The fee is read off the stored order rather than recomputed from
 * SERVICE_FEE_RATE. That matters for more than tidiness: the session
 * create below is sent with an idempotency key derived from the order id,
 * and Stripe hard-errors when a key is reused with different parameters.
 * Recomputing here would make a resubmit after a rate change fail outright.
 *
 * Both halves of this line have to be rate-independent for that to hold,
 * which is why the name is SERVICE_FEE_LABEL and not the rate-bearing
 * SERVICE_FEE_RATE_LABEL. `unit_amount` comes from the order row and
 * `name` is a constant, so a retry across a rate change sends exactly the
 * parameters the first attempt did.
 */
function buildLineItems(
  order: OrderResult,
): Stripe.Checkout.SessionCreateParams.LineItem[] {
  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] =
    order.items.map((item) => ({
      quantity: item.quantity,
      price_data: {
        currency: "cad",
        unit_amount: toCents(item.unitPrice),
        product_data: {
          name: item.variantLabel
            ? `${item.productName} — ${item.variantLabel}`
            : item.productName,
        },
      },
    }));

  const feeCents = toCents(order.serviceFee);
  if (feeCents > 0) {
    lineItems.push({
      quantity: 1,
      price_data: {
        currency: "cad",
        unit_amount: feeCents,
        product_data: { name: SERVICE_FEE_LABEL },
      },
    });
  }

  // Nothing sends order.total to Stripe — the charge is implicitly the sum
  // of the lines above — so the two could drift apart with nothing to
  // notice. Failing here means a customer sees an error instead of being
  // charged an amount that doesn't match the one they approved, and it
  // fires in tests rather than in production.
  const chargedCents = lineItems.reduce(
    (sum, item) => sum + (item.price_data!.unit_amount ?? 0) * (item.quantity ?? 0),
    0,
  );
  if (chargedCents !== toCents(order.total)) {
    throw new Error(
      `Line items for order ${order.id} total ${chargedCents} cents but the ` +
        `order total is ${toCents(order.total)} cents. Refusing to charge a ` +
        `different amount than the customer was shown.`,
    );
  }

  return lineItems;
}
