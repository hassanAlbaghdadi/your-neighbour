import { describe, it, expect } from "vitest";
import { createOrderInputSchema } from "./order";

const base = {
  id: "11111111-1111-4111-8111-111111111111",
  customerName: "Jane Doe",
  customerEmail: "jane@example.com",
  customerPhone: "5551234567",
  pickupDate: "2026-08-20",
  pickupTime: "10:00",
  items: [{ variantId: "22222222-2222-4222-8222-222222222222", quantity: 1 }],
};

describe("createOrderInputSchema fulfilment", () => {
  it("reads a payload with no method as a pickup", () => {
    // A checkout page left open across the deploy that added delivery.
    const parsed = createOrderInputSchema.parse(base);
    expect(parsed.fulfillmentMethod).toBe("pickup");
  });

  it("requires an address for a delivery", () => {
    const result = createOrderInputSchema.safeParse({
      ...base,
      fulfillmentMethod: "delivery",
      deliveryAddress: "   ",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["deliveryAddress"]);
  });

  it("accepts a delivery with an address", () => {
    const result = createOrderInputSchema.safeParse({
      ...base,
      fulfillmentMethod: "delivery",
      deliveryAddress: "2145 Gottingen St, Halifax",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a method it doesn't know", () => {
    const result = createOrderInputSchema.safeParse({
      ...base,
      fulfillmentMethod: "drone",
    });
    expect(result.success).toBe(false);
  });
});
