import { describe, it, expect, vi, beforeEach } from "vitest";

const updateMock = vi.fn();
const eqIdMock = vi.fn();
const eqPaymentStatusMock = vi.fn();
const isSessionIdMock = vi.fn();
const fromMock = vi.fn();

vi.mock("@/lib/supabase/serviceRole", () => ({
  createServiceRoleClient: () => ({ from: fromMock }),
}));

const { releaseUnstartedReservation } = await import("./release-unpaid-reservation");

const ORDER_ID = "11111111-1111-4111-8111-111111111111";

describe("releaseUnstartedReservation", () => {
  beforeEach(() => {
    updateMock.mockReset();
    eqIdMock.mockReset();
    eqPaymentStatusMock.mockReset();
    isSessionIdMock.mockReset();
    fromMock.mockReset();

    fromMock.mockReturnValue({ update: updateMock });
    updateMock.mockReturnValue({ eq: eqIdMock });
    eqIdMock.mockReturnValue({ eq: eqPaymentStatusMock });
    eqPaymentStatusMock.mockReturnValue({ is: isSessionIdMock });
  });

  it("cancels the order only when it never got a Stripe session", async () => {
    isSessionIdMock.mockResolvedValue({ error: null });

    await releaseUnstartedReservation(ORDER_ID);

    expect(updateMock).toHaveBeenCalledWith({ status: "Cancelled" });
    expect(eqIdMock).toHaveBeenCalledWith("id", ORDER_ID);
    expect(eqPaymentStatusMock).toHaveBeenCalledWith("payment_status", "unpaid");
    expect(isSessionIdMock).toHaveBeenCalledWith("stripe_checkout_session_id", null);
  });

  it("does not throw when the update fails — this is best-effort cleanup", async () => {
    isSessionIdMock.mockResolvedValue({ error: { message: "db down" } });

    await expect(releaseUnstartedReservation(ORDER_ID)).resolves.toBeUndefined();
  });
});
