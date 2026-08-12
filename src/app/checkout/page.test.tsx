import { describe, it, expect, vi, beforeEach } from "vitest";

const getSettingsMock = vi.fn();
const getOrderCountsByDateMock = vi.fn();

vi.mock("@/lib/services/settings/get-settings", () => ({
  getSettings: (...args: unknown[]) => getSettingsMock(...args),
}));
vi.mock("@/lib/services/orders/get-order-counts", () => ({
  getOrderCountsByDate: (...args: unknown[]) => getOrderCountsByDateMock(...args),
}));
vi.mock("@/components/checkout/checkout-form", () => ({
  CheckoutForm: () => null,
}));

const { default: CheckoutPage } = await import("./page");

function delayed<T>(value: T, onEnd: () => void, ms: number): Promise<T> {
  return new Promise((resolve) => {
    setTimeout(() => {
      onEnd();
      resolve(value);
    }, ms);
  });
}

describe("CheckoutPage", () => {
  beforeEach(() => {
    getSettingsMock.mockReset();
    getOrderCountsByDateMock.mockReset();
  });

  it("fetches settings and order counts in parallel, not sequentially", async () => {
    const callOrder: string[] = [];

    getSettingsMock.mockImplementation(() => {
      callOrder.push("settings-start");
      return delayed(
        {
          businessName: "Your Neighbour",
          contactEmail: "",
          maxOrdersPerDay: 15,
          minAdvanceHours: 24,
          pickupTimeSlots: [],
          blackoutDates: [],
        },
        () => callOrder.push("settings-end"),
        20,
      );
    });
    getOrderCountsByDateMock.mockImplementation(() => {
      callOrder.push("counts-start");
      return delayed({}, () => callOrder.push("counts-end"), 20);
    });

    await CheckoutPage();

    // Sequential (await getSettings() then await getOrderCountsByDate())
    // would produce: settings-start, settings-end, counts-start, counts-end
    // — counts-start could only happen after settings-end. Promise.all
    // starts both before either resolves.
    expect(callOrder.indexOf("counts-start")).toBeLessThan(
      callOrder.indexOf("settings-end"),
    );
  });
});
