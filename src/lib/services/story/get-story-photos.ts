import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

export type StoryPhoto = Database["public"]["Tables"]["homepage_photos"]["Row"];

export interface StoryPhotos {
  hero: StoryPhoto | null;
  beat1: StoryPhoto | null;
  beat2: StoryPhoto | null;
  beat3: StoryPhoto | null;
}

const STORY_SECTIONS = [
  "story_hero",
  "story_beat_1",
  "story_beat_2",
  "story_beat_3",
] as const;

export async function getStoryPhotos(): Promise<StoryPhotos> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("homepage_photos")
    .select("*")
    .in("section", STORY_SECTIONS)
    .order("display_order", { ascending: true });

  if (error) {
    throw new Error(`Failed to load story photos: ${error.message}`);
  }

  return {
    hero: data.find((photo) => photo.section === "story_hero") ?? null,
    beat1: data.find((photo) => photo.section === "story_beat_1") ?? null,
    beat2: data.find((photo) => photo.section === "story_beat_2") ?? null,
    beat3: data.find((photo) => photo.section === "story_beat_3") ?? null,
  };
}
