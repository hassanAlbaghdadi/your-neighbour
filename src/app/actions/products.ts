"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/require-admin";
import { productFormSchema } from "@/lib/validations/product";
import {
  createProduct,
  updateProduct,
  deleteProduct,
  setProductAvailability,
  setVariantAvailability,
  ProductError,
} from "@/lib/services/products/manage-products";
import type { ActionResult } from "@/types/action-result";

export async function createProductAction(payload: unknown): Promise<ActionResult> {
  if (!(await requireAdmin())) return { success: false, error: "Unauthorized" };

  const parsed = productFormSchema.safeParse(payload);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid product." };
  }

  try {
    await createProduct({
      ...parsed.data,
      description: parsed.data.description || null,
      preparationNotice: parsed.data.preparationNotice || null,
      allergens: parsed.data.allergens || null,
    });
    revalidatePath("/admin/products");
    revalidatePath("/");
    // Our Story falls back to product photos when no story-specific
    // photo is set for a section.
    revalidatePath("/our-story");
    return { success: true };
  } catch (error) {
    if (error instanceof ProductError) return { success: false, error: error.message };
    console.error("createProductAction failed:", error);
    return { success: false, error: "Failed to create product." };
  }
}

export async function updateProductAction(
  id: string,
  payload: unknown,
): Promise<ActionResult> {
  if (!(await requireAdmin())) return { success: false, error: "Unauthorized" };

  const parsed = productFormSchema.safeParse(payload);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid product." };
  }

  try {
    await updateProduct(id, {
      ...parsed.data,
      description: parsed.data.description || null,
      preparationNotice: parsed.data.preparationNotice || null,
      allergens: parsed.data.allergens || null,
    });
    revalidatePath("/admin/products");
    revalidatePath("/");
    // Our Story falls back to product photos when no story-specific
    // photo is set for a section.
    revalidatePath("/our-story");
    return { success: true };
  } catch (error) {
    if (error instanceof ProductError) return { success: false, error: error.message };
    console.error("updateProductAction failed:", error);
    return { success: false, error: "Failed to update product." };
  }
}

export async function deleteProductAction(id: string): Promise<ActionResult> {
  if (!(await requireAdmin())) return { success: false, error: "Unauthorized" };

  try {
    await deleteProduct(id);
    revalidatePath("/admin/products");
    revalidatePath("/");
    // Our Story falls back to product photos when no story-specific
    // photo is set for a section.
    revalidatePath("/our-story");
    return { success: true };
  } catch (error) {
    if (error instanceof ProductError) return { success: false, error: error.message };
    console.error("deleteProductAction failed:", error);
    return { success: false, error: "Failed to delete product." };
  }
}

export async function setProductAvailabilityAction(
  id: string,
  isAvailable: boolean,
): Promise<ActionResult> {
  if (!(await requireAdmin())) return { success: false, error: "Unauthorized" };

  try {
    await setProductAvailability(id, isAvailable);
    revalidatePath("/admin/products");
    revalidatePath("/");
    // Our Story falls back to product photos when no story-specific
    // photo is set for a section.
    revalidatePath("/our-story");
    return { success: true };
  } catch (error) {
    console.error("setProductAvailabilityAction failed:", error);
    return { success: false, error: "Failed to update availability." };
  }
}

export async function setVariantAvailabilityAction(
  id: string,
  isAvailable: boolean,
): Promise<ActionResult> {
  if (!(await requireAdmin())) return { success: false, error: "Unauthorized" };

  try {
    await setVariantAvailability(id, isAvailable);
    revalidatePath("/admin/products");
    revalidatePath("/");
    // Our Story falls back to product photos when no story-specific
    // photo is set for a section.
    revalidatePath("/our-story");
    return { success: true };
  } catch (error) {
    console.error("setVariantAvailabilityAction failed:", error);
    return { success: false, error: "Failed to update availability." };
  }
}
