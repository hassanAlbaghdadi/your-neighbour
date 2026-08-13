import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/serviceRole";
import { sendOrderNotifications } from "@/lib/email/resend";
import { notifyOnce } from "@/lib/services/orders/notification-lease";

/**
 * Called from the Stripe webhook on checkout.session.completed and
 * checkout.session.async_payment_succeeded.
 *
 * The payment flip and the notification are deliberately guarded
 * separately (see notification-lease.ts). Conditioning the emails on the
 * unpaid -> paid transition seems natural, but it silently loses them: a
 * send that fails after the flip has committed can never be retried,
 * because the retry no longer matches `unpaid`. The flip is idempotent on
 * payment_status, the send is idempotent on notified_at, and neither one
 * gates the other.
 */
export async function markOrderPaid(orderId: string): Promise<void> {
  const supabase = createServiceRoleClient();

  // Still conditional on `unpaid` — this must not clobber a payment_status
  // that has since moved on to something else — but the result is
  // deliberately not branched on. A redelivery that finds the order
  // already paid still falls through to the notification below, which is
  // the whole point: the notification gets its own retry.
  const { error } = await supabase
    .from("orders")
    .update({ payment_status: "paid" })
    .eq("id", orderId)
    .eq("payment_status", "unpaid");

  if (error) {
    throw new Error(`Failed to mark order ${orderId} as paid: ${error.message}`);
  }

  await notifyOnce(orderId, (order, settings) =>
    sendOrderNotifications(order, settings.contactEmail, settings.businessName),
  );
}
