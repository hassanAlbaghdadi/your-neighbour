"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ProductCard } from "@/components/menu/product-card";
import { trackOnce } from "@/lib/analytics";
import type { Category, Product } from "@/lib/services/products/get-products";

interface MenuGridProps {
  categories: Category[];
  products: Product[];
  /** Derived from real order history; null when there's no defensible winner. */
  mostPopularId: string | null;
  /**
   * Allergens every product shares, stated once in the menu intro in
   * page.tsx and subtracted from each card's line here. Computed there
   * rather than here so the whole intro block is written in one place.
   */
  sharedAllergens: string[];
}

/**
 * Parked, not deleted: six products across two categories meant three
 * buttons and a filtering decision in front of a list you can see all of in
 * a few scrolls -- and five of the six share one category, so the control
 * mostly filtered nothing. Worth bringing back when the menu outgrows a
 * single scroll; flip this to true.
 *
 * A flag rather than commented-out JSX so the markup below stays compiled
 * and type-checked, and can't quietly rot against props that moved on.
 */
const SHOW_CATEGORY_FILTER = false;

export function MenuGrid({
  categories,
  products,
  mostPopularId,
  sharedAllergens: shared,
}: MenuGridProps) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    if (!activeCategory) return products;
    return products.filter((product) => product.category?.id === activeCategory);
  }, [products, activeCategory]);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          trackOnce("menu_view");
          observer.disconnect();
        }
      },
      { threshold: 0.1 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // pt-3, not pt-6 or pt-8: the last thing above this grid is the allergen
  // meta row in page.tsx, which is a legend for these cards rather than a
  // paragraph that happens to precede them. It has to sit nearer the grid it
  // describes than the heading it sits under, or it reads as trailing intro
  // copy -- which is exactly what it stopped being.
  return (
    <div ref={rootRef} className="mx-auto w-full max-w-6xl px-4 pt-3 pb-8 sm:px-6">
      {SHOW_CATEGORY_FILTER && (
        <div className="mb-8 flex flex-wrap gap-2">
          <Button
            variant={activeCategory === null ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveCategory(null)}
          >
            All
          </Button>
          {categories.map((category) => (
            <Button
              key={category.id}
              variant={activeCategory === category.id ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveCategory(category.id)}
            >
              {category.name}
            </Button>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="py-16 text-center text-muted-foreground">
          Nothing on the menu right now.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              sharedAllergens={shared}
              isMostPopular={product.id === mostPopularId}
            />
          ))}
        </div>
      )}
    </div>
  );
}
