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
          {/* "Fresh, baked to order" before this, which is a specification,
              not a voice — it would have fit any bakery in any country, and
              it left a shop called Your Neighbour with nothing on its
              largest text that a neighbour would say. The functional half
              of it survives elsewhere: the band below carries the lead time
              and the small batches, and nothing here sits on a shelf
              anyway.

              "Home" is the word the rest of the site keeps reaching for on
              its own -- Our Story runs a whole beat titled "A little piece
              of home" -- and it's the one idea that lands on a first read
              for someone who has never heard of this bread and for someone
              who grew up on it. That matters in Canada specifically, but
              it needs no translating anywhere.

              HARD LIMIT ~22 CHARACTERS. At text-5xl in a max-w-lg column
              that is the ceiling for a single line on desktop; past it the
              h1 wraps and drags the whole text block from 65% of the hero
              up to 58%, out of the >=70% band the scrim is sized for.
              Every candidate at 24 chars and up failed this, measured. */}
          <h1 className="max-w-lg font-heading text-4xl font-semibold text-cream-50 sm:text-5xl">
            A little taste of home
          </h1>
          {/* KEEP UNDER ~80 CHARACTERS. That's the last length that still
              wraps to two lines on a phone; a third line lifts the top of
              this text block out of the >=70% band the scrim above is sized
              for, into the part that fades, and fails contrast. Shorten the
              copy; don't reach for the gradient. */}
          <p className="mt-4 max-w-md text-base text-cream-50/95 sm:text-lg">
            Khaliat El Nahal — Yemeni honeycomb bread, made to pull apart and
            share.
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
