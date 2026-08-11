import { z } from "zod";

export const orderItemSchema = z.object({
  variantId: z.string().uuid(),
  quantity: z.number().int().min(1),
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
