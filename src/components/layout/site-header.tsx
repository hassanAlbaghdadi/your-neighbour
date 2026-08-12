"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CartDrawer } from "@/components/cart/cart-drawer";
import { useCart } from "@/context/cart-context";
import { cn, scrollToAnchor } from "@/lib/utils";
import { track, trackOnce } from "@/lib/analytics";

export function SiteHeader() {
  const { itemCount } = useCart();
  const [cartOpen, setCartOpen] = useState(false);
  const [pastHero, setPastHero] = useState(false);

  useEffect(() => {
    // Absent on pages with no hero (e.g. /checkout) — the re-entry link
    // just stays hidden there, which is the correct fallback.
    const hero = document.getElementById("hero");
    if (!hero) return;

    trackOnce("hero_view");

    const observer = new IntersectionObserver(
      ([entry]) => {
        setPastHero(!entry.isIntersecting);
        if (!entry.isIntersecting) {
          trackOnce("hero_exit");
        }
      },
      { threshold: 0 },
    );
    observer.observe(hero);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80">
        <div className="mx-auto grid h-16 max-w-6xl grid-cols-[auto_1fr_auto] items-center gap-3 px-4 sm:px-6">
          <Link
            href="/"
            className="font-heading text-xl font-semibold tracking-tight text-foreground"
          >
            Your Neighbour
          </Link>

          {/* Reserves its grid cell even while hidden, so it fades in without
              shifting the wordmark or cart icon. Same mechanism at every
              breakpoint — mobile is the one most likely to scroll past the
              hero (see stat-strip cadence finding), so this can't be
              desktop-only. */}
          <Link
            href="#menu"
            onClick={(e) => {
              scrollToAnchor(e, "menu");
              track("menu_reentry_click");
            }}
            aria-hidden={!pastHero}
            tabIndex={pastHero ? 0 : -1}
            className={cn(
              "justify-self-center text-sm font-medium text-terracotta-600 motion-safe:transition-opacity motion-safe:duration-300 motion-safe:ease-out hover:text-terracotta-700",
              pastHero ? "opacity-100" : "pointer-events-none opacity-0",
            )}
          >
            Order for pickup
          </Link>

          <Button
            variant="outline"
            size="icon"
            className="relative justify-self-end"
            aria-label={`Open cart, ${itemCount} item${itemCount === 1 ? "" : "s"}`}
            onClick={() => setCartOpen(true)}
          >
            <ShoppingBag />
            {itemCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-medium text-primary-foreground">
                {itemCount}
              </span>
            )}
          </Button>
        </div>
      </header>

      <CartDrawer open={cartOpen} onOpenChange={setCartOpen} />
    </>
  );
}
