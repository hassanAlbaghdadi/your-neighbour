import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { StoreSettings } from "@/lib/services/settings/get-settings";

const sendMock = vi.fn();

vi.mock("resend", () => ({
  Resend: class {
    emails = { send: (...args: unknown[]) => sendMock(...args) };
  },
}));

const { sendCustomerReceipt, sendOwnerAlert, sendPaymentFailedNotification } =
  await import("./resend");

const SETTINGS = {
  businessName: "Your Neighbour",
  contactEmail: "hello@example.com",
  pickupAddress: "12 Example St, Halifax NS",
  maxOrdersPerDay: 50,
  minAdvanceHours: 48,
  pickupTimeSlots: ["09:00"],
  blackoutDates: [],
} satisfies StoreSettings;

const ORDER = {
  id: "11111111-1111-4111-8111-111111111111",
  customerName: "Jane Doe",
  customerEmail: "jane@example.com",
  customerPhone: "9025551234",
  pickupDate: "2026-08-25",
  pickupTime: "09:30",
  notes: null,
  subtotal: 9,
  total: 9,
  items: [
    { productName: "Classic", variantLabel: "Piece", quantity: 2, unitPrice: 4.5 },
  ],
} as unknown as Parameters<typeof sendCustomerReceipt>[0];

describe("order email sender address", () => {
  beforeEach(() => {
    sendMock.mockReset();
    sendMock.mockResolvedValue({ id: "sent" });
  });

  // Restores both NODE_ENV and RESEND_FROM_EMAIL — every stub in this file
  // goes through vi.stubEnv, so nothing needs saving by hand.
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("sends from the configured address when RESEND_FROM_EMAIL is set", async () => {
    vi.stubEnv("RESEND_FROM_EMAIL", "Your Neighbour <orders@example.com>");

    await sendCustomerReceipt(ORDER, SETTINGS);

    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({ from: "Your Neighbour <orders@example.com>" }),
    );
  });

  it("refuses to send in production without RESEND_FROM_EMAIL", async () => {
    // The whole point of the guard. The sandbox fallback can only deliver
    // to the Resend account's own address, so falling back to it in
    // production means every customer receipt is rejected — silently,
    // because a rejected send looks identical to a delivered one from
    // here. Failing loudly is what surfaces a missing env var.
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("RESEND_FROM_EMAIL", "");

    await expect(
      sendCustomerReceipt(ORDER, SETTINGS),
    ).rejects.toThrow(/RESEND_FROM_EMAIL is not set/);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("guards the owner alert too, not just the customer receipt", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("RESEND_FROM_EMAIL", "");

    await expect(sendOwnerAlert(ORDER, SETTINGS)).rejects.toThrow(
      /RESEND_FROM_EMAIL is not set/,
    );
  });

  it("falls back to the sandbox sender outside production", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("RESEND_FROM_EMAIL", "");

    await sendCustomerReceipt(ORDER, SETTINGS);

    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({ from: expect.stringContaining("onboarding@resend.dev") }),
    );
  });

  it("addresses each email to the right recipient", async () => {
    vi.stubEnv("RESEND_FROM_EMAIL", "orders@example.com");

    await sendCustomerReceipt(ORDER, SETTINGS);
    await sendOwnerAlert(ORDER, SETTINGS);

    expect(sendMock.mock.calls[0][0]).toMatchObject({ to: "jane@example.com" });
    expect(sendMock.mock.calls[1][0]).toMatchObject({ to: SETTINGS.contactEmail });
  });

  it("sets reply-to on the customer receipt, since the sending subdomain has no inbox behind it", async () => {
    vi.stubEnv("RESEND_FROM_EMAIL", "orders@send.example.com");

    await sendCustomerReceipt(ORDER, SETTINGS);

    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({ replyTo: SETTINGS.contactEmail }),
    );
  });

  it("omits reply-to on the customer receipt when no contact email is configured", async () => {
    vi.stubEnv("RESEND_FROM_EMAIL", "orders@send.example.com");

    await sendCustomerReceipt(ORDER, { ...SETTINGS, contactEmail: "" });

    expect(sendMock).toHaveBeenCalledWith(
      expect.not.objectContaining({ replyTo: expect.anything() }),
    );
  });

  it("sets reply-to on the owner alert to the owner's own address", async () => {
    vi.stubEnv("RESEND_FROM_EMAIL", "orders@send.example.com");

    await sendOwnerAlert(ORDER, SETTINGS);

    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({ replyTo: SETTINGS.contactEmail }),
    );
  });
});

