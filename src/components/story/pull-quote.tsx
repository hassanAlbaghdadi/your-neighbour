"use client";

import { Quote } from "lucide-react";
import { cn } from "@/lib/utils";
import { useScrollReveal } from "@/lib/hooks/use-scroll-reveal";

interface PullQuoteProps {
  quote: string;
  attribution: string;
}

export function PullQuote({ quote, attribution }: PullQuoteProps) {
  const { ref, visible } = useScrollReveal<HTMLElement>();

  return (
    <section ref={ref} className="border-b border-border bg-ivory-50">
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
