"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/require-admin";
import { categoryFormSchema } from "@/lib/validations/product";
import {
  createCategory,
  updateCategory,
  deleteCategory,
  CategoryError,
} from "@/lib/services/categories/manage-categories";
import type { ActionResult } from "@/types/action-result";

export async function createCategoryAction(payload: unknown): Promise<ActionResult> {
  if (!(await requireAdmin())) return { success: false, error: "Unauthorized" };

  const parsed = categoryFormSchema.safeParse(payload);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid category." };
  }

  try {
    await createCategory(parsed.data);
    revalidatePath("/admin/products");
    revalidatePath("/");
    return { success: true };
  } catch (error) {
    if (error instanceof CategoryError) return { success: false, error: error.message };
    console.error("createCategoryAction failed:", error);
    return { success: false, error: "Failed to create category." };
  }
}

export async function updateCategoryAction(
  id: string,
  payload: unknown,
): Promise<ActionResult> {
  if (!(await requireAdmin())) return { success: false, error: "Unauthorized" };

  const parsed = categoryFormSchema.safeParse(payload);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid category." };
  }

  try {
    await updateCategory(id, parsed.data);
    revalidatePath("/admin/products");
    revalidatePath("/");
    return { success: true };
  } catch (error) {
    if (error instanceof CategoryError) return { success: false, error: error.message };
    console.error("updateCategoryAction failed:", error);
    return { success: false, error: "Failed to update category." };
  }
}

export async function deleteCategoryAction(id: string): Promise<ActionResult> {
  if (!(await requireAdmin())) return { success: false, error: "Unauthorized" };

  try {
    await deleteCategory(id);
    revalidatePath("/admin/products");
    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("deleteCategoryAction failed:", error);
    return { success: false, error: "Failed to delete category." };
  }
}
