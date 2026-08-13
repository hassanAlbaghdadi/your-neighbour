import { describe, it, expect, vi, beforeEach } from "vitest";

const updateMock = vi.fn();
const eqPaymentStatusMock = vi.fn();
const selectMock = vi.fn();
const maybeSingleMock = vi.fn();
const fromMock = vi.fn();
const getOrderByIdMock = vi.fn();
const getSettingsMock = vi.fn();
const sendOrderNotificationsMock = vi.fn();

vi.mock("@/lib/supabase/serviceRole", () => ({
  createServiceRoleClient: () => ({ from: fromMock }),
}));
vi.mock("@/lib/services/orders/get-order", () => ({
  getOrderById: (...args: unknown[]) => getOrderByIdMock(...args),
}));
vi.mock("@/lib/services/settings/get-settings", () => ({
  getSettings: (...args: unknown[]) => getSettingsMock(...args),
}));
vi.mock("@/lib/email/resend", () => ({
  sendOrderNotifications: (...args: unknown[]) => sendOrderNotificationsMock(...args),
}));

const { markOrderPaid } = await import("./mark-order-paid");

const ORDER_ID = "11111111-1111-4111-8111-111111111111";

function buildFrom(updateResult: { data: unknown; error: unknown }) {
  // .update({...}).eq("id", id).eq("payment_status", "unpaid").select("id").maybeSingle()
  const chain = {
    update: updateMock.mockReturnThis(),
    eq: eqPaymentStatusMock.mockReturnThis(),
    select: selectMock.mockReturnThis(),
    maybeSingle: maybeSingleMock.mockResolvedValue(updateResult),
  };
  fromMock.mockReturnValue(chain);
}

describe("markOrderPaid", () => {
  beforeEach(() => {
    updateMock.mockReset();
    eqPaymentStatusMock.mockReset();
    selectMock.mockReset();
    maybeSingleMock.mockReset();
    fromMock.mockReset();
    getOrderByIdMock.mockReset();
    getSettingsMock.mockReset();
    sendOrderNotificationsMock.mockReset();
    getSettingsMock.mockResolvedValue({
      businessName: "Your Neighbour",
      contactEmail: "owner@example.com",
      maxOrdersPerDay: 50,
      minAdvanceHours: 0,
      pickupTimeSlots: ["10:00"],
      blackoutDates: [],
    });
  });

  it("flips payment_status to paid and sends the order notification emails", async () => {
    buildFrom({ data: { id: ORDER_ID }, error: null });
    const order = { id: ORDER_ID, customerEmail: "jane@example.com" };
    getOrderByIdMock.mockResolvedValue(order);

    await markOrderPaid(ORDER_ID);

    expect(updateMock).toHaveBeenCalledWith({ payment_status: "paid" });
    expect(sendOrderNotificationsMock).toHaveBeenCalledWith(
      order,
      "owner@example.com",
      "Your Neighbour",
    );
  });

  it("does nothing when the order was already paid (webhook retry)", async () => {
    buildFrom({ data: null, error: null });

    await markOrderPaid(ORDER_ID);

    expect(getOrderByIdMock).not.toHaveBeenCalled();
    expect(sendOrderNotificationsMock).not.toHaveBeenCalled();
  });

  it("throws when the update fails", async () => {
    buildFrom({ data: null, error: { message: "db down" } });

    await expect(markOrderPaid(ORDER_ID)).rejects.toThrow("db down");
    expect(sendOrderNotificationsMock).not.toHaveBeenCalled();
  });
});
