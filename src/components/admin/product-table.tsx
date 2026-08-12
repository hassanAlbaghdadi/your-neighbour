"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ChevronDown, ChevronRight } from "lucide-react";
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
  setVariantAvailabilityAction,
} from "@/app/actions/products";
import { formatPrice } from "@/lib/utils";
import type {
  Category,
  Product,
  ProductVariant,
} from "@/lib/services/products/get-products";

function formatPriceRange(variants: ProductVariant[]): string {
  if (variants.length === 0) return "—";
  const prices = variants.map((v) => v.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  return min === max ? formatPrice(min) : `${formatPrice(min)} – ${formatPrice(max)}`;
}

export function ProductTable({
  products,
  categories,
}: {
  products: Product[];
  categories: Category[];
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted text-left text-muted-foreground">
          <tr>
            <th className="w-8 px-2 py-2" aria-hidden />
            <th className="px-4 py-2 font-medium">Name</th>
            <th className="px-4 py-2 font-medium">Category</th>
            <th className="px-4 py-2 font-medium">Price</th>
            <th className="px-4 py-2 font-medium">Visible</th>
            <th className="px-4 py-2 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border bg-card">
          {products.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
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
  const [expanded, setExpanded] = useState(false);

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

  const hasMultipleSizes = product.variants.length > 1;

  return (
    <>
      <tr>
        <td className="px-2 py-3">
          {hasMultipleSizes && (
            <button
              type="button"
              onClick={() => setExpanded((e) => !e)}
              aria-label={expanded ? "Collapse sizes" : "Expand sizes"}
              className="text-muted-foreground hover:text-foreground"
            >
              {expanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
            </button>
          )}
        </td>
        <td className="px-4 py-3 font-medium text-foreground">{product.name}</td>
        <td className="px-4 py-3 text-muted-foreground">
          {product.category?.name ?? "—"}
        </td>
        <td className="px-4 py-3 text-foreground">{formatPriceRange(product.variants)}</td>
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
                    This can&apos;t be undone. If any size of this product has
                    existing orders, deletion will fail — mark it unavailable
                    instead.
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
      {expanded &&
        product.variants.map((variant) => (
          <VariantRow key={variant.id} variant={variant} />
        ))}
    </>
  );
}

function VariantRow({ variant }: { variant: ProductVariant }) {
  const [available, setAvailable] = useState(variant.is_available);
  const [isPending, startTransition] = useTransition();

  function handleAvailabilityChange(checked: boolean) {
    const previous = available;
    setAvailable(checked);
    startTransition(async () => {
      const result = await setVariantAvailabilityAction(variant.id, checked);
      if (!result.success) {
        setAvailable(previous);
        toast.error(result.error ?? "Failed to update availability.");
      }
    });
  }

  return (
    <tr className="bg-muted/40">
      <td className="px-2 py-2" />
      <td className="px-4 py-2 pl-8 text-muted-foreground" colSpan={2}>
        {variant.label}
      </td>
      <td className="px-4 py-2 text-foreground">{formatPrice(variant.price)}</td>
      <td className="px-4 py-2">
        <Switch
          checked={available}
          onCheckedChange={handleAvailabilityChange}
          disabled={isPending}
        />
      </td>
      <td className="px-4 py-2" />
    </tr>
  );
}
