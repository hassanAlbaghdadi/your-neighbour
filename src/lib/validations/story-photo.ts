import { z } from "zod";

export const storySingleSections = [
  "story_hero",
  "story_beat_1",
  "story_beat_2",
] as const;

export const storyListSections = ["story_timeline", "story_gallery"] as const;

export const storySinglePhotoInputSchema = z.object({
  section: z.enum(storySingleSections),
  imageUrl: z.string().url("Enter a valid photo URL"),
  altText: z.string().nullable(),
});

export const storyListPhotoInputSchema = z.object({
  section: z.enum(storyListSections),
  imageUrl: z.string().url("Enter a valid photo URL"),
  altText: z.string().nullable(),
  displayOrder: z.coerce.number().int().min(0),
});

export const storyListPhotoAltInputSchema = z.object({
  altText: z.string().nullable(),
});

export const storyListPhotoReorderInputSchema = z.object({
  orderedIds: z.array(z.string().min(1)).min(1),
});
