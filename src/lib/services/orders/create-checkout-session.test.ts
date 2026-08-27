import { describe, it, expect, vi, beforeEach } from "vitest";
import type { OrderResult } from "@/lib/services/orders/create-order";

const createSessionMock = vi.fn();
const fromMock = vi.fn();
const updateMock = vi.fn();
const eqMock = vi.fn();

vi.mock("@/lib/stripe/client", () => ({
  getStripeClient: () => ({
    checkout: { sessions: { create: (...args: unknown[]) => createSessionMock(...args) } },
  }),
}));

vi.mock("@/lib/supabase/serviceRole", () => ({
  createServiceRoleClient: () => ({ from: fromMock }),
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => ({
    get: (key: string) =>
      ({ host: "yourneighbour.example", "x-forwarded-proto": "https" })[key] ?? null,
  })),
}));

const { createCheckoutSessionForOrder } = await import("./create-checkout-session");

const order: OrderResult = {
  id: "11111111-1111-4111-8111-111111111111",
  createdAt: "2026-08-18T14:00:00.000Z",
  customerName: "Jane Doe",
  customerEmail: "jane@example.com",
  customerPhone: "5551234567",
  pickupDate: "2026-08-20",
  pickupTime: "10:00",
  notes: null,
  subtotal: 24,
  serviceFee: 1.2,
  total: 25.2,
  status: "Pending",
  paymentStatus: "unpaid",
  items: [
    { productName: "Sourdough Loaf", variantLabel: "Large", quantity: 2, unitPrice: 8 },
    { productName: "Croissant", variantLabel: null, quantity: 1, unitPrice: 8 },
  ],
};

