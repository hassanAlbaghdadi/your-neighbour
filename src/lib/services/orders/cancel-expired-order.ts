import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/serviceRole";

/**
 * Called from the Stripe webhook on checkout.session.expired and
 * checkout.session.async_payment_failed. Frees the pickup-capacity slot an
 * abandoned checkout was holding (see create-checkout-session.ts) by
 * cancelling the order it never paid for.
 *
 * Guarded three ways:
 *  - payment_status must still be "unpaid", so a session that expires
 *    after somehow already being paid (a very late webhook race) can't
 *    cancel a paid order;
 *  - the order's recorded session must be the one that actually expired.
 *    Without this an older session could cancel an order the customer is
 *    still paying for on a newer one — which matters most for delayed
 *    payment methods, where payment_status legitimately stays "unpaid" for
 *    days after checkout completes, so the payment_status guard above
 *    wouldn't catch it. Session creation is idempotent per order now, so
 *    two live sessions should no longer happen; this makes the cancel path
 *    safe rather than trusting that.
 */
export async function cancelExpiredOrder(
  orderId: string,
  sessionId: string,
): Promise<boolean> {
  const supabase = createServiceRoleClient();
  const { data: cancelled, error } = await supabase
    .from("orders")
    .update({ status: "Cancelled" })
    .eq("id", orderId)
    .eq("payment_status", "unpaid")
    .eq("stripe_checkout_session_id", sessionId)
    .select("id")
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to cancel expired order ${orderId}: ${error.message}`);
  }

  // Reported back so the caller can tell a real cancellation from a
  // no-op — the payment-failed path only emails the customer when their
  // order was actually released, never when a guard above declined.
  return Boolean(cancelled);
}
