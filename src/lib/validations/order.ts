import { z } from "zod";

// Hand-baked, made-to-order capacity — not a stock limit. Keeps a single
// runaway line item from silently blowing past what maxOrdersPerDay is
// meant to protect (that cap counts orders, not units).
export const MAX_ITEM_QUANTITY = 20;

export const orderItemSchema = z.object({
  variantId: z.string().uuid(),
  quantity: z.number().int().min(1).max(MAX_ITEM_QUANTITY, `Max ${MAX_ITEM_QUANTITY} per item — contact us for larger orders`),
});

// Counts digits rather than characters. `min(10)` accepted "abcdefghij",
// and more usefully it *rejected* nothing a real customer types: the
// separators people actually use — "(902) 555-0123", "902-555-0123",
// "+1 902 555 0123" — all carry 10 or 11 digits inside a longer string.
// Checking the digits directly catches the typo (a dropped digit) that the
// length check waved through, without policing formatting.
const DIGITS = /\d/g;
const phoneField = z
  .string()
  .max(20, "That phone number is too long")
  .refine((value) => {
    const digits = value.match(DIGITS)?.length ?? 0;
    return digits >= 10 && digits <= 15;
  }, "Enter a valid phone number, including the area code");

export const FULFILLMENT_METHODS = ["pickup", "delivery"] as const;

const checkoutFields = z.object({
  fulfillmentMethod: z.enum(FULFILLMENT_METHODS),
  // Free text, no area check: Sarah phones anyone too far away. Only
  // required for delivery — see requireDeliveryAddress below.
  deliveryAddress: z.string().trim().max(300).optional().or(z.literal("")),
  customerName: z.string().min(2, "Enter your full name").max(100),
  customerEmail: z.string().email("Enter a valid email address"),
  customerPhone: phoneField,
  pickupDate: z.string().min(1, "Choose a pickup date"),
  pickupTime: z.string().min(1, "Choose a pickup time"),
  notes: z.string().max(500).optional().or(z.literal("")),
});

function requireDeliveryAddress(
  value: { fulfillmentMethod: string; deliveryAddress?: string },
  ctx: z.RefinementCtx,
) {
  if (value.fulfillmentMethod === "delivery" && !value.deliveryAddress?.trim()) {
    ctx.addIssue({
      code: "custom",
      path: ["deliveryAddress"],
      message: "Enter your delivery address",
    });
  }
}

export const checkoutFormSchema = checkoutFields.superRefine(
  requireDeliveryAddress,
);

export const createOrderInputSchema = checkoutFields
  .extend({
    id: z.string().uuid(),
    items: z.array(orderItemSchema).min(1, "Your cart is empty"),
    // Defaulted on the server only. A checkout page left open across the
    // deploy that added delivery sends no method at all, and that customer
    // was ordering a pickup.
    fulfillmentMethod: z.enum(FULFILLMENT_METHODS).default("pickup"),
  })
  .superRefine(requireDeliveryAddress);

export type CheckoutFormValues = z.infer<typeof checkoutFormSchema>;
// The input side: fulfillmentMethod is optional here, and processNewOrder
// treats a missing one as pickup — the same rule the schema's default
// applies.
export type CreateOrderInput = z.input<typeof createOrderInputSchema>;

/**
 * Which field a server-side rejection belongs to.
 *
 * The server runs checks the browser can't — capacity, blackout dates,
 * withdrawn time slots, items pulled from the menu — and every one of them
 * used to arrive as a toast: transient, detached from the control at fault,
 * and gone before a customer on a phone had finished reading it. Naming the
 * field lets the same message land where the mistake is, and stay there
 * until it's fixed. `null` means "nothing on this form is wrong" (rate
 * limits, Stripe outages), which belongs above the submit button instead.
 */
export type CheckoutFieldName = keyof CheckoutFormValues;
