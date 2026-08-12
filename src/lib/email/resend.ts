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
 * Fires both the customer receipt and the owner alert. Called
 * non-blocking (fire-and-forget with a .catch) from create-order.ts —
 * a failure here must never affect the checkout outcome.
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
