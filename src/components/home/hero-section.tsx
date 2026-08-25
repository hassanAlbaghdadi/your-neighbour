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
              except the thing being sold.

              It then carried the recipe — "soft bread stuffed with cream
              cheese, soaked in sugar syrup" — which has since moved to the
              menu intro, where the same words do a second job the hero
              can't: they factor out the opening every card shares, so the
              grid reads as variations rather than six unrelated items. It
              only earns that reading next to the cards. Repeating it here
              would spend the largest text on the page saying what the
              reader is about to be told again 700px lower.

              What's left for this line is the one fact nothing else on the
              homepage states: what the food is called and where it's from.
              The menu intro says what it's made of and the founder band
              says who bakes it and how to buy -- neither names it. Our
              Story does, but that's a page most visitors never open, so the
              name lands here or nowhere.

              "made to pull apart and share" is doing the harder half of
              that job. A transliteration plus a category ("Yemeni honeycomb
              bread.") is precise and inert: it tells a reader who already
              knows this bread that we have it, and tells everyone else a
              label they can't picture. Pulling it apart is the part anyone
              can picture without a translation, and sharing is what the
              thing is actually for -- Our Story ends on bringing people
              together, and this is the only line on the homepage that acts
              like it.

              It costs nothing to say: 72 chars is inside the 80 above, it
              still sets as two lines on a phone, and it repairs a wrap
              defect in the old copy, whose second line ran 14% full with
              "bread." stranded on it alone. Now 88%/84%.

              Don't add the Karak tea from Our Story to this line: it's part
              of Sarah's story, not the menu. Every product on the grid
              below is this bread. */}
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