describe("HTML email bodies", () => {
  beforeEach(() => {
    sendMock.mockReset();
    sendMock.mockResolvedValue({ id: "sent" });
    vi.stubEnv("RESEND_FROM_EMAIL", "Your Neighbour <orders@example.com>");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("sends both html and text on every template", async () => {
    await sendCustomerReceipt(ORDER, SETTINGS);
    await sendOwnerAlert(ORDER, SETTINGS);
    await sendPaymentFailedNotification(ORDER, SETTINGS);

    for (const call of sendMock.mock.calls) {
      expect(typeof call[0].html).toBe("string");
      expect(call[0].html.length).toBeGreaterThan(0);
      expect(typeof call[0].text).toBe("string");
      expect(call[0].text.length).toBeGreaterThan(0);
    }
  });

  it("carries the same order number the confirmation page tells customers to quote", async () => {
    await sendCustomerReceipt(ORDER, SETTINGS);
    const { html, text } = sendMock.mock.calls[0][0];

    // get-order.ts / confirmation page use `id.slice(0, 8)` — see
    // src/app/confirmation/[orderId]/page.tsx.
    const expected = ORDER.id.slice(0, 8);
    expect(html).toContain(`Order #${expected}`);
    expect(text).toContain(`Order #${expected}`);
  });

  // The name and notes fields are the only genuinely customer-supplied
  // strings that reach an email, and unlike JSX nothing escapes them
  // automatically in a hand-built HTML string. A name or note containing
  // markup must render as inert text, not be interpreted by the mail
  // client — this is the property the whole html feature depends on being
  // safe to ship at all.
  it("escapes a customer-supplied note in the html body", async () => {
    const hostileOrder = {
      ...ORDER,
      notes: "<script>alert('hi')</script>",
    } as unknown as Parameters<typeof sendCustomerReceipt>[0];

    await sendCustomerReceipt(hostileOrder, SETTINGS);
    const { html } = sendMock.mock.calls[0][0];

    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;alert(&#39;hi&#39;)&lt;/script&gt;");
  });

  // The owner alert is the one template that prints the customer's full
  // name rather than just the first word of it (the receipt's greeting
  // only ever sees customerName.split(" ")[0]), so it's the site that
  // actually exercises escaping a name containing both markup and a space.
  it("escapes a customer-supplied name in the owner alert", async () => {
    const hostileOrder = {
      ...ORDER,
      customerName: "<img src=x onerror=alert(1)> Jane",
    } as unknown as Parameters<typeof sendOwnerAlert>[0];

    await sendOwnerAlert(hostileOrder, SETTINGS);
    const { html } = sendMock.mock.calls[0][0];

    expect(html).not.toContain("<img src=x onerror=");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt; Jane");
  });

  it("escapes an admin-entered pickup address the same way", async () => {
    await sendCustomerReceipt(ORDER, {
      ...SETTINGS,
      pickupAddress: '123 Main St <b>Unit 2</b>',
    });
    const { html } = sendMock.mock.calls[0][0];

    expect(html).not.toContain("<b>Unit 2</b>");
    expect(html).toContain("&lt;b&gt;Unit 2&lt;/b&gt;");
  });

  it("includes the 'reply to this email' line on the receipt when a contact address is configured", async () => {
    await sendCustomerReceipt(ORDER, SETTINGS);
    const { html, text } = sendMock.mock.calls[0][0];

    expect(html).toMatch(/Need to change or cancel\?/);
    expect(text).toMatch(/Need to change or cancel\?/);
  });
});
