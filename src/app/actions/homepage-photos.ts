"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/require-admin";
import {
  heroPhotoInputSchema,
  galleryPhotoInputSchema,
  galleryPhotoAltInputSchema,
  galleryPhotoReorderInputSchema,
} from "@/lib/validations/homepage-photo";
import {
  setHeroPhoto,
  clearHeroPhoto,
  addGalleryPhoto,
  updateGalleryPhoto,
  deleteGalleryPhoto,
  reorderGalleryPhotos,
  HomepagePhotoError,
} from "@/lib/services/homepage/manage-homepage-photos";
import type { ActionResult } from "@/types/action-result";

type AddPhotoResult = ActionResult<{ id: string; createdAt: string }>;

export async function setHeroPhotoAction(
  imageUrl: string,
  altText: string | null,
): Promise<ActionResult> {
  if (!(await requireAdmin())) return { success: false, error: "Unauthorized" };

  const parsed = heroPhotoInputSchema.safeParse({ imageUrl, altText });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid photo." };
  }

  try {
    await setHeroPhoto(parsed.data.imageUrl, parsed.data.altText);
    revalidatePath("/admin/homepage");
    revalidatePath("/");
    // Our Story falls back to the homepage hero photo when no
    // story-specific hero is set.
    revalidatePath("/our-story");
    return { success: true };
  } catch (error) {
    if (error instanceof HomepagePhotoError) return { success: false, error: error.message };
    console.error("setHeroPhotoAction failed:", error);
    return { success: false, error: "Failed to set hero photo." };
  }
}

export async function clearHeroPhotoAction(): Promise<ActionResult> {
  if (!(await requireAdmin())) return { success: false, error: "Unauthorized" };

  try {
    await clearHeroPhoto();
    revalidatePath("/admin/homepage");
    revalidatePath("/");
    // Our Story falls back to the homepage hero photo when no
    // story-specific hero is set.
    revalidatePath("/our-story");
    return { success: true };
  } catch (error) {
    if (error instanceof HomepagePhotoError) return { success: false, error: error.message };
    console.error("clearHeroPhotoAction failed:", error);
    return { success: false, error: "Failed to clear hero photo." };
  }
}

export async function addGalleryPhotoAction(
  imageUrl: string,
  altText: string | null,
  displayOrder: number,
): Promise<AddPhotoResult> {
  if (!(await requireAdmin())) return { success: false, error: "Unauthorized" };

  const parsed = galleryPhotoInputSchema.safeParse({ imageUrl, altText, displayOrder });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid photo." };
  }

  try {
    const photo = await addGalleryPhoto(parsed.data);
    revalidatePath("/admin/homepage");
    revalidatePath("/");
    // Our Story falls back to the homepage hero photo when no
    // story-specific hero is set.
    revalidatePath("/our-story");
    return { success: true, data: photo };
  } catch (error) {
    if (error instanceof HomepagePhotoError) return { success: false, error: error.message };
    console.error("addGalleryPhotoAction failed:", error);
    return { success: false, error: "Failed to add photo." };
  }
}

export async function updateGalleryPhotoAltAction(
  id: string,
  altText: string | null,
): Promise<ActionResult> {
  if (!(await requireAdmin())) return { success: false, error: "Unauthorized" };

  const parsed = galleryPhotoAltInputSchema.safeParse({ altText });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid photo." };
  }

  try {
    await updateGalleryPhoto(id, parsed.data);
    revalidatePath("/admin/homepage");
    revalidatePath("/");
    // Our Story falls back to the homepage hero photo when no
    // story-specific hero is set.
    revalidatePath("/our-story");
    return { success: true };
  } catch (error) {
    if (error instanceof HomepagePhotoError) return { success: false, error: error.message };
    console.error("updateGalleryPhotoAltAction failed:", error);
    return { success: false, error: "Failed to update photo." };
  }
}

export async function deleteGalleryPhotoAction(id: string): Promise<ActionResult> {
  if (!(await requireAdmin())) return { success: false, error: "Unauthorized" };

  try {
    await deleteGalleryPhoto(id);
    revalidatePath("/admin/homepage");
    revalidatePath("/");
    // Our Story falls back to the homepage hero photo when no
    // story-specific hero is set.
    revalidatePath("/our-story");
    return { success: true };
  } catch (error) {
    if (error instanceof HomepagePhotoError) return { success: false, error: error.message };
    console.error("deleteGalleryPhotoAction failed:", error);
    return { success: false, error: "Failed to remove photo." };
  }
}

export async function reorderGalleryPhotosAction(
  orderedIds: string[],
): Promise<ActionResult> {
  if (!(await requireAdmin())) return { success: false, error: "Unauthorized" };

  const parsed = galleryPhotoReorderInputSchema.safeParse({ orderedIds });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid order." };
  }

  try {
    await reorderGalleryPhotos(parsed.data.orderedIds);
    revalidatePath("/admin/homepage");
    revalidatePath("/");
    // Our Story falls back to the homepage hero photo when no
    // story-specific hero is set.
    revalidatePath("/our-story");
    return { success: true };
  } catch (error) {
    console.error("reorderGalleryPhotosAction failed:", error);
    return { success: false, error: "Failed to reorder photos." };
  }
}
