import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CheckoutForm } from "./checkout-form";
import type { StoreSettings } from "@/lib/services/settings/get-settings";

const pushMock = vi.fn();
const clearCartMock = vi.fn();
const createOrderActionMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("@/context/cart-context", () => ({
  useCart: () => ({
    items: [
      {
        productId: "product-1",
        variantId: "11111111-1111-4111-8111-111111111111",
        name: "Sourdough Loaf",
        variantLabel: "Large",
        slug: "sourdough",
        price: 8,
        quantity: 1,
      },
    ],
    subtotal: 8,
    clearCart: clearCartMock,
  }),
}));

vi.mock("@/app/actions/orders", () => ({
  createOrderAction: (...args: unknown[]) => createOrderActionMock(...args),
}));

const settings: StoreSettings = {
  businessName: "Your Neighbour",
  contactEmail: "hello@example.com",
  maxOrdersPerDay: 50,
  minAdvanceHours: 0,
  pickupTimeSlots: ["23:59"],
  blackoutDates: [],
};

async function fillCheckoutForm() {
  fireEvent.click(screen.getByRole("button", { name: /pickup date/i }));

  // The calendar is a next/dynamic import (loaded on demand, see C3), so it
  // isn't in the DOM yet on the tick the popover opens — poll until its day
  // buttons actually mount rather than a one-shot findAllByRole, which would
  // resolve as soon as any button exists (e.g. the trigger itself).
  const firstEnabledDay = await waitFor(() => {
    const day = screen
      .getAllByRole("button")
      .find(
        (button) =>
          button.hasAttribute("data-day") && !button.hasAttribute("disabled"),
      );
    if (!day) throw new Error("Calendar has not finished loading yet");
    return day;
  });
  fireEvent.click(firstEnabledDay);

  const slotButton = await screen.findByRole("button", { name: "23:59" });
  fireEvent.click(slotButton);

  fireEvent.change(screen.getByLabelText(/full name/i), {
    target: { value: "Jane Doe" },
  });
  fireEvent.change(screen.getByLabelText(/^email$/i), {
    target: { value: "jane@example.com" },
  });
  fireEvent.change(screen.getByLabelText(/phone/i), {
    target: { value: "5551234567" },
  });
}

describe("CheckoutForm double-submit protection", () => {
  beforeEach(() => {
    pushMock.mockClear();
    clearCartMock.mockClear();
    createOrderActionMock.mockReset();
    createOrderActionMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(
            () => resolve({ success: true, data: { id: "order-1" } }),
            20,
          );
        }),
    );
  });

  it("only places one order when the submit button is clicked twice rapidly", async () => {
    render(<CheckoutForm settings={settings} orderCounts={{}} />);
    await fillCheckoutForm();

    const submitButton = screen.getByRole("button", { name: /place order/i });
    fireEvent.click(submitButton);
    fireEvent.click(submitButton);

    await waitFor(() => expect(pushMock).toHaveBeenCalledTimes(1));

    expect(createOrderActionMock).toHaveBeenCalledTimes(1);
  });

  it("reuses the same order id for the whole component lifetime", async () => {
    render(<CheckoutForm settings={settings} orderCounts={{}} />);
    await fillCheckoutForm();

    fireEvent.click(screen.getByRole("button", { name: /place order/i }));

    await waitFor(() =>
      expect(createOrderActionMock).toHaveBeenCalledTimes(1),
    );

    const [payload] = createOrderActionMock.mock.calls[0] as [
      { id: string },
    ];
    expect(payload.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  it("passes the cart's raw numeric price straight through, not a formatted string", async () => {
    render(<CheckoutForm settings={settings} orderCounts={{}} />);
    await fillCheckoutForm();

    fireEvent.click(screen.getByRole("button", { name: /place order/i }));

    await waitFor(() =>
      expect(createOrderActionMock).toHaveBeenCalledTimes(1),
    );

    // Order summary renders both the line item and the total from the same
    // numeric `price`/`subtotal` the cart context provides — asserting both
    // guards against a future formatPrice refactor leaking into the payload.
    expect(screen.getAllByText("$8.00")).toHaveLength(2);
  });
});
