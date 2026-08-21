import { z } from "zod";

export const storySingleSections = [
  "story_hero",
  "story_beat_1",
  "story_beat_2",
  "story_beat_3",
] as const;

export const storySinglePhotoInputSchema = z.object({
  section: z.enum(storySingleSections),
  imageUrl: z.string().url("Enter a valid photo URL"),
  altText: z.string().nullable(),
});
