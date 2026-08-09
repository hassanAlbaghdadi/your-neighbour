import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

export type Category = Database["public"]["Tables"]["categories"]["Row"];

export type Product = Database["public"]["Tables"]["products"]["Row"] & {
  category: Pick<Category, "id" | "name" | "slug"> | null;
};

export async function getCategories(): Promise<Category[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .order("display_order", { ascending: true });

  if (error) {
    throw new Error(`Failed to load categories: ${error.message}`);
  }

  return data;
}

export async function getProducts(): Promise<Product[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select("*, category:categories(id, name, slug)")
    .order("display_order", { ascending: true });

  if (error) {
    throw new Error(`Failed to load products: ${error.message}`);
  }

  return data as unknown as Product[];
}
