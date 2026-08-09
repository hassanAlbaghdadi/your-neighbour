import "server-only";
import { createClient } from "@/lib/supabase/server";

export interface ProductInput {
  name: string;
  slug: string;
  categoryId: string | null;
  description: string | null;
  price: number;
  isAvailable: boolean;
  preparationNotice: string | null;
  allergens: string | null;
  displayOrder: number;
}

export class ProductError extends Error {}

function toRow(input: ProductInput) {
  return {
    name: input.name,
    slug: input.slug,
    category_id: input.categoryId,
    description: input.description,
    price: input.price,
    is_available: input.isAvailable,
    preparation_notice: input.preparationNotice,
    allergens: input.allergens,
    display_order: input.displayOrder,
  };
}

export async function createProduct(input: ProductInput): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("products").insert(toRow(input));
  if (error) {
    if (error.code === "23505") {
      throw new ProductError("A product with this slug already exists.");
    }
    throw new Error(`Failed to create product: ${error.message}`);
  }
}

export async function updateProduct(
  id: string,
  input: ProductInput,
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("products")
    .update(toRow(input))
    .eq("id", id);
  if (error) {
    if (error.code === "23505") {
      throw new ProductError("A product with this slug already exists.");
    }
    throw new Error(`Failed to update product: ${error.message}`);
  }
}

export async function setProductAvailability(
  id: string,
  isAvailable: boolean,
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("products")
    .update({ is_available: isAvailable })
    .eq("id", id);
  if (error) {
    throw new Error(`Failed to update availability: ${error.message}`);
  }
}

export async function deleteProduct(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) {
    if (error.code === "23503") {
      throw new ProductError(
        "This product has existing orders and can't be deleted. Mark it unavailable instead.",
      );
    }
    throw new Error(`Failed to delete product: ${error.message}`);
  }
}
