"use client";

import { useState } from "react";
import { ImageOff, Plus } from "lucide-react";
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
import type { Product } from "@/lib/services/products/get-products";

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
    <Card className="pt-0">
      <div className="relative aspect-4/3 w-full bg-muted">
        {displayImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={displayImageUrl}
            alt={product.name}
            className="h-full w-full object-cover"
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
        <CardTitle>{product.name}</CardTitle>
        {product.description && (
          <CardDescription className="line-clamp-2">
            {product.description}
          </CardDescription>
        )}
      </CardHeader>

      {(product.allergens || product.preparation_notice) && (
        <CardContent className="flex flex-col gap-0.5 text-xs text-muted-foreground">
          {product.allergens && <span>{product.allergens}</span>}
          {product.preparation_notice && (
            <span>{product.preparation_notice}</span>
          )}
        </CardContent>
      )}

      {product.variants.length > 1 && (
        <CardContent className="flex flex-wrap gap-2">
          {product.variants.map((variant) => (
            <button
              key={variant.id}
              type="button"
              disabled={!variant.is_available}
              onClick={() => setSelectedVariantId(variant.id)}
              className={cn(
                "min-h-10 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                variant.id === selectedVariantId
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-foreground hover:border-primary/50",
                !variant.is_available && "cursor-not-allowed opacity-40",
              )}
            >
              {variant.label}
              {!variant.is_available && " (Sold Out)"}
            </button>
          ))}
        </CardContent>
      )}

      <CardFooter className="mt-auto flex items-center justify-between gap-3">
        <span className="font-heading text-base font-semibold text-foreground">
          ${(selectedVariant?.price ?? 0).toFixed(2)}
        </span>
        <Button
          size="sm"
          variant={isOrderable ? "default" : "secondary"}
          disabled={!isOrderable || !selectedVariant}
          onClick={() =>
            selectedVariant &&
            addItem({
              productId: product.id,
              variantId: selectedVariant.id,
              name: product.name,
              variantLabel: selectedVariant.label,
              slug: product.slug,
              price: selectedVariant.price,
              imageUrl: displayImageUrl,
            })
          }
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
    </Card>
  );
}
