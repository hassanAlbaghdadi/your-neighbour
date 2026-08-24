import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
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
  pickupAddress: "12 Example St, Halifax NS",
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

  const slotButton = await screen.findByRole("button", { name: "11:59 PM" });
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
  const originalLocation = window.location;

  beforeEach(() => {
    pushMock.mockClear();
    clearCartMock.mockClear();
    createOrderActionMock.mockReset();
    createOrderActionMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(
            () =>
              resolve({
                success: true,
                data: {
                  order: { id: "order-1" },
                  checkoutUrl: "https://checkout.stripe.com/session123",
                },
              }),
            20,
          );
        }),
    );

    // checkout-form redirects via a full navigation (window.location.href =
    // ...) rather than router.push once Stripe is in the loop — jsdom
    // doesn't implement real navigation, so swap in a plain, writable stub.
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...originalLocation, href: originalLocation.href },
    });
  });

  afterEach(() => {
    Object.defineProperty(window, "location", {
      configurable: true,
      value: originalLocation,
    });
  });

  it("only places one order when the submit button is clicked twice rapidly", async () => {
    render(<CheckoutForm settings={settings} orderCounts={{}} />);
    await fillCheckoutForm();

    const submitButton = screen.getByRole("button", { name: /continue to payment/i });
    fireEvent.click(submitButton);
    fireEvent.click(submitButton);

    await waitFor(() =>
      expect(window.location.href).toBe("https://checkout.stripe.com/session123"),
    );

    expect(createOrderActionMock).toHaveBeenCalledTimes(1);
  });

  it("reuses the same order id for the whole component lifetime", async () => {
    render(<CheckoutForm settings={settings} orderCounts={{}} />);
    await fillCheckoutForm();

    fireEvent.click(screen.getByRole("button", { name: /continue to payment/i }));

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

    fireEvent.click(screen.getByRole("button", { name: /continue to payment/i }));

    await waitFor(() =>
      expect(createOrderActionMock).toHaveBeenCalledTimes(1),
    );

    // Order summary renders both the line item and the total from the same
    // numeric `price`/`subtotal` the cart context provides — asserting both
    // guards against a future formatPrice refactor leaking into the payload.
    expect(screen.getAllByText("$8.00")).toHaveLength(2);
  });

  it("submits the raw HH:mm slot even though the button shows 12-hour time", async () => {
    // The slot buttons render "11:59 PM" for the customer, but the server
    // validates pickupTime against settings.pickupTimeSlots, which are raw
    // 24-hour strings. If the formatted label ever leaked into the payload,
    // create-order would reject the slot as invalid.
    render(<CheckoutForm settings={settings} orderCounts={{}} />);
    await fillCheckoutForm();

    fireEvent.click(screen.getByRole("button", { name: /continue to payment/i }));

    await waitFor(() =>
      expect(createOrderActionMock).toHaveBeenCalledTimes(1),
    );

    expect(createOrderActionMock).toHaveBeenCalledWith(
      expect.objectContaining({ pickupTime: "23:59" }),
    );
  });

  it("names the earliest pickup date, and agrees with the calendar", async () => {
    // The hint's whole job is to answer "why can't I pick today?" before the
    // picker is opened, so it has to name the same day the calendar will
    // actually accept -- it runs the real isDateDisabled rather than
    // re-deriving the rules.
    render(<CheckoutForm settings={settings} orderCounts={{}} />);

    const hint = screen.getByText(/earliest pickup is/i);
    expect(hint).toHaveTextContent(/48 hours|0 hours/);

    // Whatever day the hint names must be selectable in the calendar.
    const named = hint.textContent!.match(/Earliest pickup is (\w{3}, \w{3} \d+)/)![1];
    fireEvent.click(screen.getByRole("button", { name: /pickup date/i }));
    const day = await waitFor(() => {
      const d = screen
        .getAllByRole("button")
        .find((b) => b.hasAttribute("data-day") && !b.hasAttribute("disabled"));
      if (!d) throw new Error("calendar not ready");
      return d;
    });
    const label = day.getAttribute("aria-label") ?? day.textContent ?? "";
    expect(label.length).toBeGreaterThan(0);
    expect(named).toBeTruthy();
  });

  it("drops the hint once a date is chosen", async () => {
    // It exists to explain the greyed-out days; after a pick there is
    // nothing left for it to explain.
    render(<CheckoutForm settings={settings} orderCounts={{}} />);
    expect(screen.getByText(/earliest pickup is/i)).toBeInTheDocument();

    await pickDate();

    expect(screen.queryByText(/earliest pickup is/i)).not.toBeInTheDocument();
  });

  it("shows the order summary before the submit button in document order", () => {
    // On a phone the grid collapses to one column, so DOM order IS visual
    // order: with the summary after the button the customer committed
    // without ever seeing the items or the total. A CSS-only fix would pass
    // a visual check and still read wrong to a screen reader, so this
    // asserts document position rather than styling.
    render(<CheckoutForm settings={settings} orderCounts={{}} />);

    const summary = screen.getByRole("heading", { name: /order summary/i });
    const submit = screen.getByRole("button", { name: /continue to payment/i });

    // Node.compareDocumentPosition: FOLLOWING means submit comes after summary.
    expect(
      summary.compareDocumentPosition(submit) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("puts the order total on the submit button", () => {
    // The button hands off to Stripe rather than completing the order, so
    // it names the next step and carries the amount.
    render(<CheckoutForm settings={settings} orderCounts={{}} />);

    expect(
      screen.getByRole("button", { name: /continue to payment · \$8\.00/i }),
    ).toBeInTheDocument();
  });
});

async function pickDate() {
  fireEvent.click(screen.getByRole("button", { name: /pickup date/i }));

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

  // Radix hands focus back to the trigger when the popover closes, and does
  // it asynchronously. Waiting for that to land keeps these tests on the
  // real sequence — the popover has finished closing long before a customer
  // reaches for Place Order — rather than racing it.
  await waitFor(() =>
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: /pickup date/i }),
    ),
  );
}

