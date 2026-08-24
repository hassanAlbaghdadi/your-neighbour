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

const openCartMock = vi.fn();

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
        imageUrl: null,
      },
    ],
    itemCount: 1,
    subtotal: 8,
    clearCart: clearCartMock,
    openCart: openCartMock,
  }),
}));

vi.mock("@/app/actions/orders", () => ({
  createOrderAction: (...args: unknown[]) => createOrderActionMock(...args),
}));

// The form remembers a returning customer's contact details in
// localStorage, so a test that places an order leaves the next one's form
// pre-filled and passing validation it was written to fail. Cleared between
// every test rather than only in the suites that care, because the leak is
// silent: the form just submits, and the failure surfaces as a mock
// returning undefined several tests later.
beforeEach(() => {
  window.localStorage.clear();
});

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
    // Longer than the 1s default: this is waiting on a real dynamic import
    // (next/dynamic, so the calendar stays out of checkout's first chunk),
    // and under a full parallel test run that module resolution has been
    // seen to take longer than a second.
  }, { timeout: 5000 });
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

    // Order summary renders the figure from the same numeric
    // `price`/`subtotal` the cart context provides — asserting it guards
    // against a future formatPrice refactor leaking into the payload. Three
    // surfaces now: the line item, the total, and the mobile disclosure row
    // that keeps the total visible while the itemised list is collapsed.
    expect(screen.getAllByText("$8.00")).toHaveLength(3);
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
    // The hint's whole job is to answer "can I get this in time?" and "why
    // can't I pick today?" before the picker is opened, so it has to name the
    // same day the calendar will actually accept -- it runs the real status
    // resolver rather than re-deriving the rules. A hint that disagreed with
    // the picker underneath it would be worse than no hint.
    render(<CheckoutForm settings={settings} orderCounts={{}} />);

    const hint = screen.getByText(/earliest pickup is/i);
    const named = hint.textContent!.match(
      /Earliest pickup is (\w{3}), (\w{3}) (\d+)/,
    );
    expect(named).not.toBeNull();
    const [, weekday, month, dayOfMonth] = named!;

    fireEvent.click(screen.getByRole("button", { name: /pickup date/i }));
    const day = await waitFor(() => {
      const d = screen
        .getAllByRole("button")
        .find((b) => b.hasAttribute("data-day") && !b.hasAttribute("disabled"));
      if (!d) throw new Error("calendar not ready");
      return d;
    }, { timeout: 5000 });

    // react-day-picker labels a day "Monday, August 24th, 2026", and prefixes
    // "Today, " when it is the current date -- hence contains rather than
    // startsWith. The hint abbreviates ("Mon, Aug 24"), so comparing all
    // three parts is what actually pins the two to the same date; the old
    // assertion only checked the hint had matched its own regex, which it
    // cannot fail to do.
    const label = day.getAttribute("aria-label") ?? "";
    expect(label).toContain(weekday);
    expect(label).toContain(month);
    expect(label).toMatch(new RegExp(`\\b${dayOfMonth}(st|nd|rd|th)\\b`));
  });

  it("gives the reason for the wait without quoting the lead-time setting", async () => {
    // minAdvanceHours is owner-configurable, so copy that interpolated it had
    // to stay accurate through a settings change. Naming the cause instead of
    // the number also frames the wait as why someone is buying here rather
    // than as a restriction.
    render(<CheckoutForm settings={settings} orderCounts={{}} />);

    const hint = screen.getByText(/earliest pickup is/i);
    expect(hint).toHaveTextContent("everything’s baked to order");
    expect(hint).not.toHaveTextContent(/hours/i);
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
    // Longer than the 1s default: this is waiting on a real dynamic import
    // (next/dynamic, so the calendar stays out of checkout's first chunk),
    // and under a full parallel test run that module resolution has been
    // seen to take longer than a second.
  }, { timeout: 5000 });
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

