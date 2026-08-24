import "server-only";
import { headers } from "next/headers";
import { getStripeClient } from "@/lib/stripe/client";
import { createServiceRoleClient } from "@/lib/supabase/serviceRole";
import { SESSION_HOLD_SECONDS } from "@/lib/checkout/session-hold";
import type { OrderResult } from "@/lib/services/orders/create-order";

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
    expires_at: Math.floor(Date.now() / 1000) + SESSION_HOLD_SECONDS,
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
