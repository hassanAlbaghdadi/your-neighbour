import "server-only";
import { createClient } from "@/lib/supabase/server";

export type StorySingleSection =
  | "story_hero"
  | "story_beat_1"
  | "story_beat_2"
  | "story_beat_3";

export class StoryPhotoError extends Error {}

// Each single-slot section holds at most one row: setting a new photo
// replaces whatever was there, same delete-then-insert pattern as the
// homepage hero slot.
export async function setSingleSectionPhoto(
  section: StorySingleSection,
  imageUrl: string,
  altText: string | null,
): Promise<void> {
  const supabase = await createClient();

  const { error: deleteError } = await supabase
    .from("homepage_photos")
    .delete()
    .eq("section", section);
  if (deleteError) {
    throw new StoryPhotoError(`Failed to replace photo: ${deleteError.message}`);
  }

  const { error: insertError } = await supabase.from("homepage_photos").insert({
    section,
    image_url: imageUrl,
    alt_text: altText,
    display_order: 0,
  });
  if (insertError) {
    throw new StoryPhotoError(`Failed to set photo: ${insertError.message}`);
  }
}

export async function clearSingleSectionPhoto(
  section: StorySingleSection,
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("homepage_photos").delete().eq("section", section);
  if (error) {
    throw new StoryPhotoError(`Failed to clear photo: ${error.message}`);
  }
}
