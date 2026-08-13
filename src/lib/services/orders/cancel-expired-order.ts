import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/serviceRole";

/**
 * Called from the Stripe webhook on checkout.session.expired. Frees the
 * pickup-capacity slot an abandoned checkout was holding (see
 * create-checkout-session.ts) by cancelling the order it never paid for.
 * Guarded on payment_status so a session that expires after somehow
 * already being paid (a very late webhook race) can't cancel a paid order.
 */
export async function cancelExpiredOrder(orderId: string): Promise<void> {
  const supabase = createServiceRoleClient();
  const { error } = await supabase
    .from("orders")
    .update({ status: "Cancelled" })
    .eq("id", orderId)
    .eq("payment_status", "unpaid");

  if (error) {
    throw new Error(`Failed to cancel expired order ${orderId}: ${error.message}`);
  }
}
