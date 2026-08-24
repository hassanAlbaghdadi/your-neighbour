import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import type { CreateOrderInput } from "@/lib/validations/order";
import type { StoreSettings } from "@/lib/services/settings/get-settings";

const rpcMock = vi.fn();
const fromMock = vi.fn();

vi.mock("@/lib/supabase/serviceRole", () => ({
  createServiceRoleClient: () => ({
    from: fromMock,
    rpc: rpcMock,
  }),
}));

const BASE_SETTINGS: StoreSettings = {
  businessName: "Your Neighbour",
  contactEmail: "owner@example.com",
  pickupAddress: "12 Example St, Halifax NS",
  maxOrdersPerDay: 50,
  minAdvanceHours: 0,
  pickupTimeSlots: ["10:00"],
  blackoutDates: [],
};

const getSettingsMock = vi.fn(async () => BASE_SETTINGS);

vi.mock("@/lib/services/settings/get-settings", () => ({
  getSettings: getSettingsMock,
}));

const { processNewOrder } = await import("./create-order");

const VARIANT_ID = "22222222-2222-4222-8222-222222222222";

// Frozen so the fixed pickupDate below can't drift into the past. The
// previous fixture was a bare "2026-08-20" written eight days before that
// date, and every test here that reaches the lead-time guard started
// failing on 2026-08-21 with a wrong-error message that masked what they
// were actually asserting.
//
// 09:00 Atlantic on the 19th (ADT, UTC-3) -- 25 hours before the 10:00
// Atlantic pickup on the 20th. Deliberately inside the window where a
// naive UTC parse of the pickup string disagrees with the business zone:
// see the 24-hour test below.
const NOW = new Date("2026-08-19T12:00:00Z");

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
      payment_status: "unpaid",
    },
    error: null,
  },
  variantAvailable = true,
  productAvailable = true,
}: {
  existingOrder?: unknown;
  existingOrderItems?: unknown[];
  rpcResult?: { data: unknown; error: unknown };
  variantAvailable?: boolean;
  productAvailable?: boolean;
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
            is_available: variantAvailable,
            product: {
              id: "product-1",
              name: "Sourdough Loaf",
              is_available: productAvailable,
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
  beforeAll(() => {
    // Only Date -- faking timers wholesale would stall the awaited promises
    // in these tests.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  beforeEach(() => {
    fromMock.mockReset();
    rpcMock.mockReset();
    getSettingsMock.mockResolvedValue(BASE_SETTINGS);
  });

  it("creates the order and its items via a single atomic RPC call", async () => {
    setupSupabaseMocks();

    const result = await processNewOrder(baseInput);

    expect(result.id).toBe(baseInput.id);
    expect(result.total).toBe(16);
    expect(result.paymentStatus).toBe("unpaid");
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
        // The RPC re-checks this itself under a per-pickup-date lock — the
        // count query earlier in this function is only a fast pre-check,
        // not the actual guarantee. See 006_atomic_capacity_check.sql.
        p_max_orders_per_day: 50,
      }),
    );
    // The old two-call path (`.from("order_items").insert(...)`) is gone —
    // order_items is never queried as a table directly from this function.
    expect(fromMock).not.toHaveBeenCalledWith("order_items");
  });

  it("refuses an order for a variant the owner marked unavailable", async () => {
    // Nothing else stops this: the cart lives in the customer's
    // localStorage, so a variant that sold out after it was added -- or a
    // hand-edited request -- reaches the server looking perfectly valid.
    // This check is the only gate, and the RPC must never be reached.
    setupSupabaseMocks({ variantAvailable: false });

    // Names the item. The cart never expires, so the usual way to hit this
    // is a stale cart rather than a race -- "some items" left the customer
    // on a filled-in form with no idea which one to remove.
    await expect(processNewOrder(baseInput)).rejects.toThrow(
      "Sourdough Loaf (Large) is no longer available",
    );
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("refuses an order for a product the owner marked unavailable", async () => {
    setupSupabaseMocks({ productAvailable: false });

    await expect(processNewOrder(baseInput)).rejects.toThrow(
      "Sourdough Loaf (Large) is no longer available",
    );
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("names a variant that has vanished from the catalogue entirely", async () => {
    // No row comes back for it, so there's no name to give -- the message
    // still has to be answerable rather than blaming the whole cart.
    setupSupabaseMocks();

    await expect(
      processNewOrder({
        ...baseInput,
        items: [{ variantId: "33333333-3333-4333-8333-333333333333", quantity: 1 }],
      }),
    ).rejects.toThrow("an item that has since been removed is no longer available");
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("refuses a pickup time that isn't one of the offered slots", async () => {
    // The only thing validating pickupTime server-side. The client sends
    // it, so nothing stops a tampered request naming a time the bakery
    // never offered -- 03:00 here against a settings list of ["10:00"].
    setupSupabaseMocks();

    await expect(
      processNewOrder({ ...baseInput, pickupTime: "03:00" }),
    ).rejects.toThrow("That pickup time isn't available any more.");
    // The field is what lets checkout render this against the time slots
    // rather than in a toast that drifts away from them.
    await expect(
      processNewOrder({ ...baseInput, pickupTime: "03:00" }),
    ).rejects.toMatchObject({ field: "pickupTime" });
  });

  it("refuses a pickup date the owner has blacked out", async () => {
    setupSupabaseMocks();
    getSettingsMock.mockResolvedValue({
      ...BASE_SETTINGS,
      blackoutDates: [baseInput.pickupDate],
    });

    await expect(processNewOrder(baseInput)).rejects.toThrow(
      "We're closed for orders on that date.",
    );
    await expect(processNewOrder(baseInput)).rejects.toMatchObject({
      field: "pickupDate",
    });
  });

  it("measures the lead time in the bakery's zone, not the host's", async () => {
    // Regression: the guard used to build the pickup instant with
    // `new Date(`${date}T${time}:00`)`, which has no offset designator and
    // so resolved against whatever zone the process ran in. On a UTC host
    // this slot parsed as 10:00Z instead of 13:00Z (10:00 ADT), landing
    // 3 hours early and failing a 24-hour rule that it actually satisfies
    // by 25 hours -- after the checkout calendar, running in the customer's
    // own zone, had already offered it.
    setupSupabaseMocks();
    getSettingsMock.mockResolvedValue({ ...BASE_SETTINGS, minAdvanceHours: 24 });

    await expect(processNewOrder(baseInput)).resolves.toMatchObject({
      id: baseInput.id,
    });
  });

  it("still rejects a slot that genuinely lacks the required notice", async () => {
    setupSupabaseMocks();
    getSettingsMock.mockResolvedValue({ ...BASE_SETTINGS, minAdvanceHours: 48 });

    await expect(processNewOrder(baseInput)).rejects.toThrow(
      "Orders need at least 48 hours' notice",
    );
    await expect(processNewOrder(baseInput)).rejects.toMatchObject({
      field: "pickupDate",
    });
  });

  it("throws instead of returning a partial order when the RPC fails", async () => {
    setupSupabaseMocks({
      rpcResult: { data: null, error: { message: "insert failed" } },
    });

    await expect(processNewOrder(baseInput)).rejects.toThrow(
      "Failed to create order",
    );
  });

  it("throws when the RPC reports an error even though it returned a row", async () => {
    // The guard is `if (orderError || !order)`, and the test above only
    // ever exercises the `!order` half -- deleting the `orderError ||`
    // limb entirely leaves it green, because its fixture nulls the data
    // too. This pins the other half: an error alongside a row is exactly
    // the partial write that must not be handed back to the caller as a
    // real order, which is what that test's name promises and didn't check.
    setupSupabaseMocks({
      rpcResult: {
        data: { id: baseInput.id },
        error: { message: "items insert failed after order row" },
      },
    });

    await expect(processNewOrder(baseInput)).rejects.toThrow(
      "Failed to create order",
    );
  });

  it("surfaces a friendly error when the RPC's own capacity re-check loses the race", async () => {
    // Simulates two concurrent requests both passing the fast pre-check
    // (count query mocked to 0 in setupSupabaseMocks) but the RPC's
    // atomic, locked re-check catching the one that would oversell.
    setupSupabaseMocks({
      rpcResult: { data: null, error: { message: "CAPACITY_FULL" } },
    });

    await expect(processNewOrder(baseInput)).rejects.toThrow(
      "That pickup date is fully booked. Please choose another day.",
    );
    await expect(processNewOrder(baseInput)).rejects.toMatchObject({
      field: "pickupDate",
    });
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
        payment_status: "unpaid",
      },
    });

    const result = await processNewOrder(baseInput);

    expect(result.id).toBe(baseInput.id);
    expect(rpcMock).not.toHaveBeenCalled();
  });
});
