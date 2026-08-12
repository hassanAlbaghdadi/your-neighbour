"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ImageOff, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useCart } from "@/context/cart-context";
import type { Product, ProductVariant } from "@/lib/services/products/get-products";

function formatAllergenTags(raw: string): string {
  return raw
    .replace(/^contains,?\s*/i, "")
    .split(",")
    .map((part) => part.trim().replace(/\s*etc\.?\s*$/i, "").trim())
    .filter((part) => part.length > 0)
    .map((part) => part.toUpperCase())
    .join(" · ");
}

function VariantSegments({
  variants,
  selectedId,
  onSelect,
}: {
  variants: ProductVariant[];
  selectedId: string | undefined;
  onSelect: (id: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [indicator, setIndicator] = useState<{ left: number; width: number } | null>(null);

  function reposition() {
    const activeEl = containerRef.current?.querySelector<HTMLElement>('[data-selected="true"]');
    if (activeEl) {
      setIndicator({ left: activeEl.offsetLeft, width: activeEl.offsetWidth });
    }
  }

  useLayoutEffect(reposition, [selectedId, variants]);

  useEffect(() => {
    window.addEventListener("resize", reposition);
    return () => window.removeEventListener("resize", reposition);
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative inline-flex gap-0.5 self-start rounded-md border border-border bg-muted p-0.5"
    >
      {indicator && (
        <span
          aria-hidden
          className="absolute top-0.5 left-0 h-[calc(100%-0.25rem)] rounded-sm border border-primary bg-terracotta-50 motion-safe:transition-[transform,width] motion-safe:duration-300 motion-safe:ease-out"
          style={{ width: indicator.width, transform: `translateX(${indicator.left}px)` }}
        />
      )}
      {variants.map((variant) => (
        <button
          key={variant.id}
          type="button"
          data-selected={variant.id === selectedId}
          disabled={!variant.is_available}
          onClick={() => onSelect(variant.id)}
          aria-pressed={variant.id === selectedId}
          className={cn(
            // min-w-16 matches "Piece"'s natural width — it exists to stop a
            // short label like `9"` (42px content) from looking cramped next
            // to "12 Piece" (83px), not to force every segment equal-width:
            // longer labels (e.g. "With Fresh Flowers" at 161px) already
            // exceed it and are left alone, so a 2-option size/style pair
            // with very different label lengths doesn't get stretched.
            "relative z-10 flex min-h-10 min-w-16 items-center justify-center rounded-sm px-3.5 text-center text-sm font-medium transition-colors",
            variant.id === selectedId
              ? "font-semibold text-terracotta-700"
              : "text-muted-foreground hover:bg-card/70 hover:text-foreground",
            !variant.is_available && "cursor-not-allowed text-muted-foreground/50 line-through",
          )}
        >
          {variant.label}
        </button>
      ))}
    </div>
  );
}

export function ProductCard({ product }: { product: Product }) {
  const { addItem } = useCart();

  const firstAvailable = product.variants.find((v) => v.is_available);
  const [selectedVariantId, setSelectedVariantId] = useState(
    (firstAvailable ?? product.variants[0])?.id,
  );
  const selectedVariant =
    product.variants.find((v) => v.id === selectedVariantId) ?? product.variants[0];

  const isOrderable = product.is_available && selectedVariant?.is_available;
  const displayImageUrl = selectedVariant?.image_url ?? product.image_url;

  return (
    <Card
      size="sm"
      className="group pt-0 transition-[transform,box-shadow] motion-safe:duration-300 motion-safe:ease-out motion-safe:hover:-translate-y-1 motion-safe:hover:shadow-[0_16px_32px_-12px_rgba(42,33,29,0.18),0_4px_10px_-4px_rgba(42,33,29,0.1)]"
    >
      <div className="relative aspect-4/3 w-full overflow-hidden bg-muted">
        {displayImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={displayImageUrl}
            alt={product.name}
            className="h-full w-full object-cover transition-transform motion-safe:duration-500 motion-safe:ease-out motion-safe:group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 text-muted-foreground">
            <ImageOff className="size-6" />
            <span className="text-xs">No photo yet</span>
          </div>
        )}
        {!isOrderable && (
          <Badge className="absolute top-3 left-3 bg-espresso-900 text-cream-50">
            Sold Out
          </Badge>
        )}
      </div>

      <CardHeader>
        {product.category?.name && (
          <p className="text-xs font-semibold tracking-wider text-terracotta-600 uppercase">
            {product.category.name}
          </p>
        )}
        <CardTitle className="text-lg">{product.name}</CardTitle>
        {product.description && (
          <CardDescription className="line-clamp-2">
            {product.description}
          </CardDescription>
        )}
      </CardHeader>

      {product.allergens && (
        <CardContent>
          <span className="text-[11px] font-semibold text-espresso-700 uppercase">
            {formatAllergenTags(product.allergens)}
          </span>
        </CardContent>
      )}

      {/* Selector and price/CTA are pinned to the bottom as one group, so they
          always sit adjacent to each other regardless of how much (or how
          little) description/allergen text a product has above them. */}
      <div className="mt-auto flex flex-col gap-2">
        {product.variants.length > 1 && (
          <CardContent>
            <VariantSegments
              variants={product.variants}
              selectedId={selectedVariantId}
              onSelect={setSelectedVariantId}
            />
          </CardContent>
        )}

        <CardFooter className="justify-end gap-3 bg-transparent">
          <span className="text-lg font-semibold text-foreground tabular-nums">
            ${(selectedVariant?.price ?? 0).toFixed(2)}
          </span>
          <Button
            variant={isOrderable ? "default" : "secondary"}
            disabled={!isOrderable || !selectedVariant}
            onClick={() => {
              if (!selectedVariant) return;
              addItem({
                productId: product.id,
                variantId: selectedVariant.id,
                name: product.name,
                variantLabel: selectedVariant.label,
                slug: product.slug,
                price: selectedVariant.price,
                imageUrl: displayImageUrl,
              });
              toast.success(`Added ${product.name} to cart`, {
                description: selectedVariant.label,
              });
            }}
          >
            {isOrderable ? (
              <>
                <Plus /> Add to Cart
              </>
            ) : (
              "Sold Out"
            )}
          </Button>
        </CardFooter>
      </div>
    </Card>
  );
}
