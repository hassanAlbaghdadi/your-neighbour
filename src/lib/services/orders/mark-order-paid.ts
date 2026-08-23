import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/serviceRole";
import { sendCustomerReceipt, sendOwnerAlert } from "@/lib/email/resend";
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

  await notifyOnce(orderId, async (order, settings) => {
    // allSettled, not all: these used to share one Promise.all, so a
    // failure on either discarded both — and the customer receipt is the
    // one that fails, because it goes to an arbitrary address. That took
    // the bake list down with it on every order. Both are attempted
    // unconditionally now.
    const [owner, customer] = await Promise.allSettled([
      sendOwnerAlert(order, settings),
      sendCustomerReceipt(order, settings),
    ]);

    if (customer.status === "rejected") {
      // Logged, not rethrown, and the asymmetry is deliberate. Rethrowing
      // would release the lease and have Stripe redeliver, which re-sends
      // the owner alert that already succeeded — so a permanently failing
      // receipt (an unverified sending domain, a dead customer address)
      // would mail the baker the same order over and over for as long as
      // Stripe retries. A lost receipt is recoverable: the customer has
      // the confirmation page, and the order is safely on the books.
      console.error(
        `Customer receipt failed for order ${order.id}:`,
        customer.reason,
      );
    }

    if (owner.status === "rejected") {
      // This one does rethrow. Losing the bake list means an order that
      // has been paid for never gets made, so it's worth a duplicate
      // receipt on the retry to get another attempt at it.
      throw owner.reason;
    }
  });
}
