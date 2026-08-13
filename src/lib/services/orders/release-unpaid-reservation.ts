import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/serviceRole";

/**
 * Best-effort cleanup for when Stripe Checkout Session creation itself
 * fails (network/API error) right after an order is reserved. In that
 * case no Stripe session — and so no checkout.session.expired webhook —
 * will ever exist to free the pickup-capacity slot the order is holding,
 * so this releases it immediately instead.
 *
 * Guarded on stripe_checkout_session_id IS NULL: a session that *was*
 * created (the customer is possibly still looking at a valid Stripe
 * Checkout tab) must never get cancelled out from under them just because
 * a later retry's session-creation call failed.
 */
export async function releaseUnstartedReservation(orderId: string): Promise<void> {
  const supabase = createServiceRoleClient();
  const { error } = await supabase
    .from("orders")
    .update({ status: "Cancelled" })
    .eq("id", orderId)
    .eq("payment_status", "unpaid")
    .is("stripe_checkout_session_id", null);

  if (error) {
    // Best-effort: log and move on rather than masking the checkout-session
    // error that triggered this cleanup in the first place.
    console.error(`Failed to release reservation for order ${orderId}:`, error);
  }
}
