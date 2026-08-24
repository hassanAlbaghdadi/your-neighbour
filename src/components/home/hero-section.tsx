"use client";

import Link from "next/link";
import Image from "next/image";
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
        <Image
          src={imageUrl}
          alt={imageAlt}
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-cream-50/60">
          <ImageOff className="size-6" />
          <span className="text-xs">No photo yet</span>
        </div>
      )}

      {/* Sized for the worst photo, not this one. The hero image is
          admin-uploadable, so the scrim has to hold up against a near-white
          upload: over pure white the old via-10% put the subhead at 1.12:1.
          The stops keep >=70% across the band the text occupies (roughly the
          bottom 35%), which clears 4.5:1 at text-lg even on white, then fall
          to nothing by 80% so the top of the photo stays untouched. */}
      <div className="absolute inset-0 bg-gradient-to-t from-espresso-900/95 via-espresso-900/70 via-35% to-transparent to-80%" />

      <div className="relative flex h-full items-end">
        <div className="mx-auto w-full max-w-6xl px-4 pb-12 sm:px-6 sm:pb-16">
          <h1 className="max-w-lg font-heading text-4xl font-semibold text-cream-50 sm:text-5xl">
            Fresh, baked to order
          </h1>
          {/* KEEP THIS UNDER 80 CHARACTERS. At 343px/16px the budget is
              ~40 chars a line, so 80 is the last length that still sets as
              two lines on a phone. A third line raises the top of this text
              block from 64% of the hero to ~61%, which lifts it out of the
              >=70% band the scrim above is sized for and into the part that
              fades — the 1.12:1-against-a-white-upload failure that comment
              describes. Shorten the copy; don't reach for the gradient.

              This used to sell pre-ordering and pickup, which the founder
              band states outright 123px below, and freshness, which the h1
              above already says. So it named everything about the shop
              except the thing being sold — and the page had to spend three
              lines above the menu doing that instead. Now the h1 carries
              freshness and this carries what it actually is. */}
          <p className="mt-4 max-w-md text-base text-cream-50/95 sm:text-lg">
            Soft bread stuffed with cream cheese, soaked in sugar syrup.
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
