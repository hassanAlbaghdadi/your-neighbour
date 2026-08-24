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

export const checkoutFormSchema = z.object({
  customerName: z.string().min(2, "Enter your full name").max(100),
  customerEmail: z.string().email("Enter a valid email address"),
  customerPhone: phoneField,
  pickupDate: z.string().min(1, "Choose a pickup date"),
  pickupTime: z.string().min(1, "Choose a pickup time"),
  notes: z.string().max(500).optional().or(z.literal("")),
});

export const createOrderInputSchema = checkoutFormSchema.extend({
  id: z.string().uuid(),
  items: z.array(orderItemSchema).min(1, "Your cart is empty"),
});

export type CheckoutFormValues = z.infer<typeof checkoutFormSchema>;
export type CreateOrderInput = z.infer<typeof createOrderInputSchema>;

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
