import { z } from "zod";

export const productVariantFormSchema = z.object({
  id: z.string().uuid().optional(),
  label: z.string().min(1, "Required").max(100),
  price: z.coerce.number().min(0, "Must be 0 or more"),
  imageUrl: z.string().url().nullable(),
  isAvailable: z.boolean(),
  displayOrder: z.coerce.number().int().min(0),
});

export type ProductVariantFormValues = z.output<typeof productVariantFormSchema>;
export type ProductVariantFormInput = z.input<typeof productVariantFormSchema>;

export const productFormSchema = z.object({
  name: z.string().min(1, "Required").max(200),
  slug: z.string().min(1, "Required").regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers, and hyphens only"),
  categoryId: z.string().uuid().nullable(),
  imageUrl: z.string().url().nullable(),
  // 130 is a safety margin under the measured truncation point of the product
  // card's line-clamp-3 description (143 chars on mobile, 144 on desktop —
  // mobile is the tighter constraint since its card is narrower than a
  // 3-column desktop grid cell). Past this, the card silently cuts off text.
  description: z.string().max(130, "Keep it under 130 characters — longer text gets cut off on the product card").optional().or(z.literal("")),
  isAvailable: z.boolean(),
  preparationNotice: z.string().max(300).optional().or(z.literal("")),
  allergens: z.string().max(300).optional().or(z.literal("")),
  displayOrder: z.coerce.number().int().min(0),
  variants: z.array(productVariantFormSchema).min(1, "Add at least one size"),
});

export type ProductFormValues = z.output<typeof productFormSchema>;
export type ProductFormInput = z.input<typeof productFormSchema>;

export const productReorderInputSchema = z.object({
  orderedIds: z.array(z.string().uuid()).min(1),
});

export const categoryFormSchema = z.object({
  name: z.string().min(1, "Required").max(200),
  slug: z.string().min(1, "Required").regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers, and hyphens only"),
  displayOrder: z.coerce.number().int().min(0),
});

export type CategoryFormValues = z.output<typeof categoryFormSchema>;
export type CategoryFormInput = z.input<typeof categoryFormSchema>;
