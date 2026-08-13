import { describe, it, expect, vi, beforeEach } from "vitest";

const updateMock = vi.fn();
const eqIdMock = vi.fn();
const eqPaymentStatusMock = vi.fn();
const fromMock = vi.fn();

vi.mock("@/lib/supabase/serviceRole", () => ({
  createServiceRoleClient: () => ({ from: fromMock }),
}));

const { cancelExpiredOrder } = await import("./cancel-expired-order");

const ORDER_ID = "11111111-1111-4111-8111-111111111111";

describe("cancelExpiredOrder", () => {
  beforeEach(() => {
    updateMock.mockReset();
    eqIdMock.mockReset();
    eqPaymentStatusMock.mockReset();
    fromMock.mockReset();

    fromMock.mockReturnValue({ update: updateMock });
    updateMock.mockReturnValue({ eq: eqIdMock });
    eqIdMock.mockReturnValue({ eq: eqPaymentStatusMock });
  });

  it("cancels an unpaid order to free its pickup-capacity slot", async () => {
    eqPaymentStatusMock.mockResolvedValue({ error: null });

    await cancelExpiredOrder(ORDER_ID);

    expect(updateMock).toHaveBeenCalledWith({ status: "Cancelled" });
    expect(eqIdMock).toHaveBeenCalledWith("id", ORDER_ID);
    expect(eqPaymentStatusMock).toHaveBeenCalledWith("payment_status", "unpaid");
  });

  it("throws when the update fails", async () => {
    eqPaymentStatusMock.mockResolvedValue({ error: { message: "db down" } });

    await expect(cancelExpiredOrder(ORDER_ID)).rejects.toThrow("db down");
  });
});
