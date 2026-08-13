import { describe, it, expect, vi, beforeEach } from "vitest";

const constructEventMock = vi.fn();
const markOrderPaidMock = vi.fn();
const cancelExpiredOrderMock = vi.fn();
const notifyPaymentFailedMock = vi.fn();

vi.mock("@/lib/stripe/client", () => ({
  getStripeClient: () => ({
    webhooks: { constructEvent: (...args: unknown[]) => constructEventMock(...args) },
  }),
}));
vi.mock("@/lib/services/orders/mark-order-paid", () => ({
  markOrderPaid: (...args: unknown[]) => markOrderPaidMock(...args),
}));
vi.mock("@/lib/services/orders/cancel-expired-order", () => ({
  cancelExpiredOrder: (...args: unknown[]) => cancelExpiredOrderMock(...args),
}));
vi.mock("@/lib/services/orders/notify-payment-failed", () => ({
  notifyPaymentFailed: (...args: unknown[]) => notifyPaymentFailedMock(...args),
}));

const { POST } = await import("./route");

function makeRequest(headers: Record<string, string> = { "stripe-signature": "sig_test" }) {
  return new Request("https://yourneighbour.example/api/webhooks/stripe", {
    method: "POST",
    headers,
    body: "{}",
  });
}

describe("POST /api/webhooks/stripe", () => {
  beforeEach(() => {
    constructEventMock.mockReset();
    markOrderPaidMock.mockReset();
    cancelExpiredOrderMock.mockReset();
    notifyPaymentFailedMock.mockReset();
    cancelExpiredOrderMock.mockResolvedValue(true);
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_test");
  });

  it("rejects a request with no stripe-signature header", async () => {
    const response = await POST(makeRequest({}));

    expect(response.status).toBe(400);
    expect(constructEventMock).not.toHaveBeenCalled();
  });

  it("rejects a request whose signature fails verification", async () => {
    constructEventMock.mockImplementation(() => {
      throw new Error("bad signature");
    });

    const response = await POST(makeRequest());

    expect(response.status).toBe(400);
  });

  it("marks the order paid on checkout.session.completed when payment_status is paid", async () => {
    constructEventMock.mockReturnValue({
      type: "checkout.session.completed",
      data: {
        object: {
          payment_status: "paid",
          metadata: { order_id: "order-1" },
          client_reference_id: null,
        },
      },
    });

    const response = await POST(makeRequest());

    expect(response.status).toBe(200);
    expect(markOrderPaidMock).toHaveBeenCalledWith("order-1");
  });

  it("does not mark the order paid when checkout.session.completed's payment is still pending", async () => {
    // Delayed payment methods (bank debits etc.) complete checkout before
    // the money actually arrives — payment_status stays "unpaid" until a
    // later async_payment_succeeded event.
    constructEventMock.mockReturnValue({
      type: "checkout.session.completed",
      data: {
        object: {
          payment_status: "unpaid",
          metadata: { order_id: "order-1" },
          client_reference_id: null,
        },
      },
    });

    const response = await POST(makeRequest());

    expect(response.status).toBe(200);
    expect(markOrderPaidMock).not.toHaveBeenCalled();
  });

  it("falls back to client_reference_id when metadata.order_id is missing", async () => {
    constructEventMock.mockReturnValue({
      type: "checkout.session.completed",
      data: { object: { payment_status: "paid", metadata: {}, client_reference_id: "order-2" } },
    });

    await POST(makeRequest());

    expect(markOrderPaidMock).toHaveBeenCalledWith("order-2");
  });

  it("marks the order paid on checkout.session.async_payment_succeeded", async () => {
    constructEventMock.mockReturnValue({
      type: "checkout.session.async_payment_succeeded",
      data: { object: { metadata: { order_id: "order-4" }, client_reference_id: null } },
    });

    await POST(makeRequest());

    expect(markOrderPaidMock).toHaveBeenCalledWith("order-4");
  });

  it("cancels the order on checkout.session.expired, naming the session that expired", async () => {
    constructEventMock.mockReturnValue({
      type: "checkout.session.expired",
      data: {
        object: {
          id: "cs_test_expired",
          metadata: { order_id: "order-3" },
          client_reference_id: null,
        },
      },
    });

    await POST(makeRequest());

    // The session id travels with the order id so the cancel can confirm
    // it's the session the order is actually waiting on.
    expect(cancelExpiredOrderMock).toHaveBeenCalledWith(
      "order-3",
      "cs_test_expired",
    );
    expect(markOrderPaidMock).not.toHaveBeenCalled();
  });

  it("cancels the order on checkout.session.async_payment_failed", async () => {
    constructEventMock.mockReturnValue({
      type: "checkout.session.async_payment_failed",
      data: {
        object: {
          id: "cs_test_failed",
          metadata: { order_id: "order-5" },
          client_reference_id: null,
        },
      },
    });

    await POST(makeRequest());

    expect(cancelExpiredOrderMock).toHaveBeenCalledWith(
      "order-5",
      "cs_test_failed",
    );
    expect(markOrderPaidMock).not.toHaveBeenCalled();
  });

  it("emails the customer when a delayed payment fails", async () => {
    // They completed checkout days ago and believe the order is placed —
    // unlike an abandoned session, this one owes them an explanation.
    constructEventMock.mockReturnValue({
      type: "checkout.session.async_payment_failed",
      data: {
        object: {
          id: "cs_test_failed",
          metadata: { order_id: "order-5" },
          client_reference_id: null,
        },
      },
    });

    await POST(makeRequest());

    expect(notifyPaymentFailedMock).toHaveBeenCalledWith("order-5");
  });

  it("stays silent when an abandoned checkout expires", async () => {
    // The customer walked away without paying and knows they didn't order;
    // mailing them would be unprompted noise.
    constructEventMock.mockReturnValue({
      type: "checkout.session.expired",
      data: {
        object: {
          id: "cs_test_expired",
          metadata: { order_id: "order-3" },
          client_reference_id: null,
        },
      },
    });

    await POST(makeRequest());

    expect(cancelExpiredOrderMock).toHaveBeenCalled();
    expect(notifyPaymentFailedMock).not.toHaveBeenCalled();
  });

  it("does not email when the cancel was declined by a guard", async () => {
    // e.g. the order is already paid, or the expired session isn't the one
    // it's waiting on — no cancellation happened, so nothing to report.
    cancelExpiredOrderMock.mockResolvedValue(false);
    constructEventMock.mockReturnValue({
      type: "checkout.session.async_payment_failed",
      data: {
        object: {
          id: "cs_test_failed",
          metadata: { order_id: "order-5" },
          client_reference_id: null,
        },
      },
    });

    await POST(makeRequest());

    expect(notifyPaymentFailedMock).not.toHaveBeenCalled();
  });

  it("ignores event types it doesn't handle", async () => {
    constructEventMock.mockReturnValue({
      type: "payment_intent.created",
      data: { object: {} },
    });

    const response = await POST(makeRequest());

    expect(response.status).toBe(200);
    expect(markOrderPaidMock).not.toHaveBeenCalled();
    expect(cancelExpiredOrderMock).not.toHaveBeenCalled();
  });

  it("returns 500 so Stripe retries when the handler throws", async () => {
    constructEventMock.mockReturnValue({
      type: "checkout.session.completed",
      data: {
        object: {
          payment_status: "paid",
          metadata: { order_id: "order-1" },
          client_reference_id: null,
        },
      },
    });
    markOrderPaidMock.mockRejectedValue(new Error("db down"));

    const response = await POST(makeRequest());

    expect(response.status).toBe(500);
  });
});
