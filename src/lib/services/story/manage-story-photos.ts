import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

export type StorySingleSection = "story_hero" | "story_beat_1" | "story_beat_2";
export type StoryListSection = "story_timeline" | "story_gallery";

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

export interface ListPhotoInput {
  imageUrl: string;
  altText: string | null;
  displayOrder: number;
}

export async function addListSectionPhoto(
  section: StoryListSection,
  input: ListPhotoInput,
): Promise<{ id: string; createdAt: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("homepage_photos")
    .insert({
      section,
      image_url: input.imageUrl,
      alt_text: input.altText,
      display_order: input.displayOrder,
    })
    .select("id, created_at")
    .single();
  if (error || !data) {
    throw new StoryPhotoError(`Failed to add photo: ${error?.message}`);
  }
  return { id: data.id, createdAt: data.created_at };
}

export async function updateListSectionPhoto(
  id: string,
  input: Partial<ListPhotoInput>,
): Promise<void> {
  const supabase = await createClient();
  const row: Database["public"]["Tables"]["homepage_photos"]["Update"] = {
    ...(input.imageUrl !== undefined && { image_url: input.imageUrl }),
    ...(input.altText !== undefined && { alt_text: input.altText }),
    ...(input.displayOrder !== undefined && { display_order: input.displayOrder }),
  };

  const { error } = await supabase.from("homepage_photos").update(row).eq("id", id);
  if (error) {
    throw new StoryPhotoError(`Failed to update photo: ${error.message}`);
  }
}

export async function deleteListSectionPhoto(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("homepage_photos").delete().eq("id", id);
  if (error) {
    throw new StoryPhotoError(`Failed to remove photo: ${error.message}`);
  }
}

export async function reorderListSectionPhotos(orderedIds: string[]): Promise<void> {
  const supabase = await createClient();
  await Promise.all(
    orderedIds.map((id, index) =>
      supabase.from("homepage_photos").update({ display_order: index }).eq("id", id),
    ),
  );
}
