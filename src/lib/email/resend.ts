import "server-only";
import { Resend } from "resend";
import { formatPrice } from "@/lib/utils";
import { SERVICE_FEE_LABEL } from "@/lib/pricing/order-totals";
import type { OrderResult } from "@/lib/services/orders/create-order";
import type { StoreSettings } from "@/lib/services/settings/get-settings";
import { formatPickupDate, formatPickupTime } from "@/lib/time";
import { SITE_URL } from "@/lib/site";

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

// The 8-char id shown everywhere else a customer or the owner might need to
// reference an order — the confirmation page, the admin list. Emails use
// the same slice so "quote order #a1b2c3d4" on the confirmation page names
// something the receipt actually carries too.
function orderNumber(order: OrderResult): string {
  return order.id.slice(0, 8);
}

function formatItemsList(items: OrderResult["items"]): string {
  return items
    .map(
      (item) =>
        `${item.quantity} x ${item.productName}${item.variantLabel ? ` — ${item.variantLabel}` : ""} — ${formatPrice(item.unitPrice * item.quantity)}`,
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

// ---------------------------------------------------------------------------
// HTML rendering
//
// Every send below carries both `text` and `html`: `text` is what renders
// when a client can't or won't render HTML, `html` is what most inboxes
// actually show. One shared shell keeps the three templates looking like
// the same business sent them, without a templating dependency for three
// emails a week.
//
// Written as a complete, self-contained HTML document (own <head>, inline
// styles throughout) because an email client renders `html` as its own
// document, not injected into a host page — there is no outer stylesheet
// to inherit from, and several major clients (Gmail chief among them) strip
// a <style> block from <head> entirely. CSS custom properties are avoided
// for the same reason: Outlook's rendering engine doesn't support var(), so
// the brand tokens from globals.css are inlined here as literal hex values
// instead of shared with it.
// ---------------------------------------------------------------------------

const BRAND = {
  espresso900: "#2a211d",
  espresso700: "#40312c",
  cream50: "#fbf8f3",
  terracotta600: "#b35b37",
  muted: "#8a7d72",
  border: "#e5ded6",
} as const;

const FONT_SANS =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";
const FONT_SERIF = "Georgia,'Times New Roman',serif";

/**
 * Escapes the handful of characters that matter in HTML text content.
 *
 * Needed because, unlike everywhere else in the app, nothing here is JSX —
 * React escapes interpolated text automatically; a hand-built HTML string
 * does not. Applied to every value below that a customer or the owner
 * typed themselves (name, notes) or that comes from the admin-editable
 * settings table (business name, pickup address) — anything that isn't a
 * number or a value already produced by formatPrice/formatPickupDate.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function itemsTableHtml(items: OrderResult["items"]): string {
  const rows = items
    .map((item, index) => {
      const isLast = index === items.length - 1;
      const border = isLast ? "" : `border-bottom:1px solid ${BRAND.border};`;
      const label = item.variantLabel
        ? `${escapeHtml(item.productName)} <span style="color:${BRAND.muted};">— ${escapeHtml(item.variantLabel)}</span>`
        : escapeHtml(item.productName);
      return `<tr>
        <td style="padding:9px 0;${border}font-size:14px;color:${BRAND.espresso900};">${item.quantity} &times; ${label}</td>
        <td style="padding:9px 0;${border}font-size:14px;color:${BRAND.espresso900};text-align:right;white-space:nowrap;">${formatPrice(item.unitPrice * item.quantity)}</td>
      </tr>`;
    })
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${rows}</table>`;
}

function totalsTableHtml(order: OrderResult): string {
  const row = (label: string, value: string, strong = false) => `<tr>
    <td style="padding:${strong ? "10px" : "2px"} 0 2px;${strong ? `border-top:1px solid ${BRAND.border};` : ""}font-size:${strong ? "16px" : "14px"};font-weight:${strong ? "700" : "400"};color:${strong ? BRAND.espresso900 : BRAND.muted};">${label}</td>
    <td style="padding:${strong ? "10px" : "2px"} 0 2px;${strong ? `border-top:1px solid ${BRAND.border};` : ""}font-size:${strong ? "16px" : "14px"};font-weight:${strong ? "700" : "400"};color:${strong ? BRAND.espresso900 : BRAND.muted};text-align:right;">${value}</td>
  </tr>`;
  const rows =
    order.serviceFee > 0
      ? row("Subtotal", formatPrice(order.subtotal)) +
        row(SERVICE_FEE_LABEL, formatPrice(order.serviceFee)) +
        row("Total", formatPrice(order.total), true)
      : row("Total", formatPrice(order.total), true);
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-top:2px;">${rows}</table>`;
}

/** A muted, boxed callout — used for the pickup details and, when present, the customer's notes. */
function calloutHtml(label: string, lines: string[]): string {
  const body = lines
    .map(
      (line, i) =>
        `<div style="font-size:14px;color:${i === 0 ? BRAND.espresso900 : BRAND.espresso700};${i > 0 ? "margin-top:2px;" : ""}">${line}</div>`,
    )
    .join("");
  return `<div style="margin-top:20px;padding:14px 16px;background:${BRAND.cream50};border-radius:8px;">
    <div style="font-size:11px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:${BRAND.muted};margin-bottom:4px;">${label}</div>
    ${body}
  </div>`;
}

interface EmailShellOptions {
  businessName: string;
  /** Rendered as the body's opening line, in the brand serif, e.g. "Order confirmed". */
  heading: string;
  bodyHtml: string;
  /** Small print at the very bottom — order number, contact address. */
  footerHtml: string;
}

function emailShell({
  businessName,
  heading,
  bodyHtml,
  footerHtml,
}: EmailShellOptions): string {
  const safeBusinessName = escapeHtml(businessName);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${safeBusinessName}</title>
</head>
<body style="margin:0;padding:32px 16px;background:${BRAND.cream50};font-family:${FONT_SANS};">
  <div style="max-width:480px;margin:0 auto;background:#ffffff;border:1px solid ${BRAND.border};border-radius:12px;overflow:hidden;">
    <div style="background:${BRAND.espresso900};padding:22px 32px;text-align:center;">
      <img src="${SITE_URL}/brand/mark-white.png" width="28" height="28" alt="" style="vertical-align:middle;margin-right:8px;border:0;">
      <span style="font-family:${FONT_SERIF};font-size:19px;font-weight:600;color:${BRAND.cream50};letter-spacing:0.01em;vertical-align:middle;">${safeBusinessName}</span>
    </div>
    <div style="padding:28px 32px;">
      <h1 style="margin:0 0 18px;font-family:${FONT_SERIF};font-size:21px;font-weight:600;color:${BRAND.espresso900};">${heading}</h1>
      ${bodyHtml}
    </div>
    <div style="padding:16px 32px;border-top:1px solid ${BRAND.border};font-size:12px;line-height:1.6;color:${BRAND.muted};text-align:center;">
      ${footerHtml}
    </div>
  </div>
</body>
</html>`;
}

// ---------------------------------------------------------------------------

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
  const changeOrCancel = `Need to change or cancel? Just reply to this email${contactEmail ? ` or write to ${contactEmail}` : ""}.`;

  const pickupLines = [
    `${formatPickupDate(order.pickupDate)} at ${formatPickupTime(order.pickupTime)}`,
    ...(pickupAddress ? [escapeHtml(pickupAddress)] : []),
  ];

  const html = emailShell({
    businessName,
    heading: "Order confirmed",
    bodyHtml: `
      <p style="margin:0 0 4px;font-size:15px;color:${BRAND.espresso900};">Hi ${escapeHtml(firstName)}, thanks for your order — here&rsquo;s your receipt.</p>
      <p style="margin:0 0 20px;font-size:13px;color:${BRAND.muted};">Order #${orderNumber(order)}</p>
      ${itemsTableHtml(order.items)}
      ${totalsTableHtml(order)}
      ${calloutHtml("Pickup", pickupLines)}
      ${order.notes ? calloutHtml("Your notes", [escapeHtml(order.notes)]) : ""}
      <p style="margin:24px 0 0;font-size:13px;color:${BRAND.muted};">${changeOrCancel}</p>
    `,
    footerHtml: `See you soon!<br>${escapeHtml(businessName)}`,
  });

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
    subject: `${businessName} — your order is confirmed`,
    html,
    text: `Hi ${firstName},

Thanks for your order! Here's your receipt.

Order #${orderNumber(order)}

${formatItemsList(order.items)}

${formatTotals(order)}

Pickup: ${formatPickupDate(order.pickupDate)} at ${formatPickupTime(order.pickupTime)}${
      pickupAddress ? `\nWhere: ${pickupAddress}` : ""
    }
${order.notes ? `\nYour notes: ${order.notes}\n` : ""}
${changeOrCancel}

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

  const html = emailShell({
    businessName: settings.businessName,
    heading: "New order to bake",
    bodyHtml: `
      <p style="margin:0 0 20px;font-size:13px;color:${BRAND.muted};">Order #${orderNumber(order)}</p>
      ${calloutHtml("Customer", [
        escapeHtml(order.customerName),
        escapeHtml(order.customerEmail),
        escapeHtml(order.customerPhone),
      ])}
      ${calloutHtml("Pickup", [`${formatPickupDate(order.pickupDate)} at ${formatPickupTime(order.pickupTime)}`])}
      <div style="margin-top:20px;font-size:12px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:${BRAND.muted};margin-bottom:8px;">Items to bake</div>
      ${itemsTableHtml(order.items)}
      ${totalsTableHtml(order)}
      ${order.notes ? calloutHtml("Customer notes", [escapeHtml(order.notes)]) : ""}
    `,
    footerHtml: `${escapeHtml(settings.businessName)} · order notification`,
  });

  await resend.emails.send({
    from: fromEmail(),
    // Not load-bearing the way the customer-facing sends are — nobody
    // else reads this — but a reply here (a note to self, forwarding to a
    // co-baker) should land in the same inbox as everything else rather
    // than the sending subdomain's void.
    replyTo: ownerEmail,
    to: ownerEmail,
    subject: `New order from ${order.customerName} — pickup ${formatPickupDate(order.pickupDate)}`,
    html,
    text: `New order received.

Order #${orderNumber(order)}

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
  const helpLine = `If you think this is a mistake, just reply to this email${contactEmail ? ` or reach us at ${contactEmail}` : ""} and we'll help sort it out.`;

  const html = emailShell({
    businessName,
    heading: "Payment didn't go through",
    bodyHtml: `
      <p style="margin:0 0 4px;font-size:15px;color:${BRAND.espresso900};">Hi ${escapeHtml(firstName)},</p>
      <p style="margin:0 0 16px;font-size:14px;color:${BRAND.espresso700};">Unfortunately your payment didn&rsquo;t go through, so we&rsquo;ve had to release your pickup slot for ${formatPickupDate(order.pickupDate)} at ${formatPickupTime(order.pickupTime)}.</p>
      <p style="margin:0 0 20px;padding:10px 14px;background:${BRAND.cream50};border-radius:8px;font-size:14px;font-weight:600;color:${BRAND.espresso900};">You have not been charged.</p>
      <p style="margin:0 0 16px;font-size:14px;color:${BRAND.espresso700};">If you'd still like these items, you're very welcome to place the order again:</p>
      ${itemsTableHtml(order.items)}
      ${totalsTableHtml(order)}
      <p style="margin:24px 0 0;font-size:13px;color:${BRAND.muted};">${helpLine}</p>
    `,
    footerHtml: escapeHtml(businessName),
  });

  await resend.emails.send({
    from: fromEmail(),
    // The copy above promises "just reply to this email" — this is what
    // makes that true, same reasoning as sendCustomerReceipt above.
    ...(contactEmail && { replyTo: contactEmail }),
    to: order.customerEmail,
    subject: `${businessName} — your order couldn't be completed`,
    html,
    text: `Hi ${firstName},

Unfortunately your payment didn't go through, so we've had to release your
pickup slot for ${formatPickupDate(order.pickupDate)} at ${formatPickupTime(order.pickupTime)}.

You have not been charged. If you'd still like these items, you're very
welcome to place the order again:

${formatItemsList(order.items)}

${formatTotals(order)}

${helpLine}

${businessName}`,
  });
}
