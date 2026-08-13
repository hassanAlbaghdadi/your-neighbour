import "server-only";
import { headers } from "next/headers";
import { getStripeClient } from "@/lib/stripe/client";
import { createServiceRoleClient } from "@/lib/supabase/serviceRole";
import type { OrderResult } from "@/lib/services/orders/create-order";

// How long a pending order can hold its pickup-capacity slot before the
// Stripe session expires and the webhook frees it again (see
// cancel-expired-order.ts). Kept short — same-week pickup orders don't
// need a 24h-default hold on a slot someone else might want.
const SESSION_EXPIRY_SECONDS = 60 * 60;

async function getBaseUrl(): Promise<string> {
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
        currency: "usd",
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
