import "server-only";
import { sendPaymentFailedNotification } from "@/lib/email/resend";
import { notifyOnce } from "@/lib/services/orders/notification-lease";

/**
 * Called from the Stripe webhook on checkout.session.async_payment_failed,
 * after the order has been cancelled.
 *
 * Only this event gets an email — not checkout.session.expired. An expired
 * session means the customer wandered off without paying and knows they
 * didn't order; mailing them would be unprompted noise. A failed async
 * payment is the opposite: they finished checkout, believe they've
 * ordered, and would otherwise hear nothing at all.
 *
 * Shares the notified_at lease with the success path, so an order gets one
 * outcome email either way and Stripe's redeliveries can't double it.
 */
export async function notifyPaymentFailed(orderId: string): Promise<void> {
  await notifyOnce(orderId, (order, settings) =>
    sendPaymentFailedNotification(
      order,
      settings.businessName,
      settings.contactEmail,
    ),
  );
}
