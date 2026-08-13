import { describe, it, expect, vi, beforeEach } from "vitest";

const notifyOnceMock = vi.fn();
const sendPaymentFailedMock = vi.fn();

vi.mock("@/lib/services/orders/notification-lease", () => ({
  notifyOnce: (...args: unknown[]) => notifyOnceMock(...args),
}));
vi.mock("@/lib/email/resend", () => ({
  sendPaymentFailedNotification: (...args: unknown[]) =>
    sendPaymentFailedMock(...args),
}));

const { notifyPaymentFailed } = await import("./notify-payment-failed");

const ORDER_ID = "11111111-1111-4111-8111-111111111111";
const ORDER = { id: ORDER_ID, customerEmail: "jane@example.com" };
const SETTINGS = {
  businessName: "Your Neighbour",
  contactEmail: "owner@example.com",
  maxOrdersPerDay: 50,
  minAdvanceHours: 0,
  pickupTimeSlots: ["10:00"],
  blackoutDates: [],
};

describe("notifyPaymentFailed", () => {
  beforeEach(() => {
    notifyOnceMock.mockReset();
    sendPaymentFailedMock.mockReset();
    sendPaymentFailedMock.mockResolvedValue(undefined);
    // Stand in for the lease granting the send and handing over the order.
    notifyOnceMock.mockImplementation(
      (
        _orderId: string,
        send: (order: unknown, settings: unknown) => Promise<void>,
      ) => send(ORDER, SETTINGS),
    );
  });

  it("sends under the lease, so redeliveries can't double the email", async () => {
    await notifyPaymentFailed(ORDER_ID);

    expect(notifyOnceMock).toHaveBeenCalledWith(ORDER_ID, expect.any(Function));
  });

  it("passes the contact email and business name in the right order", async () => {
    // Both are bare strings, so a swap would compile and simply mail the
    // wrong thing — worth pinning.
    await notifyPaymentFailed(ORDER_ID);

    expect(sendPaymentFailedMock).toHaveBeenCalledWith(
      ORDER,
      "owner@example.com",
      "Your Neighbour",
    );
  });

  it("does not send when the lease was already taken", async () => {
    notifyOnceMock.mockResolvedValue(undefined);

    await notifyPaymentFailed(ORDER_ID);

    expect(sendPaymentFailedMock).not.toHaveBeenCalled();
  });
});
