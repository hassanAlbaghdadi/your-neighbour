"use client";

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
import { useCart } from "@/context/cart-context";
import type { Product } from "@/lib/services/products/get-products";

export function ProductCard({ product }: { product: Product }) {
  const { addItem } = useCart();

  return (
    <Card className="pt-0">
      <div className="relative aspect-4/3 w-full bg-muted">
        {product.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.image_url}
            alt={product.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 text-muted-foreground">
            <ImageOff className="size-6" />
            <span className="text-xs">No photo yet</span>
          </div>
        )}
        {!product.is_available && (
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

      <CardFooter className="mt-auto flex items-center justify-between gap-3">
        <span className="font-heading text-base font-semibold text-foreground">
          ${product.price.toFixed(2)}
        </span>
        <Button
          size="sm"
          variant={product.is_available ? "default" : "secondary"}
          disabled={!product.is_available}
          onClick={() =>
            addItem({
              productId: product.id,
              name: product.name,
              slug: product.slug,
              price: product.price,
              imageUrl: product.image_url,
            })
          }
        >
          {product.is_available ? (
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