describe("CheckoutForm error state", () => {
  beforeEach(() => {
    createOrderActionMock.mockReset();
  });

  async function submitAndSettle() {
    fireEvent.click(screen.getByRole("button", { name: /continue to payment/i }));
    await waitFor(() =>
      expect(screen.getAllByRole("alert").length).toBeGreaterThan(0),
    );
  }

  it("clears the pickup date error once a date is chosen", async () => {
    // setValue() without { shouldValidate: true } leaves the message on
    // screen forever: the field reads "August 26th, 2026" with "Choose a
    // pickup date" in red underneath it, and nothing the customer can do
    // removes it. react-hook-form's reValidateMode only covers inputs it
    // registered, and the date trigger is a button.
    render(<CheckoutForm settings={settings} orderCounts={{}} />);
    await submitAndSettle();
    expect(screen.getByText("Choose a pickup date")).toBeInTheDocument();

    await pickDate();

    await waitFor(() =>
      expect(screen.queryByText("Choose a pickup date")).not.toBeInTheDocument(),
    );
  });

  it("clears the pickup time error once a time is chosen", async () => {
    render(<CheckoutForm settings={settings} orderCounts={{}} />);
    await pickDate();
    await submitAndSettle();
    expect(screen.getByText("Choose a pickup time")).toBeInTheDocument();

    fireEvent.click(await screen.findByRole("button", { name: "11:59 PM" }));

    await waitFor(() =>
      expect(screen.queryByText("Choose a pickup time")).not.toBeInTheDocument(),
    );
  });

  it("marks invalid fields with aria-invalid and points them at their message", async () => {
    // register() sets neither, which left input.tsx's own
    // aria-invalid:border-destructive styling as dead code — an invalid
    // field looked exactly like a valid one — and left the error text
    // unassociated, so focusing the field announced nothing about it.
    render(<CheckoutForm settings={settings} orderCounts={{}} />);
    await submitAndSettle();

    const email = screen.getByLabelText(/^email$/i);
    expect(email).toHaveAttribute("aria-invalid", "true");

    const describedBy = email.getAttribute("aria-describedby");
    expect(describedBy).toBe("customerEmail-error");
    expect(document.getElementById(describedBy!)).toHaveTextContent(
      "Enter a valid email address",
    );
  });

  it("drops aria-invalid again once the field is corrected", async () => {
    render(<CheckoutForm settings={settings} orderCounts={{}} />);
    await submitAndSettle();

    const email = screen.getByLabelText(/^email$/i);
    fireEvent.change(email, { target: { value: "jane@example.com" } });

    await waitFor(() => expect(email).toHaveAttribute("aria-invalid", "false"));
    expect(email).not.toHaveAttribute("aria-describedby");
  });

  it("lands a server rejection on the field it names, and keeps it there", async () => {
    // "That pickup date is fully booked" used to arrive as a toast: detached
    // from the control at fault, and gone before a customer on a phone had
    // finished reading it.
    createOrderActionMock.mockResolvedValue({
      success: false,
      error: "That pickup date is fully booked. Please choose another day.",
      field: "pickupDate",
    });

    render(<CheckoutForm settings={settings} orderCounts={{}} />);
    await fillCheckoutForm();
    fireEvent.click(screen.getByRole("button", { name: /continue to payment/i }));

    const message = await screen.findByText(/fully booked/i);
    expect(message).toBeInTheDocument();
    // Against the date control, not floating somewhere else on the page.
    expect(screen.getByRole("button", { name: /pickup date/i })).toHaveAttribute(
      "aria-describedby",
      "pickupDate-error",
    );
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: /pickup date/i }),
    );
  });

  it("shows a form-level alert when the rejection belongs to no single field", async () => {
    // Rate limits and Stripe outages have nothing to point at, so they go
    // above the submit button rather than being attached to an arbitrary
    // control.
    createOrderActionMock.mockResolvedValue({
      success: false,
      error: "That's a lot of orders in a short time.",
    });

    render(<CheckoutForm settings={settings} orderCounts={{}} />);
    await fillCheckoutForm();
    fireEvent.click(screen.getByRole("button", { name: /continue to payment/i }));

    expect(await screen.findByText(/a lot of orders/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^email$/i)).toHaveAttribute(
      "aria-invalid",
      "false",
    );
  });
});

describe("CheckoutForm remembered customer", () => {
  const STORAGE_KEY = "your-neighbour-customer";

  beforeEach(() => {
    createOrderActionMock.mockReset();
  });

  it("pre-fills contact details from a previous order", async () => {
    // A repeat-purchase bakery on a 48-hour pre-order model lives on return
    // customers, and browser autofill is unreliable in the in-app browsers
    // Instagram traffic arrives in.
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        customerName: "Jane Doe",
        customerEmail: "jane@example.com",
        customerPhone: "9025550123",
      }),
    );

    render(<CheckoutForm settings={settings} orderCounts={{}} />);

    await waitFor(() =>
      expect(screen.getByLabelText(/full name/i)).toHaveValue("Jane Doe"),
    );
    expect(screen.getByLabelText(/^email$/i)).toHaveValue("jane@example.com");
    expect(screen.getByLabelText(/phone/i)).toHaveValue("9025550123");
  });

  it("lets someone else on the same phone clear them", async () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        customerName: "Jane Doe",
        customerEmail: "jane@example.com",
        customerPhone: "9025550123",
      }),
    );

    render(<CheckoutForm settings={settings} orderCounts={{}} />);
    await waitFor(() =>
      expect(screen.getByLabelText(/full name/i)).toHaveValue("Jane Doe"),
    );

    fireEvent.click(screen.getByRole("button", { name: /not you/i }));

    expect(screen.getByLabelText(/full name/i)).toHaveValue("");
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("ignores a stored shape it doesn't recognise", async () => {
    // A record written by an older build should be treated as absent, not
    // spread into the form as undefined values.
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ name: "Jane" }));

    render(<CheckoutForm settings={settings} orderCounts={{}} />);

    expect(screen.getByLabelText(/full name/i)).toHaveValue("");
    expect(screen.queryByText(/filled in from your last order/i)).toBeNull();
  });

  it("only remembers someone after an order is actually accepted", async () => {
    createOrderActionMock.mockResolvedValue({
      success: false,
      error: "That pickup date is fully booked.",
      field: "pickupDate",
    });

    render(<CheckoutForm settings={settings} orderCounts={{}} />);
    await fillCheckoutForm();
    fireEvent.click(screen.getByRole("button", { name: /continue to payment/i }));

    await screen.findByText(/fully booked/i);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});
