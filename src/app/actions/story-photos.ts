"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/require-admin";
import { storySinglePhotoInputSchema } from "@/lib/validations/story-photo";
import {
  setSingleSectionPhoto,
  clearSingleSectionPhoto,
  StoryPhotoError,
  type StorySingleSection,
} from "@/lib/services/story/manage-story-photos";
import type { ActionResult } from "@/types/action-result";

function revalidateStoryPaths() {
  revalidatePath("/admin/our-story");
  revalidatePath("/our-story");
}

export async function setStorySinglePhotoAction(
  section: StorySingleSection,
  imageUrl: string,
  altText: string | null,
): Promise<ActionResult> {
  if (!(await requireAdmin())) return { success: false, error: "Unauthorized" };

  const parsed = storySinglePhotoInputSchema.safeParse({ section, imageUrl, altText });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid photo." };
  }

  try {
    await setSingleSectionPhoto(parsed.data.section, parsed.data.imageUrl, parsed.data.altText);
    revalidateStoryPaths();
    return { success: true };
  } catch (error) {
    if (error instanceof StoryPhotoError) return { success: false, error: error.message };
    console.error("setStorySinglePhotoAction failed:", error);
    return { success: false, error: "Failed to set photo." };
  }
}

export async function clearStorySinglePhotoAction(
  section: StorySingleSection,
): Promise<ActionResult> {
  if (!(await requireAdmin())) return { success: false, error: "Unauthorized" };

  try {
    await clearSingleSectionPhoto(section);
    revalidateStoryPaths();
    return { success: true };
  } catch (error) {
    if (error instanceof StoryPhotoError) return { success: false, error: error.message };
    console.error("clearStorySinglePhotoAction failed:", error);
    return { success: false, error: "Failed to clear photo." };
  }
}
