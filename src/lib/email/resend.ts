import "server-only";
import { Resend } from "resend";
import { formatPrice } from "@/lib/utils";
import type { OrderResult } from "@/lib/services/orders/create-order";

const FROM_EMAIL = "Your Neighbour <onboarding@resend.dev>";

function formatItemsList(items: OrderResult["items"]): string {
  return items
    .map(
      (item) =>
        `${item.quantity} x ${item.productName} — ${formatPrice(item.unitPrice * item.quantity)}`,
    )
    .join("\n");
}

/**
 * Fires both the customer receipt and the owner alert.
 *
 * Awaited from markOrderPaid() on the Stripe webhook path, under the
 * `notified_at` lease that makes it exactly-once across redeliveries.
 * Rejecting here is meaningful, not incidental: it releases that lease and
 * returns a 500 so Stripe redelivers the event and the send is retried.
 * Swallowing the error would strand a paid order with no notification —
 * which is exactly the bug 007_order_notification_lease.sql fixed.
 */
export async function sendOrderNotifications(
  order: OrderResult,
  ownerEmail: string,
  businessName: string,
): Promise<void> {
  const resend = new Resend(process.env.RESEND_API_KEY);
  const itemsList = formatItemsList(order.items);
  const firstName = order.customerName.split(" ")[0];

  await Promise.all([
    resend.emails.send({
      from: FROM_EMAIL,
      to: order.customerEmail,
      subject: `Your ${businessName} order is confirmed`,
      text: `Hi ${firstName},

Thanks for your order! Here's your receipt:

${itemsList}

Total: ${formatPrice(order.total)}

Pickup: ${order.pickupDate} at ${order.pickupTime}
${order.notes ? `\nYour notes: ${order.notes}\n` : ""}
See you soon!
${businessName}`,
    }),
    resend.emails.send({
      from: FROM_EMAIL,
      to: ownerEmail,
      subject: `New order from ${order.customerName} — pickup ${order.pickupDate}`,
      text: `New order received.

Customer: ${order.customerName}
Email: ${order.customerEmail}
Phone: ${order.customerPhone}

Pickup: ${order.pickupDate} at ${order.pickupTime}

Items to bake:
${itemsList}

Total: ${formatPrice(order.total)}${order.notes ? `\n\nCustomer notes: ${order.notes}` : ""}`,
    }),
  ]);
}

/**
 * Sent when a delayed payment method (bank debit and friends) reports back
 * days later that it failed. The customer completed checkout and reasonably
 * believes the order is placed — without this they'd simply never hear
 * anything again, and would turn up on pickup day to nothing.
 *
 * Customer-only on purpose: a payment that never landed isn't an order, and
 * the owner alert is meant to be a bake list, not a feed of non-events.
 */
// Parameter order matches sendOrderNotifications above deliberately: both
// take two bare strings, so opposite orders would compile fine and simply
// send the wrong thing.
export async function sendPaymentFailedNotification(
  order: OrderResult,
  contactEmail: string,
  businessName: string,
): Promise<void> {
  const resend = new Resend(process.env.RESEND_API_KEY);
  const firstName = order.customerName.split(" ")[0];

  await resend.emails.send({
    from: FROM_EMAIL,
    to: order.customerEmail,
    subject: `Your ${businessName} order couldn't be completed`,
    text: `Hi ${firstName},

Unfortunately your payment didn't go through, so we've had to release your
pickup slot for ${order.pickupDate} at ${order.pickupTime}.

You have not been charged. If you'd still like these items, you're very
welcome to place the order again:

${formatItemsList(order.items)}

Total: ${formatPrice(order.total)}

If you think this is a mistake, just reply to this email${contactEmail ? ` or reach us at ${contactEmail}` : ""} and we'll help sort it out.

${businessName}`,
  });
}
