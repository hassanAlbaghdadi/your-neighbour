import { createPublicClient } from "@/lib/supabase/public";
import type { Database } from "@/types/database";

export type HomepagePhoto = Database["public"]["Tables"]["homepage_photos"]["Row"];

export interface HomepagePhotos {
  hero: HomepagePhoto | null;
  gallery: HomepagePhoto[];
}

export async function getHomepagePhotos(): Promise<HomepagePhotos> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("homepage_photos")
    .select("*")
    .order("display_order", { ascending: true });

  if (error) {
    throw new Error(`Failed to load homepage photos: ${error.message}`);
  }

  return {
    hero: data.find((photo) => photo.section === "hero") ?? null,
    gallery: data.filter((photo) => photo.section === "gallery"),
  };
}
