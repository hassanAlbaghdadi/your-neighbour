import { describe, it, expect, vi, beforeEach } from "vitest";

const processNewOrderMock = vi.fn();
const getUserMock = vi.fn();

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
vi.mock("@/lib/services/orders/update-order-status", () => ({
  updateOrderStatus: vi.fn(async () => {}),
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
  });

  it("returns the { success: true, data } shape on a successful order", async () => {
    const order = { id: validPayload.id, total: 8 };
    processNewOrderMock.mockResolvedValue(order);

    const result = await createOrderAction(validPayload);

    expect(result).toEqual({ success: true, data: order });
  });

  it("returns the { success: false, error } shape on invalid input", async () => {
    const result = await createOrderAction({ ...validPayload, customerEmail: "not-an-email" });

    expect(result.success).toBe(false);
    expect(typeof result.error).toBe("string");
    expect(processNewOrderMock).not.toHaveBeenCalled();
  });
});
