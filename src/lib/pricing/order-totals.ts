/**
 * The one place the service fee is defined and applied.
 *
 * Imported by both the server (create-order.ts, which is authoritative) and
 * the browser (the order summary, the submit button). That is deliberate:
 * the customer-facing figure and the figure Stripe charges are the same
 * arithmetic over the same rate, so they cannot drift into disagreeing.
 * The browser's copy is display-only — the server recomputes everything
 * from `product_variants.price` and never trusts a number the client sent.
 *
 * Deliberately NOT `server-only`, and deliberately not a row in `settings`:
 * a settings-backed rate would need a migration, a form field and plumbing
 * into the client for a number that changes approximately never, and the
 * client copy would then be one render behind the server's on the day it
 * did change. A constant is one line to edit and a deploy.
 */

/** Charged on the subtotal of every order, regardless of payment method. */
export const SERVICE_FEE_RATE = 0.05;

/**
 * Derived rather than written out, so the rate above stays the single
 * thing to edit.
 *
 * Via 10000 rather than the obvious `RATE * 100` as insurance for a future
 * rate, not for this one: at 0.05 both forms give exactly 5. But `RATE *
 * 100` is only exact for *some* rates — 0.07 gives 7.000000000000001 and
 * 0.29 gives 28.999999999999996 — so the naive form would render "Service
 * fee (7.000000000000001%)" the day someone bumps the rate to 7%. Rounding
 * through 10000 is correct for every rate, so the trap is closed before
 * anyone can walk into it.
 */
export const SERVICE_FEE_PERCENT = Math.round(SERVICE_FEE_RATE * 10000) / 100;

/**
 * What the customer reads on anything rendering a *stored* order: the
 * Stripe line item, the receipt email, the confirmation page, the admin
 * list.
 *
 * Deliberately carries no percentage. Only the dollar amount is persisted
 * on the order row, so a percentage here would be a deploy-time constant
 * printed beside a historical amount — change the rate to 7% and every
 * order taken at 5% starts reading "Service fee (7%) — $1.20" against a
 * $24.00 subtotal. Use SERVICE_FEE_RATE_LABEL only where the percentage is
 * true by construction, which is the live checkout screens.
 *
 * Keeping this string constant also does real work in
 * create-checkout-session.ts: it is the Stripe line item's product name,
 * and that call is sent with an idempotency key derived from the order id.
 * A name that moved with the rate would make retrying a pending order
 * across a rate change fail outright.
 *
 * "Service fee", not "processing fee" or "card fee". A fee described as
 * covering payment processing is a card surcharge, which in Canada is
 * capped at 2.4% by Visa/Mastercard network rules and prohibited outright
 * in Quebec. A flat fee applied to every order regardless of how it is
 * paid for is part of the price instead. The wording is load-bearing.
 */
export const SERVICE_FEE_LABEL = "Service fee";

/**
 * The same label with the rate named, for the live checkout surfaces only
 * — the order summary and the cart drawer.
 *
 * Safe there and nowhere else: those screens price a cart that has not been
 * stored yet, so the rate they quote is by definition the rate about to be
 * charged. The percentage is what shows the figure was calculated rather
 * than invented, which is worth having at the point of commitment.
 */
export const SERVICE_FEE_RATE_LABEL = `Service fee (${SERVICE_FEE_PERCENT}%)`;

export interface OrderTotals {
  subtotalCents: number;
  feeCents: number;
  totalCents: number;
}

/** Dollars to integer cents. */
export function toCents(amount: number): number {
  return Math.round(amount * 100);
}

/** Integer cents back to the dollars figure the NUMERIC(10,2) columns hold. */
export function fromCents(cents: number): number {
  return cents / 100;
}

/**
 * Everything here is integer cents, which is the whole point.
 *
 * Stripe is charged in cents (`unit_amount`), so computing the fee in
 * dollars and converting afterwards gives the rounding two chances to
 * disagree — a total the customer approved that is a penny off the amount
 * Stripe actually takes. Rounding happens exactly once, on the fee, and
 * the total is then a sum of integers.
 *
 * Half-up (`Math.round`) rather than floor: it is the convention, and the
 * most it can favour the business by is half a cent per order.
 */
export function calculateOrderTotals(subtotalCents: number): OrderTotals {
  const feeCents = Math.round(subtotalCents * SERVICE_FEE_RATE);
  return {
    subtotalCents,
    feeCents,
    totalCents: subtotalCents + feeCents,
  };
}

/**
 * The subtotal in cents, converting each unit price before multiplying.
 *
 * Matches how create-checkout-session.ts builds its Stripe line items
 * (`Math.round(unitPrice * 100)` per item, times quantity) rather than
 * summing dollars and converting at the end. Same inputs, same order of
 * operations, so the stored subtotal and the sum of what Stripe is told
 * to charge are identical by construction.
 */
export function subtotalCentsOf(
  items: readonly { unitPrice: number; quantity: number }[],
): number {
  return items.reduce(
    (sum, item) => sum + toCents(item.unitPrice) * item.quantity,
    0,
  );
}
