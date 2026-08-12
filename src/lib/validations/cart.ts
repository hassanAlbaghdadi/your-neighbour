import { z } from "zod";

// Mirrors src/types/cart.ts's CartItem shape. Kept as a separate schema
// rather than deriving CartItem from it — CartItem is imported broadly
// across the app, so coupling it to the validation layer is a bigger
// change than this fix needs.
export const cartItemSchema = z.object({
  productId: z.string(),
  variantId: z.string(),
  name: z.string(),
  variantLabel: z.string(),
  slug: z.string(),
  price: z.number(),
  quantity: z.number(),
  imageUrl: z.string().nullable().optional(),
});

export const cartItemsSchema = z.array(cartItemSchema);
