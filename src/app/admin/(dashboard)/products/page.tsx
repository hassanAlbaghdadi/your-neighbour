import { getCategories, getProducts } from "@/lib/services/products/get-products";
import { CategoryManager } from "@/components/admin/category-manager";
import { ProductTable } from "@/components/admin/product-table";
import { ProductFormDialog } from "@/components/admin/product-form-dialog";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default async function AdminProductsPage() {
  const [categories, products] = await Promise.all([
    getCategories(),
    getProducts(),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-foreground">
          Products
        </h1>
        <p className="mt-2 text-muted-foreground">
          Manage your menu and categories.
        </p>
      </div>

      <section>
        <h2 className="font-heading text-lg font-semibold text-foreground">
          Categories
        </h2>
        <div className="mt-3">
          <CategoryManager categories={categories} />
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-lg font-semibold text-foreground">
            Menu Items
          </h2>
          <ProductFormDialog
            categories={categories}
            trigger={
              <Button size="sm">
                <Plus /> New Product
              </Button>
            }
          />
        </div>
        <div className="mt-3">
          <ProductTable products={products} categories={categories} />
        </div>
      </section>
    </div>
  );
}
