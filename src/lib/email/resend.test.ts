import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const sendMock = vi.fn();

vi.mock("resend", () => ({
  Resend: class {
    emails = { send: (...args: unknown[]) => sendMock(...args) };
  },
}));

const { sendCustomerReceipt, sendOwnerAlert } = await import("./resend");

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

    await sendCustomerReceipt(ORDER, "Your Neighbour", "owner@example.com");

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
      sendCustomerReceipt(ORDER, "Your Neighbour", "owner@example.com"),
    ).rejects.toThrow(/RESEND_FROM_EMAIL is not set/);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("guards the owner alert too, not just the customer receipt", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("RESEND_FROM_EMAIL", "");

    await expect(sendOwnerAlert(ORDER, "owner@example.com")).rejects.toThrow(
      /RESEND_FROM_EMAIL is not set/,
    );
  });

  it("falls back to the sandbox sender outside production", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("RESEND_FROM_EMAIL", "");

    await sendCustomerReceipt(ORDER, "Your Neighbour", "owner@example.com");

    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({ from: expect.stringContaining("onboarding@resend.dev") }),
    );
  });

  it("addresses each email to the right recipient", async () => {
    vi.stubEnv("RESEND_FROM_EMAIL", "orders@example.com");

    await sendCustomerReceipt(ORDER, "Your Neighbour", "owner@example.com");
    await sendOwnerAlert(ORDER, "owner@example.com");

    expect(sendMock.mock.calls[0][0]).toMatchObject({ to: "jane@example.com" });
    expect(sendMock.mock.calls[1][0]).toMatchObject({ to: "owner@example.com" });
  });

  it("sets reply-to on the customer receipt, since the sending subdomain has no inbox behind it", async () => {
    vi.stubEnv("RESEND_FROM_EMAIL", "orders@send.example.com");

    await sendCustomerReceipt(ORDER, "Your Neighbour", "hello@example.com");

    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({ replyTo: "hello@example.com" }),
    );
  });

  it("omits reply-to on the customer receipt when no contact email is configured", async () => {
    vi.stubEnv("RESEND_FROM_EMAIL", "orders@send.example.com");

    await sendCustomerReceipt(ORDER, "Your Neighbour", "");

    expect(sendMock).toHaveBeenCalledWith(
      expect.not.objectContaining({ replyTo: expect.anything() }),
    );
  });

  it("sets reply-to on the owner alert to the owner's own address", async () => {
    vi.stubEnv("RESEND_FROM_EMAIL", "orders@send.example.com");

    await sendOwnerAlert(ORDER, "owner@example.com");

    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({ replyTo: "owner@example.com" }),
    );
  });
});
