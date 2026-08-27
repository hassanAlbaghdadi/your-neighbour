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

const { createOrderAction, updateOrderStatusAction } = await import("./orders");
const { updateOrderStatus } = await import(
  "@/lib/services/orders/update-order-status"
);

const validPayload = {
  id: "11111111-1111-4111-8111-111111111111",
  customerName: "Jane Doe",
  customerEmail: "jane@example.com",
  customerPhone: "5551234567",
  // Inert here -- create-order is mocked below, so this never reaches the
  // lead-time guard. If that mock ever goes away, pin the clock the way
  // create-order.test.ts does rather than leaning on a fixed future date.
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

  it("refuses the order and releases its reservation when rate limited", async () => {
    // The limiter runs after processNewOrder, not before: the OrderError
    // rejections that function throws for (blackout date, too little
    // notice, fully booked) are walls a customer can hit repeatedly while
    // placing zero real orders, and counting those against the limit could
    // lock someone out without them ever holding a slot. So this exercises
    // the one case the limiter actually has to catch — a reservation *was*
    // made — and expects it released rather than left to hold the slot for
    // no reason.
    const order = { id: validPayload.id, total: 8, paymentStatus: "unpaid" };
    processNewOrderMock.mockResolvedValue(order);
    checkRateLimitsMock.mockResolvedValue(false);

    const result = await createOrderAction(validPayload);

    expect(result.success).toBe(false);
    expect(releaseUnstartedReservationMock).toHaveBeenCalledWith(order.id);
    expect(createCheckoutSessionMock).not.toHaveBeenCalled();
  });

  it("never rate-limits a resubmit of an already-paid order", async () => {
    // paymentStatus: "paid" here means processNewOrder's own idempotent
    // lookup found an existing order — nothing left to reserve or check
    // out, so there is nothing for the limiter to protect either.
    processNewOrderMock.mockResolvedValue({
      id: validPayload.id,
      total: 8,
      paymentStatus: "paid",
    });

    const result = await createOrderAction(validPayload);

    expect(result.success).toBe(true);
    expect(checkRateLimitsMock).not.toHaveBeenCalled();
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

describe("updateOrderStatusAction authorization", () => {
  // This one gates on supabase.auth.getUser() directly rather than
  // requireAdmin, and nothing covered the signed-out branch -- deleting
  // `if (!user)` left the suite green, which would make any order's status
  // writable by an anonymous caller.
  it("refuses a signed-out caller and never touches the order", async () => {
    vi.clearAllMocks();
    getUserMock.mockResolvedValue({ data: { user: null } });

    await expect(updateOrderStatusAction("order-1", "Ready")).resolves.toEqual({
      success: false,
      error: "Unauthorized",
    });
    expect(updateOrderStatus).not.toHaveBeenCalled();
  });

  it("lets a signed-in admin through", async () => {
    vi.clearAllMocks();
    getUserMock.mockResolvedValue({ data: { user: { id: "admin-1" } } });

    await expect(updateOrderStatusAction("order-1", "Ready")).resolves.toEqual({
      success: true,
    });
    expect(updateOrderStatus).toHaveBeenCalledWith("order-1", "Ready");
  });
});
