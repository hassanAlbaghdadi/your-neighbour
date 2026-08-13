import { describe, it, expect, vi, beforeEach } from "vitest";

const processNewOrderMock = vi.fn();
const createCheckoutSessionMock = vi.fn();
const releaseUnstartedReservationMock = vi.fn();
const getUserMock = vi.fn();
const checkRateLimitsMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: getUserMock },
  }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/services/orders/create-order", () => ({
  processNewOrder: (...args: unknown[]) => processNewOrderMock(...args),
  OrderError: class OrderError extends Error {},
}));
vi.mock("@/lib/services/orders/create-checkout-session", () => ({
  createCheckoutSessionForOrder: (...args: unknown[]) =>
    createCheckoutSessionMock(...args),
}));
vi.mock("@/lib/services/orders/release-unpaid-reservation", () => ({
  releaseUnstartedReservation: (...args: unknown[]) =>
    releaseUnstartedReservationMock(...args),
}));
vi.mock("@/lib/services/orders/update-order-status", () => ({
  updateOrderStatus: vi.fn(async () => {}),
}));
vi.mock("@/lib/services/rate-limit/check-rate-limit", () => ({
  checkRateLimits: (...args: unknown[]) => checkRateLimitsMock(...args),
  getClientIp: async () => "203.0.113.7",
}));

const { createOrderAction } = await import("./orders");

const validPayload = {
  id: "11111111-1111-4111-8111-111111111111",
  customerName: "Jane Doe",
  customerEmail: "jane@example.com",
  customerPhone: "5551234567",
  pickupDate: "2026-08-20",
  pickupTime: "10:00",
  notes: "",
  items: [
    { variantId: "22222222-2222-4222-8222-222222222222", quantity: 1 },
  ],
};

describe("createOrderAction", () => {
  beforeEach(() => {
    processNewOrderMock.mockReset();
    createCheckoutSessionMock.mockReset();
    releaseUnstartedReservationMock.mockReset();
    checkRateLimitsMock.mockReset();
    checkRateLimitsMock.mockResolvedValue(true);
  });

  it("refuses the order and never reserves a slot when rate limited", async () => {
    // Every created order holds a pickup-capacity slot until its Stripe
    // session expires, so the limiter has to bite before processNewOrder —
    // rejecting after the reservation would defeat the point.
    checkRateLimitsMock.mockResolvedValue(false);

    const result = await createOrderAction(validPayload);

    expect(result.success).toBe(false);
    expect(processNewOrderMock).not.toHaveBeenCalled();
  });

  it("limits by both client IP and customer email", async () => {
    processNewOrderMock.mockResolvedValue({
      id: validPayload.id,
      total: 8,
      paymentStatus: "unpaid",
    });
    createCheckoutSessionMock.mockResolvedValue("https://checkout.stripe.com/s");

    await createOrderAction(validPayload);

    expect(checkRateLimitsMock).toHaveBeenCalledWith([
      expect.objectContaining({ scope: "order:ip", identifier: "203.0.113.7" }),
      expect.objectContaining({
        scope: "order:email",
        identifier: "jane@example.com",
      }),
    ]);
  });

  it("creates a checkout session and returns its url for an unpaid order", async () => {
    const order = { id: validPayload.id, total: 8, paymentStatus: "unpaid" };
    processNewOrderMock.mockResolvedValue(order);
    createCheckoutSessionMock.mockResolvedValue("https://checkout.stripe.com/session123");

    const result = await createOrderAction(validPayload);

    expect(result).toEqual({
      success: true,
      data: { order, checkoutUrl: "https://checkout.stripe.com/session123" },
    });
    expect(createCheckoutSessionMock).toHaveBeenCalledWith(order);
  });

  it("skips checkout session creation when the order is already paid", async () => {
    const order = { id: validPayload.id, total: 8, paymentStatus: "paid" };
    processNewOrderMock.mockResolvedValue(order);

    const result = await createOrderAction(validPayload);

    expect(result).toEqual({ success: true, data: { order, checkoutUrl: null } });
    expect(createCheckoutSessionMock).not.toHaveBeenCalled();
  });

  it("releases the reservation and surfaces the error when checkout session creation fails", async () => {
    const order = { id: validPayload.id, total: 8, paymentStatus: "unpaid" };
    processNewOrderMock.mockResolvedValue(order);
    createCheckoutSessionMock.mockRejectedValue(new Error("Stripe is down"));

    const result = await createOrderAction(validPayload);

    expect(result.success).toBe(false);
    expect(releaseUnstartedReservationMock).toHaveBeenCalledWith(order.id);
  });

  it("returns the { success: false, error } shape on invalid input", async () => {
    const result = await createOrderAction({ ...validPayload, customerEmail: "not-an-email" });

    expect(result.success).toBe(false);
    expect(typeof result.error).toBe("string");
    expect(processNewOrderMock).not.toHaveBeenCalled();
  });
});
