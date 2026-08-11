import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

export interface GalleryPhotoInput {
  imageUrl: string;
  altText: string | null;
  displayOrder: number;
}

export class HomepagePhotoError extends Error {}

// Hero is a single slot: setting a new one replaces whatever was there.
export async function setHeroPhoto(
  imageUrl: string,
  altText: string | null,
): Promise<void> {
  const supabase = await createClient();

  const { error: deleteError } = await supabase
    .from("homepage_photos")
    .delete()
    .eq("section", "hero");
  if (deleteError) {
    throw new HomepagePhotoError(`Failed to replace hero photo: ${deleteError.message}`);
  }

  const { error: insertError } = await supabase.from("homepage_photos").insert({
    section: "hero",
    image_url: imageUrl,
    alt_text: altText,
    display_order: 0,
  });
  if (insertError) {
    throw new HomepagePhotoError(`Failed to set hero photo: ${insertError.message}`);
  }
}

export async function clearHeroPhoto(): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("homepage_photos").delete().eq("section", "hero");
  if (error) {
    throw new HomepagePhotoError(`Failed to clear hero photo: ${error.message}`);
  }
}

export async function addGalleryPhoto(
  input: GalleryPhotoInput,
): Promise<{ id: string; createdAt: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("homepage_photos")
    .insert({
      section: "gallery",
      image_url: input.imageUrl,
      alt_text: input.altText,
      display_order: input.displayOrder,
    })
    .select("id, created_at")
    .single();
  if (error || !data) {
    throw new HomepagePhotoError(`Failed to add photo: ${error?.message}`);
  }
  return { id: data.id, createdAt: data.created_at };
}

export async function updateGalleryPhoto(
  id: string,
  input: Partial<GalleryPhotoInput>,
): Promise<void> {
  const supabase = await createClient();
  const row: Database["public"]["Tables"]["homepage_photos"]["Update"] = {
    ...(input.imageUrl !== undefined && { image_url: input.imageUrl }),
    ...(input.altText !== undefined && { alt_text: input.altText }),
    ...(input.displayOrder !== undefined && { display_order: input.displayOrder }),
  };

  const { error } = await supabase.from("homepage_photos").update(row).eq("id", id);
  if (error) {
    throw new HomepagePhotoError(`Failed to update photo: ${error.message}`);
  }
}

export async function deleteGalleryPhoto(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("homepage_photos").delete().eq("id", id);
  if (error) {
    throw new HomepagePhotoError(`Failed to remove photo: ${error.message}`);
  }
}

export async function reorderGalleryPhotos(orderedIds: string[]): Promise<void> {
  const supabase = await createClient();
  await Promise.all(
    orderedIds.map((id, index) =>
      supabase.from("homepage_photos").update({ display_order: index }).eq("id", id),
    ),
  );
}
