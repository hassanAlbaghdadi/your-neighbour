import "server-only";
import { Resend } from "resend";
import { formatPrice } from "@/lib/utils";
import { SERVICE_FEE_LABEL } from "@/lib/pricing/order-totals";
import type { OrderResult } from "@/lib/services/orders/create-order";
import type { StoreSettings } from "@/lib/services/settings/get-settings";
import { formatPickupDate, formatPickupTime } from "@/lib/time";

/**
 * Resend's shared sandbox sender. It requires no domain verification,
 * which is why it was hardcoded here originally — and it delivers *only*
 * to the address the Resend account itself is registered under. Every
 * customer receipt, which by definition goes somewhere else, is rejected
 * before it leaves Resend.
 *
 * Kept solely as a local-development fallback, where the only recipient is
 * whoever owns the Resend account anyway. Production must set
 * RESEND_FROM_EMAIL to an address on a domain verified at
 * https://resend.com/domains — a domain the business actually controls
 * DNS for, since verification means publishing SPF/DKIM records under it.
 * gmail.com and vercel.app cannot be verified for that reason.
 */
const SANDBOX_FROM_EMAIL = "Your Neighbour <onboarding@resend.dev>";

/**
 * Read per-send rather than at module load: on Vercel the module is
 * evaluated once and reused across invocations, so a hoisted constant
 * would pin whatever the env held at cold start and ignore an env var
 * corrected in the dashboard until the next deploy.
 */
function fromEmail(): string {
  const configured = process.env.RESEND_FROM_EMAIL?.trim();
  if (configured) return configured;

  // Loud in production rather than silently falling back. The fallback
  // cannot deliver to a customer, and failing here — before the send —
  // surfaces the misconfiguration in the webhook logs instead of leaving
  // a paid order with a receipt that was never going to arrive. The
  // notification lease releases on the throw, so Stripe's redelivery
  // picks the send back up cleanly once the env var is set.
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "RESEND_FROM_EMAIL is not set. The sandbox sender (onboarding@resend.dev) " +
        "only delivers to the Resend account's own address, so customer receipts " +
        "would fail silently. Verify a domain at https://resend.com/domains and " +
        "set RESEND_FROM_EMAIL to an address on it.",
    );
  }

  return SANDBOX_FROM_EMAIL;
}

function formatItemsList(items: OrderResult["items"]): string {
  return items
    .map(
      (item) =>
        `${item.quantity} x ${item.productName} — ${formatPrice(item.unitPrice * item.quantity)}`,
    )
    .join("\n");
}

/**
 * The money, itemised the same way checkout itemised it.
 *
 * A receipt that jumps straight to a total the customer can't reconcile
 * against the prices they picked is the one that generates the "why was I
 * charged more than I ordered" email — so the fee is named here in the
 * same words it was named in at checkout, not folded silently into the
 * total.
 *
 * Tested `> 0` rather than `<= 0`, so anything that isn't a real positive
 * fee falls through to the plain Total. The polarity is the whole point:
 * `undefined <= 0` and `NaN <= 0` are both false, so the inverted form
 * would take the itemised branch on a malformed order and mail a customer
 * a receipt reading "Service fee: $NaN". A missing fee line is recoverable;
 * that is not. Every other render site guards the same direction.
 */
function formatTotals(order: OrderResult): string {
  if (order.serviceFee > 0) {
    return `Subtotal: ${formatPrice(order.subtotal)}
${SERVICE_FEE_LABEL}: ${formatPrice(order.serviceFee)}
Total: ${formatPrice(order.total)}`;
  }
  return `Total: ${formatPrice(order.total)}`;
}

/**
 * The customer's receipt.
 *
 * Split from the owner alert below, which used to share a single
 * Promise.all with it. The two have different recipients and so different
 * failure modes — the owner address is one fixed, known-good address,
 * while the customer's is whatever they typed at checkout — and chaining
 * them meant a failure on either one discarded both. See markOrderPaid()
 * for how the two are now sequenced and which one is allowed to fail.
 */
