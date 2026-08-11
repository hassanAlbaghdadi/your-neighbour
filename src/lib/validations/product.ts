import { z } from "zod";

export const productVariantFormSchema = z.object({
  id: z.string().uuid().optional(),
  label: z.string().min(1, "Required").max(100),
  price: z.coerce.number().min(0, "Must be 0 or more"),
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
  description: z.string().max(1000).optional().or(z.literal("")),
  isAvailable: z.boolean(),
  preparationNotice: z.string().max(300).optional().or(z.literal("")),
  allergens: z.string().max(300).optional().or(z.literal("")),
  displayOrder: z.coerce.number().int().min(0),
  variants: z.array(productVariantFormSchema).min(1, "Add at least one size"),
});

export type ProductFormValues = z.output<typeof productFormSchema>;
export type ProductFormInput = z.input<typeof productFormSchema>;

export const categoryFormSchema = z.object({
  name: z.string().min(1, "Required").max(200),
  slug: z.string().min(1, "Required").regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers, and hyphens only"),
  displayOrder: z.coerce.number().int().min(0),
});

export type CategoryFormValues = z.output<typeof categoryFormSchema>;
export type CategoryFormInput = z.input<typeof categoryFormSchema>;
