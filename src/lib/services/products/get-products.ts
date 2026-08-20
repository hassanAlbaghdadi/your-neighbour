import { cache } from "react";
import { createPublicClient } from "@/lib/supabase/public";
import type { Database } from "@/types/database";

export type Category = Database["public"]["Tables"]["categories"]["Row"];

export type ProductVariant = Database["public"]["Tables"]["product_variants"]["Row"];

export type Product = Database["public"]["Tables"]["products"]["Row"] & {
  category: Pick<Category, "id" | "name" | "slug"> | null;
  variants: ProductVariant[];
};

// Wrapped in React's cache() so the root layout's call and a page's own
// call within the same request dedupe to a single Supabase round-trip
// instead of two.
export const getCategories = cache(async (): Promise<Category[]> => {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .order("display_order", { ascending: true });

  if (error) {
    throw new Error(`Failed to load categories: ${error.message}`);
  }

  return data;
});

export async function getProducts(): Promise<Product[]> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("products")
    .select(
      "*, category:categories(id, name, slug), variants:product_variants(*)",
    )
    .order("display_order", { ascending: true })
    .order("display_order", { referencedTable: "product_variants", ascending: true });

  if (error) {
    throw new Error(`Failed to load products: ${error.message}`);
  }

  return data as unknown as Product[];
}
