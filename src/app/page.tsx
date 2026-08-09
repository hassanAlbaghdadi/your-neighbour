import { getCategories, getProducts } from "@/lib/services/products/get-products";
import { MenuGrid } from "@/components/menu/menu-grid";

export default async function HomePage() {
  const [categories, products] = await Promise.all([
    getCategories(),
    getProducts(),
  ]);

  return (
    <div className="flex flex-1 flex-col">
      <section className="border-b border-border bg-ivory-50 px-4 py-12 text-center sm:px-6">
        <h1 className="font-heading text-3xl font-semibold text-foreground sm:text-4xl">
          Fresh, baked to order
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
          Pre-order your favorites for local pickup — baked fresh the morning
          you pick up.
        </p>
      </section>

      <MenuGrid categories={categories} products={products} />
    </div>
  );
}
