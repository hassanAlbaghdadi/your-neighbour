import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/serviceRole";
import { getSettings } from "@/lib/services/settings/get-settings";
import { getOrderById } from "@/lib/services/orders/get-order";
import { sendOrderNotifications } from "@/lib/email/resend";

/**
 * Called from the Stripe webhook on checkout.session.completed. The
 * unpaid -> paid transition is conditioned on the current row still being
 * unpaid, so a retried webhook delivery (Stripe resends on anything but a
 * 2xx) can't send duplicate confirmation emails.
 */
export async function markOrderPaid(orderId: string): Promise<void> {
  const supabase = createServiceRoleClient();

  const { data: updated, error } = await supabase
    .from("orders")
    .update({ payment_status: "paid" })
    .eq("id", orderId)
    .eq("payment_status", "unpaid")
    .select("id")
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to mark order ${orderId} as paid: ${error.message}`);
  }
  if (!updated) return;

  const [order, settings] = await Promise.all([
    getOrderById(orderId),
    getSettings(),
  ]);
  if (!order) return;

  await sendOrderNotifications(order, settings.contactEmail, settings.businessName);
}
