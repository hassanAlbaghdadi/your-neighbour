import "server-only";
import { createClient } from "@/lib/supabase/server";

export interface VariantInput {
  id?: string;
  label: string;
  price: number;
  isAvailable: boolean;
  displayOrder: number;
}

export interface ProductInput {
  name: string;
  slug: string;
  categoryId: string | null;
  imageUrl: string | null;
  description: string | null;
  isAvailable: boolean;
  preparationNotice: string | null;
  allergens: string | null;
  displayOrder: number;
  variants: VariantInput[];
}

export class ProductError extends Error {}

function toRow(input: ProductInput) {
  return {
    name: input.name,
    slug: input.slug,
    category_id: input.categoryId,
    image_url: input.imageUrl,
    description: input.description,
    is_available: input.isAvailable,
    preparation_notice: input.preparationNotice,
    allergens: input.allergens,
    display_order: input.displayOrder,
  };
}

function toVariantRow(productId: string, variant: VariantInput) {
  return {
    product_id: productId,
    label: variant.label,
    price: variant.price,
    is_available: variant.isAvailable,
    display_order: variant.displayOrder,
  };
}

export async function createProduct(input: ProductInput): Promise<void> {
  const supabase = await createClient();

  const { data: product, error } = await supabase
    .from("products")
    .insert(toRow(input))
    .select("id")
    .single();
  if (error || !product) {
    if (error?.code === "23505") {
      throw new ProductError("A product with this slug already exists.");
    }
    throw new Error(`Failed to create product: ${error?.message}`);
  }

  const { error: variantsError } = await supabase
    .from("product_variants")
    .insert(input.variants.map((variant) => toVariantRow(product.id, variant)));
  if (variantsError) {
    throw new Error(`Failed to create sizes: ${variantsError.message}`);
  }
}

export async function updateProduct(
  id: string,
  input: ProductInput,
): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase.from("products").update(toRow(input)).eq("id", id);
  if (error) {
    if (error.code === "23505") {
      throw new ProductError("A product with this slug already exists.");
    }
    throw new Error(`Failed to update product: ${error.message}`);
  }

  const { data: existingVariants, error: fetchError } = await supabase
    .from("product_variants")
    .select("id")
    .eq("product_id", id);
  if (fetchError) {
    throw new Error(`Failed to load existing sizes: ${fetchError.message}`);
  }

  const keptIds = new Set(input.variants.filter((v) => v.id).map((v) => v.id!));
  const removedIds = (existingVariants ?? [])
    .map((v) => v.id)
    .filter((existingId) => !keptIds.has(existingId));

  if (removedIds.length > 0) {
    const { error: deleteError } = await supabase
      .from("product_variants")
      .delete()
      .in("id", removedIds);
    if (deleteError) {
      if (deleteError.code === "23503") {
        throw new ProductError(
          "One of the sizes you removed has existing orders and can't be deleted — mark it unavailable instead.",
        );
      }
      throw new Error(`Failed to remove sizes: ${deleteError.message}`);
    }
  }

  const toUpdate = input.variants.filter((v) => v.id);
  const toInsert = input.variants.filter((v) => !v.id);

  for (const variant of toUpdate) {
    const { error: updateError } = await supabase
      .from("product_variants")
      .update(toVariantRow(id, variant))
      .eq("id", variant.id!);
    if (updateError) {
      throw new Error(`Failed to update size "${variant.label}": ${updateError.message}`);
    }
  }

  if (toInsert.length > 0) {
    const { error: insertError } = await supabase
      .from("product_variants")
      .insert(toInsert.map((variant) => toVariantRow(id, variant)));
    if (insertError) {
      throw new Error(`Failed to add new sizes: ${insertError.message}`);
    }
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

export async function setVariantAvailability(
  id: string,
  isAvailable: boolean,
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("product_variants")
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
        "This product has a size with existing orders and can't be deleted. Mark it unavailable instead.",
      );
    }
    throw new Error(`Failed to delete product: ${error.message}`);
  }
}
