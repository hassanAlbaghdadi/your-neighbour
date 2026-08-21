"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ImageOff, Plus } from "lucide-react";
import { toast } from "sonner";
import { track } from "@/lib/analytics";
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
import { cn, formatPrice } from "@/lib/utils";
import { useCart } from "@/context/cart-context";
import type { Product, ProductVariant } from "@/lib/services/products/get-products";

function formatAllergenTags(raw: string): string {
  return raw
    .replace(/^contains,?\s*/i, "")
    .split(",")
    .map((part) => part.trim().replace(/\s*etc\.?\s*$/i, "").trim())
    .filter((part) => part.length > 0)
    .map((part) => part.toLowerCase())
    .join(", ");
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

  // useEffect, not useLayoutEffect: this is a client component, but client
  // components still server-render, and useLayoutEffect does nothing on the
  // server — React logs a warning for every card on every page render. The
  // indicator starts hidden (`indicator` is null until the first pass) and
  // only animates on later selections, so there's no pre-paint flash to
  // avoid here that would justify blocking paint.
  useEffect(reposition, [selectedId, variants]);

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
            "relative z-10 flex min-h-11 min-w-16 items-center justify-center rounded-sm px-3.5 text-center text-sm font-medium transition-colors",
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

  // Every variant's photo (deduped — most variants share the product photo,
  // only ones with their own override differ) rendered stacked and
  // crossfaded, instead of swapping a single <Image>'s src. Swapping src on
  // select means the browser hasn't fetched that URL yet, so there was a
  // visible delay before the new photo appeared; pre-mounting all of them
  // means the non-selected ones are already loaded (still lazy, since
  // they're all in the same on-screen position as the visible one) by the
  // time a size is picked.
  const variantImageUrls = [
    ...new Set(
      product.variants
        .map((v) => v.image_url ?? product.image_url)
        .filter((url): url is string => !!url),
    ),
  ];

  return (
    <Card
      size="sm"
      className="group pt-0 transition-[transform,box-shadow] motion-safe:duration-300 motion-safe:ease-out motion-safe:hover:-translate-y-1 motion-safe:hover:shadow-[0_16px_32px_-12px_rgba(42,33,29,0.18),0_4px_10px_-4px_rgba(42,33,29,0.1)]"
    >
      <div className="relative aspect-4/3 w-full overflow-hidden bg-muted">
        {variantImageUrls.length > 0 ? (
          variantImageUrls.map((url) => (
            <Image
              key={url}
              src={url}
              alt={product.name}
              fill
              sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
              className={cn(
                "object-cover transition-[opacity,transform] motion-safe:duration-500 motion-safe:ease-out motion-safe:group-hover:scale-105",
                url === displayImageUrl ? "opacity-100" : "opacity-0",
              )}
            />
          ))
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

      {/* No category eyebrow: five of six products sit in the same
          category, so it repeated down the column in the loudest treatment
          on the card while telling you nothing about which item to pick.
          With the filter parked in menu-grid.tsx it has no browsing job
          left either. The line it frees is spent on the description below,
          so the card is no taller than before.

          line-clamp-3, not 2: these descriptions share a long opening
          ("Soft Bread Stuffed w/ Cream Cheese Mix...") and the words that
          actually distinguish them -- cinnamon icing, dark chocolate, dulce
          de leche -- sit at the very end. At two lines, three of six were
          clipped exactly where they became useful. */}
      <CardHeader>
        {/* Variant-matched, not a bare `text-lg`: CardTitle's own base
            carries `group-data-[size=sm]/card:text-sm`, and this Card is
            size="sm". A plain text-lg can't be deduped against a
            variant-prefixed class by tailwind-merge and loses to it on
            specificity, so the title had silently been rendering at 14px --
            the same size as its own description, and smaller than the price.
            The name is what you scan a menu by; it should win. */}
        <CardTitle className="group-data-[size=sm]/card:text-lg">
          {product.name}
        </CardTitle>
        {product.description && (
          <CardDescription className="line-clamp-3">
            {product.description}
          </CardDescription>
        )}
      </CardHeader>

      {/* Demoted from uppercase semibold near-black, which made the least
          distinguishing text on the card the most visually assertive --
          every product here contains gluten and dairy, and all but one
          contain eggs and sesame. It's reference material for the few who
          need it, not a basis for choosing between items, so it reads as a
          footnote now. "Contains" is explicit because a bare list gave no
          clue whether it meant contains or free-of. */}
      {product.allergens && (
        <CardContent>
          <p className="text-[11px] text-muted-foreground">
            Contains {formatAllergenTags(product.allergens)}
          </p>
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
            {formatPrice(selectedVariant?.price ?? 0)}
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
                duration: 2000,
              });
              track("add_to_cart", {
                product: product.name,
                sawFounderNote:
                  sessionStorage.getItem("tracked:founder_note_view") ===
                  "1",
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
