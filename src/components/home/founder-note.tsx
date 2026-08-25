"use client";

import { useEffect, useRef } from "react";
import { Clock } from "lucide-react";
import { trackOnce } from "@/lib/analytics";

interface FounderNoteProps {
  minAdvanceHours: number;
}

/**
 * One band under the hero, not two. The ordering terms used to live in their
 * own bordered strip directly below this one, which put two full-bleed rules
 * within ~120px of each other and made the seam between them read as a page
 * break. Both bands were centred, both were a single line, and both were
 * about the same thing -- how buying from here works -- so the border between
 * them separated nothing.
 *
 * The terms sit under the voice line rather than beside it because they're
 * the smaller claim: who bakes it first, then what it costs you to order.
 * Muted and a size down so the eye can skip the row entirely, which is what
 * most people will do -- the lead time is repeated in the cart footer and
 * under the checkout date picker, closer to where it actually bites.
 *
 * "from the North End" is gone from the pickup half: the line directly above
 * it says North End, two lines apart.
 */
export function FounderNote({ minAdvanceHours }: FounderNoteProps) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          trackOnce("founder_note_view");
          observer.disconnect();
        }
      },
      // 0.5 so a quick flick-past doesn't count as "read" — matches how this
      // event is used to tag add-to-cart in product-card.tsx.
      { threshold: 0.5 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section ref={ref} className="border-b border-border bg-cream-50">
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-1.5 px-4 py-6 text-center sm:px-6">
        {/* "her mum's recipe" is the only inheritance claim on the
            homepage, and it's free: one line on desktop and two on a phone,
            exactly like the copy without it, and it fills the phone's
            second line 88% where the old one ran 34% with "at a time"
            stranded.

            It stays this short on purpose. Spelled out ("with a recipe
            passed down from her mum") it runs to three lines on a phone and
            two on desktop, which turns this band into a paragraph and
            undoes the one-band decision above. It would also restate Our
            Story's opening beat, which is titled "A recipe passed down" --
            three words here point at that page; a sentence here replaces
            it. */}
        <p className="font-heading text-base text-espresso-700">
          Baked by Sarah in the North End — her mum&apos;s recipe, one small
          batch at a time.
        </p>
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Clock className="size-3.5 shrink-0 text-terracotta-600" />
          Order {minAdvanceHours} hours ahead · Pickup only
        </p>
      </div>
    </section>
  );
}
