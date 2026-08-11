import { z } from "zod";

export const heroPhotoInputSchema = z.object({
  imageUrl: z.string().min(1, "Photo is required"),
  altText: z.string().nullable(),
});

export const galleryPhotoInputSchema = z.object({
  imageUrl: z.string().min(1, "Photo is required"),
  altText: z.string().nullable(),
  displayOrder: z.coerce.number().int().min(0),
});

export const galleryPhotoAltInputSchema = z.object({
  altText: z.string().nullable(),
});

export const galleryPhotoReorderInputSchema = z.object({
  orderedIds: z.array(z.string().min(1)).min(1),
});