export async function sendCustomerReceipt(
  order: OrderResult,
  settings: StoreSettings,
): Promise<void> {
  const { businessName, contactEmail, pickupAddress } = settings;
  const resend = new Resend(process.env.RESEND_API_KEY);
  const firstName = order.customerName.split(" ")[0];

  await resend.emails.send({
    from: fromEmail(),
    // Without this, a reply lands on the sending address itself. Sending
    // runs from a dedicated subdomain (RESEND_FROM_EMAIL) so that its SPF
    // and DKIM stay isolated from the root domain's own mail — which means
    // that subdomain carries only the records Resend needs to *send*, and
    // has no inbox behind it to receive. contactEmail is the one address
    // the rest of the app already treats as "how to reach the business"
    // (checkout-form.tsx, the confirmation page), so reusing it here means
    // repointing replies is a settings change, not a code change.
    ...(contactEmail && { replyTo: contactEmail }),
    to: order.customerEmail,
    subject: `Your ${businessName} order is confirmed`,
    text: `Hi ${firstName},

Thanks for your order! Here's your receipt:

${formatItemsList(order.items)}

${formatTotals(order)}

Pickup: ${formatPickupDate(order.pickupDate)} at ${formatPickupTime(order.pickupTime)}${
      pickupAddress ? `\nWhere: ${pickupAddress}` : ""
    }
${order.notes ? `\nYour notes: ${order.notes}\n` : ""}
See you soon!
${businessName}`,
  });
}

/**
 * The owner's bake list. This is the email the business cannot run
 * without: losing it means an order that has been paid for never gets
 * baked, which is the failure 007_order_notification_lease.sql exists to
 * prevent.
 */
export async function sendOwnerAlert(
  order: OrderResult,
  settings: StoreSettings,
): Promise<void> {
  const ownerEmail = settings.contactEmail;
  const resend = new Resend(process.env.RESEND_API_KEY);

  await resend.emails.send({
    from: fromEmail(),
    // Not load-bearing the way the customer-facing sends are — nobody
    // else reads this — but a reply here (a note to self, forwarding to a
    // co-baker) should land in the same inbox as everything else rather
    // than the sending subdomain's void.
    replyTo: ownerEmail,
    to: ownerEmail,
    subject: `New order from ${order.customerName} — pickup ${formatPickupDate(order.pickupDate)}`,
    text: `New order received.

Customer: ${order.customerName}
Email: ${order.customerEmail}
Phone: ${order.customerPhone}

Pickup: ${formatPickupDate(order.pickupDate)} at ${formatPickupTime(order.pickupTime)}

Items to bake:
${formatItemsList(order.items)}

${formatTotals(order)}${order.notes ? `\n\nCustomer notes: ${order.notes}` : ""}`,
  });
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
// All three senders take (order, settings) rather than a list of bare
// strings. An earlier signature passed businessName and contactEmail
// positionally, which meant two same-typed arguments whose opposite order
// compiled fine and simply mailed the wrong thing.
export async function sendPaymentFailedNotification(
  order: OrderResult,
  settings: StoreSettings,
): Promise<void> {
  const { businessName, contactEmail } = settings;
  const resend = new Resend(process.env.RESEND_API_KEY);
  const firstName = order.customerName.split(" ")[0];

  await resend.emails.send({
    from: fromEmail(),
    // The copy below promises "just reply to this email" — this is what
    // makes that true, same reasoning as sendCustomerReceipt above.
    ...(contactEmail && { replyTo: contactEmail }),
    to: order.customerEmail,
    subject: `Your ${businessName} order couldn't be completed`,
    text: `Hi ${firstName},

Unfortunately your payment didn't go through, so we've had to release your
pickup slot for ${formatPickupDate(order.pickupDate)} at ${formatPickupTime(order.pickupTime)}.

You have not been charged. If you'd still like these items, you're very
welcome to place the order again:

${formatItemsList(order.items)}

${formatTotals(order)}

If you think this is a mistake, just reply to this email${contactEmail ? ` or reach us at ${contactEmail}` : ""} and we'll help sort it out.

${businessName}`,
  });
}