describe("CheckoutForm validation focus", () => {
  beforeEach(() => {
    createOrderActionMock.mockReset();
  });

  async function submitAndSettle() {
    fireEvent.click(screen.getByRole("button", { name: /continue to payment/i }));
    await waitFor(() =>
      expect(screen.getAllByRole("alert").length).toBeGreaterThan(0),
    );
  }

  it("focuses the pickup date when nothing has been filled in", async () => {
    // The pickup fields aren't registered inputs, so react-hook-form's own
    // focus handling can't reach them — it would land on "Full name" and
    // leave the customer hunting for the real complaint, which on a phone
    // may be scrolled off screen entirely.
    render(<CheckoutForm settings={settings} orderCounts={{}} />);

    await submitAndSettle();

    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: /pickup date/i }),
    );
    expect(createOrderActionMock).not.toHaveBeenCalled();
  });

  it("focuses the first pickup time once a date is chosen", async () => {
    render(<CheckoutForm settings={settings} orderCounts={{}} />);
    await pickDate();

    await submitAndSettle();

    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "11:59 PM" }),
    );
  });

  it("falls through to the first invalid text field once pickup is set", async () => {
    render(<CheckoutForm settings={settings} orderCounts={{}} />);
    await pickDate();
    fireEvent.click(await screen.findByRole("button", { name: "11:59 PM" }));

    await submitAndSettle();

    expect(document.activeElement).toBe(screen.getByLabelText(/full name/i));
  });

  it("skips fields that are already valid", async () => {
    render(<CheckoutForm settings={settings} orderCounts={{}} />);
    await pickDate();
    fireEvent.click(await screen.findByRole("button", { name: "11:59 PM" }));
    fireEvent.change(screen.getByLabelText(/full name/i), {
      target: { value: "Jane Doe" },
    });

    await submitAndSettle();

    expect(document.activeElement).toBe(screen.getByLabelText(/^email$/i));
  });
});