describe("createCheckoutSessionForOrder", () => {
  beforeEach(() => {
    createSessionMock.mockReset();
    fromMock.mockReset();
    updateMock.mockReset();
    eqMock.mockReset();
    fromMock.mockReturnValue({ update: updateMock });
    updateMock.mockReturnValue({ eq: eqMock });
    eqMock.mockResolvedValue({ error: null });
  });

  it("builds one Stripe line item per order item, plus the fee, and returns the session url", async () => {
    createSessionMock.mockResolvedValue({
      id: "cs_test_123",
      url: "https://checkout.stripe.com/cs_test_123",
    });

    const url = await createCheckoutSessionForOrder(order);

    expect(url).toBe("https://checkout.stripe.com/cs_test_123");
    expect(createSessionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "payment",
        payment_method_types: ["card"],
        customer_email: order.customerEmail,
        client_reference_id: order.id,
        metadata: { order_id: order.id },
        success_url: `https://yourneighbour.example/confirmation/${order.id}`,
        cancel_url: "https://yourneighbour.example/checkout",
        line_items: [
          expect.objectContaining({
            quantity: 2,
            price_data: expect.objectContaining({
              currency: "cad",
              unit_amount: 800,
              product_data: { name: "Sourdough Loaf — Large" },
            }),
          }),
          expect.objectContaining({
            quantity: 1,
            price_data: expect.objectContaining({
              unit_amount: 800,
              product_data: { name: "Croissant" },
            }),
          }),
          // Its own line rather than spread across the item prices, so
          // Stripe's payment page itemises it exactly the way the order
          // summary did one screen earlier. 5% of $24.00 = $1.20.
          //
          // Named without the rate on purpose: this call carries an
          // idempotency key derived from the order id, and Stripe rejects a
          // reused key whose parameters have changed. A product name that
          // moved with the rate would break the retry of any order still
          // pending across a rate change.
          expect.objectContaining({
            quantity: 1,
            price_data: expect.objectContaining({
              currency: "cad",
              unit_amount: 120,
              product_data: { name: "Service fee" },
            }),
          }),
        ],
      }),
      // Keyed on the order id, which is stable across resubmits, so a
      // retry returns the existing session instead of leaving a second
      // live one behind for the same order.
      { idempotencyKey: `checkout_session_${order.id}` },
    );
  });

  // Regression: `expires_at` used to be computed from Date.now(), which moved
  // between attempts while the idempotency key stayed fixed. Stripe rejects a
  // reused key whose parameters differ, so every retry of a checkout failed
  // permanently -- the exact opposite of what the key is there to do. Two
  // calls for the same order must send byte-identical parameters.
  it("sends the same expires_at on every attempt for one order", async () => {
    createSessionMock.mockResolvedValue({
      id: "cs_test_retry",
      url: "https://checkout.stripe.test/cs_test_retry",
    });

    await createCheckoutSessionForOrder(order);
    const first = createSessionMock.mock.calls[0][0].expires_at;

    await createCheckoutSessionForOrder(order);
    const second = createSessionMock.mock.calls[1][0].expires_at;

    expect(second).toBe(first);
    expect(first).toBe(
      Math.floor(new Date(order.createdAt).getTime() / 1000) + 35 * 60,
    );
    // Both attempts reuse the one key, which is only safe because of the above.
    expect(createSessionMock.mock.calls[0][1]).toEqual(
      createSessionMock.mock.calls[1][1],
    );
  });

  it("records the session id on the order row", async () => {
    createSessionMock.mockResolvedValue({
      id: "cs_test_123",
      url: "https://checkout.stripe.com/cs_test_123",
    });

    await createCheckoutSessionForOrder(order);

    expect(fromMock).toHaveBeenCalledWith("orders");
    expect(updateMock).toHaveBeenCalledWith({ stripe_checkout_session_id: "cs_test_123" });
    expect(eqMock).toHaveBeenCalledWith("id", order.id);
  });

  it("pins payment methods to card rather than leaving them to the Dashboard", async () => {
    // Apple Pay and Google Pay ride on "card" automatically -- Stripe shows
    // them as buttons whenever the customer's device supports a wallet, no
    // separate type needed. Passing this explicitly is the documented fix
    // for a wallet not rendering even though the account supports it
    // (Dynamic Payment Methods otherwise decides this from Dashboard
    // config, which nothing here can see or test against), and it keeps
    // the actual payment page to card + wallets even if something else
    // gets switched on in the Dashboard later.
    createSessionMock.mockResolvedValue({
      id: "cs_test_123",
      url: "https://checkout.stripe.com/cs_test_123",
    });

    await createCheckoutSessionForOrder(order);

    const [params] = createSessionMock.mock.calls[0] as [{ payment_method_types: string[] }];
    expect(params.payment_method_types).toEqual(["card"]);
  });

  it("refuses to charge an amount that doesn't match the order total", async () => {
    // Nothing sends order.total to Stripe — the charge is implicitly the
    // sum of the line items — so the two could drift apart with nothing to
    // notice. This is the guard that turns that into a loud failure before
    // a session exists, rather than a customer being charged an amount
    // they never agreed to.
    createSessionMock.mockResolvedValue({
      id: "cs_test_123",
      url: "https://checkout.stripe.com/cs_test_123",
    });

    await expect(
      createCheckoutSessionForOrder({ ...order, total: 99 }),
    ).rejects.toThrow(/Refusing to charge a different amount/);
    expect(createSessionMock).not.toHaveBeenCalled();
  });

  it("omits the fee line entirely for an order that carries no fee", async () => {
    // Every order placed before migration 011 has service_fee backfilled
    // to 0. Those must not grow a $0.00 line item — Stripe rejects a
    // zero-amount line in a payment-mode session, so this is a hard
    // failure, not a cosmetic one.
    createSessionMock.mockResolvedValue({
      id: "cs_test_123",
      url: "https://checkout.stripe.com/cs_test_123",
    });

    await createCheckoutSessionForOrder({
      ...order,
      serviceFee: 0,
      total: 24,
    });

    const [params] = createSessionMock.mock.calls[0] as [
      { line_items: { price_data: { unit_amount: number } }[] },
    ];
    expect(params.line_items).toHaveLength(2);
    expect(
      params.line_items.every((item) => item.price_data.unit_amount > 0),
    ).toBe(true);
  });

  it("throws when Stripe doesn't return a checkout url", async () => {
    createSessionMock.mockResolvedValue({ id: "cs_test_123", url: null });

    await expect(createCheckoutSessionForOrder(order)).rejects.toThrow(
      "Stripe did not return a checkout URL.",
    );
  });
});
