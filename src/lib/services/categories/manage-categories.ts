import "server-only";
import { createClient } from "@/lib/supabase/server";

export interface CategoryInput {
  name: string;
  slug: string;
  displayOrder: number;
}

export class CategoryError extends Error {}

export async function createCategory(input: CategoryInput): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("categories").insert({
    name: input.name,
    slug: input.slug,
    display_order: input.displayOrder,
  });
  if (error) {
    if (error.code === "23505") {
      throw new CategoryError("A category with this slug already exists.");
    }
    throw new Error(`Failed to create category: ${error.message}`);
  }
}

export async function updateCategory(
  id: string,
  input: CategoryInput,
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("categories")
    .update({
      name: input.name,
      slug: input.slug,
      display_order: input.displayOrder,
    })
    .eq("id", id);
  if (error) {
    if (error.code === "23505") {
      throw new CategoryError("A category with this slug already exists.");
    }
    throw new Error(`Failed to update category: ${error.message}`);
  }
}

export async function deleteCategory(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("categories").delete().eq("id", id);
  if (error) {
    throw new Error(`Failed to delete category: ${error.message}`);
  }
}
