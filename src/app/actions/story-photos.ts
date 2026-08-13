"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/require-admin";
import {
  storySinglePhotoInputSchema,
  storyListPhotoInputSchema,
  storyListPhotoAltInputSchema,
  storyListPhotoReorderInputSchema,
} from "@/lib/validations/story-photo";
import {
  setSingleSectionPhoto,
  clearSingleSectionPhoto,
  addListSectionPhoto,
  updateListSectionPhoto,
  deleteListSectionPhoto,
  reorderListSectionPhotos,
  StoryPhotoError,
  type StorySingleSection,
  type StoryListSection,
} from "@/lib/services/story/manage-story-photos";
import type { ActionResult } from "@/types/action-result";

type AddPhotoResult = ActionResult<{ id: string; createdAt: string }>;

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

export async function addStoryListPhotoAction(
  section: StoryListSection,
  imageUrl: string,
  altText: string | null,
  displayOrder: number,
): Promise<AddPhotoResult> {
  if (!(await requireAdmin())) return { success: false, error: "Unauthorized" };

  const parsed = storyListPhotoInputSchema.safeParse({
    section,
    imageUrl,
    altText,
    displayOrder,
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid photo." };
  }

  try {
    const photo = await addListSectionPhoto(parsed.data.section, parsed.data);
    revalidateStoryPaths();
    return { success: true, data: photo };
  } catch (error) {
    if (error instanceof StoryPhotoError) return { success: false, error: error.message };
    console.error("addStoryListPhotoAction failed:", error);
    return { success: false, error: "Failed to add photo." };
  }
}

export async function updateStoryListPhotoAltAction(
  id: string,
  altText: string | null,
): Promise<ActionResult> {
  if (!(await requireAdmin())) return { success: false, error: "Unauthorized" };

  const parsed = storyListPhotoAltInputSchema.safeParse({ altText });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid photo." };
  }

  try {
    await updateListSectionPhoto(id, parsed.data);
    revalidateStoryPaths();
    return { success: true };
  } catch (error) {
    if (error instanceof StoryPhotoError) return { success: false, error: error.message };
    console.error("updateStoryListPhotoAltAction failed:", error);
    return { success: false, error: "Failed to update photo." };
  }
}

export async function deleteStoryListPhotoAction(id: string): Promise<ActionResult> {
  if (!(await requireAdmin())) return { success: false, error: "Unauthorized" };

  try {
    await deleteListSectionPhoto(id);
    revalidateStoryPaths();
    return { success: true };
  } catch (error) {
    if (error instanceof StoryPhotoError) return { success: false, error: error.message };
    console.error("deleteStoryListPhotoAction failed:", error);
    return { success: false, error: "Failed to remove photo." };
  }
}

export async function reorderStoryListPhotosAction(
  orderedIds: string[],
): Promise<ActionResult> {
  if (!(await requireAdmin())) return { success: false, error: "Unauthorized" };

  const parsed = storyListPhotoReorderInputSchema.safeParse({ orderedIds });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid order." };
  }

  try {
    await reorderListSectionPhotos(parsed.data.orderedIds);
    revalidateStoryPaths();
    return { success: true };
  } catch (error) {
    console.error("reorderStoryListPhotosAction failed:", error);
    return { success: false, error: "Failed to reorder photos." };
  }
}
