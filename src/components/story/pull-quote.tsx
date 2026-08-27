"use client";

import { useEffect, useRef } from "react";
import { Quote } from "lucide-react";
import { cn } from "@/lib/utils";
import { useScrollReveal } from "@/lib/hooks/use-scroll-reveal";
import { trackOnce } from "@/lib/analytics";

interface PullQuoteProps {
  quote: string;
  attribution: string;
}

/**
 * A single milestone for "did they actually read this page", not a
 * scroll-percentage tracker. The three narrative beats above sit close
 * together and almost always co-scroll into view in one pass, so tracking
 * each individually would mostly just re-confirm the same visit rather than
 * add information -- reaching the pull quote (the last thing before the
 * CTA) is the one point that actually distinguishes "skimmed the top and
 * left" from "read to the end."
 */
export function PullQuote({ quote, attribution }: PullQuoteProps) {
  const { ref: revealRef, visible } = useScrollReveal<HTMLElement>();
  const trackedRef = useRef<HTMLElement>(null);

  // Deliberately its own observer rather than reusing `visible` above:
  // useScrollReveal starts optimistically "visible" so the block never
  // flashes hidden on first paint (see its own comment), which is right
  // for the reveal animation but wrong here -- it would fire this on
  // every page load regardless of whether anyone actually scrolled this
  // far. This one only flips on a genuine observed intersection, same
  // one-shot pattern as founder_note_view.
  useEffect(() => {
    const el = trackedRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          trackOnce("story_read_to_end");
          observer.disconnect();
        }
      },
      { threshold: 0.5 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={(el) => {
        revealRef.current = el;
        trackedRef.current = el;
      }}
      className="border-b border-border bg-ivory-50"
    >
      <div
        className={cn(
          "mx-auto max-w-3xl px-4 py-16 text-center sm:px-6 sm:py-20 motion-safe:transition-all motion-safe:duration-700 motion-safe:ease-out",
          visible
            ? "opacity-100 translate-y-0"
            : "motion-safe:translate-y-6 motion-safe:opacity-0",
        )}
      >
        <Quote className="mx-auto size-6 text-terracotta-400" aria-hidden />
        <p className="mt-4 font-heading text-2xl leading-snug font-medium text-espresso-900 sm:text-3xl">
          {quote}
        </p>
        <p className="mt-4 text-xs font-semibold tracking-wider text-terracotta-600 uppercase">
          {attribution}
        </p>
      </div>
    </section>
  );
}
