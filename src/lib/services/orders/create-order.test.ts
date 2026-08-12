import { describe, it, expect, vi, beforeEach } from "vitest";
import type { CreateOrderInput } from "@/lib/validations/order";

const rpcMock = vi.fn();
const fromMock = vi.fn();

vi.mock("@/lib/supabase/serviceRole", () => ({
  createServiceRoleClient: () => ({
    from: fromMock,
    rpc: rpcMock,
  }),
}));

vi.mock("@/lib/services/settings/get-settings", () => ({
  getSettings: vi.fn(async () => ({
    businessName: "Your Neighbour",
    contactEmail: "owner@example.com",
    maxOrdersPerDay: 50,
    minAdvanceHours: 0,
    pickupTimeSlots: ["10:00"],
    blackoutDates: [],
  })),
}));

vi.mock("@/lib/email/resend", () => ({
  sendOrderNotifications: vi.fn(async () => {}),
}));

const { processNewOrder } = await import("./create-order");

const VARIANT_ID = "22222222-2222-4222-8222-222222222222";

const baseInput: CreateOrderInput = {
  id: "11111111-1111-4111-8111-111111111111",
  customerName: "Jane Doe",
  customerEmail: "jane@example.com",
  customerPhone: "5551234567",
  pickupDate: "2026-08-20",
  pickupTime: "10:00",
  notes: "",
  items: [{ variantId: VARIANT_ID, quantity: 2 }],
};

function queryBuilder(result: Record<string, unknown>) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    neq: vi.fn(() => builder),
    in: vi.fn(() => builder),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
    then: (
      resolve: (value: unknown) => void,
      reject: (reason: unknown) => void,
    ) => Promise.resolve(result).then(resolve, reject),
  };
  return builder;
}

function setupSupabaseMocks({
  existingOrder = null,
  existingOrderItems = [],
  rpcResult = {
    data: {
      id: baseInput.id,
      customer_name: baseInput.customerName,
      customer_email: baseInput.customerEmail,
      customer_phone: baseInput.customerPhone,
      pickup_date: baseInput.pickupDate,
      pickup_time: "10:00:00",
      notes: null,
      subtotal: 16,
      total: 16,
      status: "Pending",
    },
    error: null,
  },
}: {
  existingOrder?: unknown;
  existingOrderItems?: unknown[];
  rpcResult?: { data: unknown; error: unknown };
} = {}) {
  fromMock.mockImplementation((table: string) => {
    if (table === "orders") {
      // Shared by getExistingOrder's .maybeSingle() and the capacity count
      // query below — each destructures only the keys it needs.
      return queryBuilder({ data: existingOrder, error: null, count: 0 });
    }
    if (table === "order_items") {
      return queryBuilder({ data: existingOrderItems, error: null });
    }
    if (table === "product_variants") {
      return queryBuilder({
        data: [
          {
            id: VARIANT_ID,
            label: "Large",
            price: 8,
            is_available: true,
            product: {
              id: "product-1",
              name: "Sourdough Loaf",
              is_available: true,
            },
          },
        ],
        error: null,
      });
    }
    throw new Error(`Unexpected table in test: ${table}`);
  });
  rpcMock.mockResolvedValue(rpcResult);
}

describe("processNewOrder", () => {
  beforeEach(() => {
    fromMock.mockReset();
    rpcMock.mockReset();
  });

  it("creates the order and its items via a single atomic RPC call", async () => {
    setupSupabaseMocks();

    const result = await processNewOrder(baseInput);

    expect(result.id).toBe(baseInput.id);
    expect(result.total).toBe(16);
    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(rpcMock).toHaveBeenCalledWith(
      "create_order_atomic",
      expect.objectContaining({
        p_order_row: expect.objectContaining({ id: baseInput.id }),
        p_items: expect.arrayContaining([
          expect.objectContaining({
            variant_id: VARIANT_ID,
            quantity: 2,
          }),
        ]),
      }),
    );
    // The old two-call path (`.from("order_items").insert(...)`) is gone —
    // order_items is never queried as a table directly from this function.
    expect(fromMock).not.toHaveBeenCalledWith("order_items");
  });

  it("throws instead of returning a partial order when the RPC fails", async () => {
    setupSupabaseMocks({
      rpcResult: { data: null, error: { message: "insert failed" } },
    });

    await expect(processNewOrder(baseInput)).rejects.toThrow(
      "Failed to create order",
    );
  });

  it("short-circuits via getExistingOrder without calling the RPC again", async () => {
    setupSupabaseMocks({
      existingOrder: {
        id: baseInput.id,
        customer_name: baseInput.customerName,
        customer_email: baseInput.customerEmail,
        customer_phone: baseInput.customerPhone,
        pickup_date: baseInput.pickupDate,
        pickup_time: "10:00:00",
        notes: null,
        subtotal: 16,
        total: 16,
        status: "Pending",
      },
    });

    const result = await processNewOrder(baseInput);

    expect(result.id).toBe(baseInput.id);
    expect(rpcMock).not.toHaveBeenCalled();
  });
});
