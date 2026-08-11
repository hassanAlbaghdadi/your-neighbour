import { z } from "zod";

// Hand-baked, made-to-order capacity — not a stock limit. Keeps a single
// runaway line item from silently blowing past what maxOrdersPerDay is
// meant to protect (that cap counts orders, not units).
export const MAX_ITEM_QUANTITY = 20;

export const orderItemSchema = z.object({
  variantId: z.string().uuid(),
  quantity: z.number().int().min(1).max(MAX_ITEM_QUANTITY, `Max ${MAX_ITEM_QUANTITY} per item — contact us for larger orders`),
});

export const checkoutFormSchema = z.object({
  customerName: z.string().min(2, "Enter your full name").max(100),
  customerEmail: z.string().email("Enter a valid email address"),
  customerPhone: z.string().min(10, "Enter a valid phone number").max(20),
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
