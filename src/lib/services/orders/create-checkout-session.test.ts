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
  customerName: "Jane Doe",
  customerEmail: "jane@example.com",
  customerPhone: "5551234567",
  pickupDate: "2026-08-20",
  pickupTime: "10:00",
  notes: null,
  subtotal: 24,
  total: 24,
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

  it("builds one Stripe line item per order item and returns the session url", async () => {
    createSessionMock.mockResolvedValue({
      id: "cs_test_123",
      url: "https://checkout.stripe.com/cs_test_123",
    });

    const url = await createCheckoutSessionForOrder(order);

    expect(url).toBe("https://checkout.stripe.com/cs_test_123");
    expect(createSessionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "payment",
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
        ],
      }),
      // Keyed on the order id, which is stable across resubmits, so a
      // retry returns the existing session instead of leaving a second
      // live one behind for the same order.
      { idempotencyKey: `checkout_session_${order.id}` },
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

  it("throws when Stripe doesn't return a checkout url", async () => {
    createSessionMock.mockResolvedValue({ id: "cs_test_123", url: null });

    await expect(createCheckoutSessionForOrder(order)).rejects.toThrow(
      "Stripe did not return a checkout URL.",
    );
  });
});
