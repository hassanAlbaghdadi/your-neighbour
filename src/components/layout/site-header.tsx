"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Menu as MenuIcon, ShoppingBag } from "lucide-react";
import { InstagramIcon } from "@/components/icons/instagram-icon";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useCart } from "@/context/cart-context";
import { scrollToAnchor } from "@/lib/utils";
import { track, trackOnce } from "@/lib/analytics";
import { INSTAGRAM_URL } from "@/lib/social";

export function SiteHeader() {
  const { itemCount, openCart } = useCart();
  const [navOpen, setNavOpen] = useState(false);

  // Funnel instrumentation only — nothing in the header renders off this.
  useEffect(() => {
    // Absent on pages with no hero (e.g. /checkout), where there's no
    // hero funnel to measure in the first place.
    const hero = document.getElementById("hero");
    if (!hero) return;

    trackOnce("hero_view");

    const observer = new IntersectionObserver(
      ([entry]) => {
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
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-3 sm:gap-6">
            <Button
              variant="ghost"
              size="icon"
              className="sm:hidden"
              aria-label="Open menu"
              onClick={() => setNavOpen(true)}
            >
              <MenuIcon />
            </Button>

            <Link href="/" className="flex items-center gap-2.5">
              <Image
                src="/brand/mark-black.png"
                alt=""
                width={30}
                height={30}
                priority
                className="shrink-0"
              />
              <span className="hidden font-heading text-xl font-semibold tracking-tight text-foreground sm:inline">
                Your Neighbour
              </span>
            </Link>

            {/* Points at "/#menu" rather than "#menu" so it still resolves
                from pages with no #menu of their own (e.g. /our-story) —
                scrollToAnchor no-ops when the id isn't on the current page
                and falls through to this href. */}
            <Link
              href="/#menu"
              onClick={(e) => {
                scrollToAnchor(e, "menu");
                track("menu_reentry_click");
              }}
              className="hidden text-sm font-medium text-muted-foreground transition-colors hover:text-foreground sm:inline-block"
            >
              Menu
            </Link>

            <Link
              href="/our-story"
              className="hidden text-sm font-medium text-muted-foreground transition-colors hover:text-foreground sm:inline-block"
            >
              Our story
            </Link>
          </div>

          <div className="flex items-center gap-1 sm:gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="hidden sm:inline-flex"
              aria-label="Your Neighbour on Instagram (opens in a new tab)"
              asChild
            >
              <a
                href={INSTAGRAM_URL}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => track("instagram_click", { location: "header" })}
              >
                <InstagramIcon />
              </a>
            </Button>

            <Button
              variant="outline"
              size="icon"
              className="relative"
              aria-label={`Open cart, ${itemCount} item${itemCount === 1 ? "" : "s"}`}
              onClick={openCart}
            >
              <ShoppingBag />
              {itemCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-medium text-primary-foreground">
                  {itemCount}
                </span>
              )}
            </Button>
          </div>
        </div>
      </header>

      <Sheet open={navOpen} onOpenChange={setNavOpen}>
        <SheetContent side="left" className="sm:max-w-xs">
          <SheetHeader>
            <SheetTitle className="sr-only">Menu</SheetTitle>
            <Link
              href="/"
              onClick={() => setNavOpen(false)}
              className="flex items-center gap-2.5"
            >
              <Image
                src="/brand/mark-black.png"
                alt=""
                width={28}
                height={28}
              />
              <span className="font-heading text-lg font-semibold text-foreground">
                Your Neighbour
              </span>
            </Link>
          </SheetHeader>

          <nav className="flex flex-col gap-1 px-4">
            <Link
              href="/#menu"
              onClick={(e) => {
                scrollToAnchor(e, "menu");
                setNavOpen(false);
              }}
              className="rounded-md px-2 py-2.5 text-base font-medium text-foreground transition-colors hover:bg-muted"
            >
              Menu
            </Link>
            <Link
              href="/our-story"
              onClick={() => setNavOpen(false)}
              className="rounded-md px-2 py-2.5 text-base font-medium text-foreground transition-colors hover:bg-muted"
            >
              Our story
            </Link>
            <a
              href={INSTAGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => track("instagram_click", { location: "mobile_nav" })}
              className="mt-1 flex items-center gap-2 rounded-md px-2 py-2.5 text-base font-medium text-foreground transition-colors hover:bg-muted"
            >
              <InstagramIcon className="size-4" />
              Instagram
            </a>
          </nav>
        </SheetContent>
      </Sheet>
    </>
  );
}
