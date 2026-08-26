import { describe, it, expect } from "vitest";
import {
  SERVICE_FEE_LABEL,
  SERVICE_FEE_PERCENT,
  SERVICE_FEE_RATE,
  SERVICE_FEE_RATE_LABEL,
  calculateOrderTotals,
  fromCents,
  subtotalCentsOf,
  toCents,
} from "./order-totals";

describe("SERVICE_FEE_PERCENT", () => {
  it("renders as a clean integer at the current rate", () => {
    expect(SERVICE_FEE_PERCENT).toBe(5);
    expect(SERVICE_FEE_RATE_LABEL).toBe("Service fee (5%)");
  });

  it("stays clean at rates where the naive conversion does not", () => {
    // The reason SERVICE_FEE_PERCENT rounds through 10000 instead of just
    // multiplying by 100. Today's 0.05 does NOT need it — `0.05 * 100` is
    // exactly 5 — so asserting only the current rate would pass against
    // either form and guard nothing. These are the rates that would break:
    // 0.07 * 100 is 7.000000000000001, and 0.29 * 100 is 28.999999999999996.
    const percentOf = (rate: number) => Math.round(rate * 10000) / 100;

    expect(0.07 * 100).not.toBe(7);
    expect(percentOf(0.07)).toBe(7);

    expect(0.29 * 100).not.toBe(29);
    expect(percentOf(0.29)).toBe(29);
  });

  it("does not describe the fee in terms of payment processing", () => {
    // Load-bearing, not stylistic. A fee presented as covering card
    // processing is a surcharge, which Visa/Mastercard cap at 2.4% in
    // Canada and Quebec prohibits outright. A flat fee on every order
    // regardless of payment method is part of the price instead. If someone
    // renames this to "processing fee", the 5% rate stops being defensible.
    for (const label of [SERVICE_FEE_LABEL, SERVICE_FEE_RATE_LABEL]) {
      expect(label).not.toMatch(/processing|card|stripe|payment/i);
    }
  });

  it("keeps the rate out of the label used for stored orders", () => {
    // Only the dollar amount is persisted on the order row, so a percentage
    // on a receipt or an admin row would be a deploy-time constant printed
    // beside a historical amount — "Service fee (7%) — $1.20" on a $24.00
    // subtotal after a rate change. It is also the Stripe line item's
    // product name, which has to stay constant for the order-scoped
    // idempotency key to survive a retry across a rate change.
    expect(SERVICE_FEE_LABEL).toBe("Service fee");
    expect(SERVICE_FEE_LABEL).not.toMatch(/\d/);
  });
});

describe("calculateOrderTotals", () => {
  it("adds the fee to the subtotal", () => {
    expect(calculateOrderTotals(2400)).toEqual({
      subtotalCents: 2400,
      feeCents: 120,
      totalCents: 2520,
    });
  });

  it("always returns integers, so the total is an exact sum", () => {
    // The reason everything here is cents: Stripe charges in integer cents,
    // and a fee that arrives as 137.5 would round differently on the way to
    // the order row than on the way to the line item.
    for (const subtotalCents of [1, 7, 333, 999, 1050, 2750, 100_000]) {
      const { feeCents, totalCents } = calculateOrderTotals(subtotalCents);
      expect(Number.isInteger(feeCents)).toBe(true);
      expect(Number.isInteger(totalCents)).toBe(true);
      expect(totalCents).toBe(subtotalCents + feeCents);
    }
  });

  it("rounds a half-cent fee up", () => {
    // $27.50 -> 137.5 cents. Half-up is the convention, and the most it can
    // favour the business by is half a cent on an order.
    expect(calculateOrderTotals(2750).feeCents).toBe(138);
  });

  it("charges nothing on an empty subtotal", () => {
    // create-checkout-session.ts skips the fee line when it is zero, since
    // Stripe rejects a zero-amount line item in a payment-mode session.
    expect(calculateOrderTotals(0)).toEqual({
      subtotalCents: 0,
      feeCents: 0,
      totalCents: 0,
    });
  });

  it("stays exact across a range where dollar arithmetic would not", () => {
    // The float version of this (subtotal * 0.05, then * 100) drifts on
    // ordinary bakery prices — 0.1 + 0.2 arithmetic, one order in a few
    // hundred. Asserting the whole range catches a regression to dollars.
    for (let cents = 100; cents <= 20_000; cents += 25) {
      const { feeCents, totalCents } = calculateOrderTotals(cents);
      expect(feeCents).toBe(Math.round(cents * SERVICE_FEE_RATE));
      expect(totalCents - feeCents).toBe(cents);
    }
  });
});

describe("subtotalCentsOf", () => {
  it("converts each unit price before multiplying by quantity", () => {
    // Same order of operations as create-checkout-session.ts's line items
    // (round to cents per item, then multiply). Summing dollars and
    // converting at the end is what lets the stored subtotal and the sum of
    // what Stripe is told to charge disagree by a penny.
    expect(
      subtotalCentsOf([
        { unitPrice: 8, quantity: 2 },
        { unitPrice: 8, quantity: 1 },
      ]),
    ).toBe(2400);
  });

  it("handles prices that are not exactly representable", () => {
    // 3 x $4.10 is 12.299999999999999 in floating point.
    expect(subtotalCentsOf([{ unitPrice: 4.1, quantity: 3 }])).toBe(1230);
  });

  it("is zero for an empty cart", () => {
    expect(subtotalCentsOf([])).toBe(0);
  });
});

describe("toCents / fromCents", () => {
  it("round-trips the two-decimal values the NUMERIC(10,2) columns hold", () => {
    for (const amount of [0, 0.05, 1.2, 8, 16.8, 25.2, 1234.56]) {
      expect(fromCents(toCents(amount))).toBe(amount);
    }
  });

  it("is exact over the two-decimal values it is actually given", () => {
    // Every input reaches toCents from a NUMERIC(10,2) column or a variant
    // price, so two decimals is the whole domain. Asserting it across a
    // wide sweep is the guard that matters — a switch to Math.floor or to
    // `| 0` would fail here on the float-artifact values (0.07 * 100 is
    // 7.000000000000001, 4.1 * 3 is 12.299999999999999).
    for (let cents = 0; cents <= 5000; cents += 1) {
      expect(toCents(cents / 100)).toBe(cents);
    }
  });

  it("does not promise anything sensible for half-cent inputs", () => {
    // Documented, not endorsed: 0.145 is not exactly representable in
    // binary floating point — it is stored as slightly less — so it rounds
    // DOWN to 14 while 8.005 (stored as slightly more) rounds UP to 801.
    // Half-up on decimal half-cents is not a property this can have, and
    // nothing here needs it: no caller ever holds a three-decimal price.
    // If one ever does, it must round to cents before it gets here.
    expect(toCents(0.145)).toBe(14);
    expect(toCents(8.005)).toBe(801);
  });
});
