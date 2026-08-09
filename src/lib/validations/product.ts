import { z } from "zod";

export const productFormSchema = z.object({
  name: z.string().min(1, "Required").max(200),
  slug: z.string().min(1, "Required").regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers, and hyphens only"),
  categoryId: z.string().uuid().nullable(),
  description: z.string().max(1000).optional().or(z.literal("")),
  price: z.coerce.number().min(0, "Must be 0 or more"),
  isAvailable: z.boolean(),
  preparationNotice: z.string().max(300).optional().or(z.literal("")),
  allergens: z.string().max(300).optional().or(z.literal("")),
  displayOrder: z.coerce.number().int().min(0),
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
