"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ProductFormDialog } from "@/components/admin/product-form-dialog";
import {
  deleteProductAction,
  setProductAvailabilityAction,
} from "@/app/actions/products";
import type { Category, Product } from "@/lib/services/products/get-products";

export function ProductTable({
  products,
  categories,
}: {
  products: Product[];
  categories: Category[];
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted text-left text-muted-foreground">
          <tr>
            <th className="px-4 py-2 font-medium">Name</th>
            <th className="px-4 py-2 font-medium">Category</th>
            <th className="px-4 py-2 font-medium">Price</th>
            <th className="px-4 py-2 font-medium">Available</th>
            <th className="px-4 py-2 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border bg-card">
          {products.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                No products yet.
              </td>
            </tr>
          ) : (
            products.map((product) => (
              <ProductRow key={product.id} product={product} categories={categories} />
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function ProductRow({
  product,
  categories,
}: {
  product: Product;
  categories: Category[];
}) {
  const [available, setAvailable] = useState(product.is_available);
  const [isPending, startTransition] = useTransition();
  const [deleting, setDeleting] = useState(false);

  function handleAvailabilityChange(checked: boolean) {
    const previous = available;
    setAvailable(checked);
    startTransition(async () => {
      const result = await setProductAvailabilityAction(product.id, checked);
      if (!result.success) {
        setAvailable(previous);
        toast.error(result.error ?? "Failed to update availability.");
      }
    });
  }

  async function handleDelete() {
    setDeleting(true);
    const result = await deleteProductAction(product.id);
    setDeleting(false);
    if (!result.success) {
      toast.error(result.error ?? "Failed to delete product.");
    }
  }

  return (
    <tr>
      <td className="px-4 py-3 font-medium text-foreground">{product.name}</td>
      <td className="px-4 py-3 text-muted-foreground">
        {product.category?.name ?? "—"}
      </td>
      <td className="px-4 py-3 text-foreground">${product.price.toFixed(2)}</td>
      <td className="px-4 py-3">
        <Switch
          checked={available}
          onCheckedChange={handleAvailabilityChange}
          disabled={isPending}
        />
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <ProductFormDialog
            categories={categories}
            product={product}
            trigger={
              <Button variant="outline" size="sm">
                Edit
              </Button>
            }
          />
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm">
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete {product.name}?</AlertDialogTitle>
                <AlertDialogDescription>
                  This can&apos;t be undone. If this product has existing
                  orders, deletion will fail — mark it unavailable instead.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} disabled={deleting}>
                  {deleting ? "Deleting…" : "Delete"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </td>
    </tr>
  );
}
