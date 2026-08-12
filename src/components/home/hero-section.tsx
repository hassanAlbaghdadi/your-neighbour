"use client";

import Link from "next/link";
import { ImageOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { scrollToAnchor } from "@/lib/utils";

interface HeroSectionProps {
  imageUrl: string | null;
  imageAlt: string;
}

export function HeroSection({ imageUrl, imageAlt }: HeroSectionProps) {
  return (
    <section
      id="hero"
      className="relative h-[92svh] max-h-[900px] min-h-[520px] w-full overflow-hidden bg-espresso-900"
    >
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt={imageAlt}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-cream-50/60">
          <ImageOff className="size-6" />
          <span className="text-xs">No photo yet</span>
        </div>
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-espresso-900/85 via-espresso-900/10 to-transparent" />

      <div className="relative flex h-full items-end">
        <div className="mx-auto w-full max-w-6xl px-4 pb-12 sm:px-6 sm:pb-16">
          <p className="text-xs font-semibold tracking-wider text-terracotta-200 uppercase">
            Small batch · Made to order
          </p>
          <h1 className="mt-3 max-w-lg font-heading text-4xl font-semibold text-cream-50 sm:text-5xl">
            Fresh, baked to order
          </h1>
          <p className="mt-4 max-w-md text-base text-cream-50/85 sm:text-lg">
            Pre-order your favorites for local pickup — baked fresh the
            morning you pick up.
          </p>
          <Button asChild size="lg" className="mt-7">
            <Link href="#menu" onClick={(e) => scrollToAnchor(e, "menu")}>
              See the menu
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
