"use client";

import { useState } from "react";
import Image from "next/image";
import { ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TimelineStep {
  time: string;
  title: string;
  description: string;
  photo: { src: string; alt: string } | null;
}

// Full-bleed, like the hero — this is the page's one deliberately dominant
// "designed moment" (a mosaic here would just repeat what the closing
// filmstrip already does). Steps crossfade via stacked absolute panels
// instead of mounting/unmounting, so switching tabs never causes layout
// shift or an image re-fetch.
export function DayInTheLife({ steps }: { steps: TimelineStep[] }) {
  const [activeIndex, setActiveIndex] = useState(0);

  if (steps.length === 0) return null;
  const active = steps[activeIndex];

  return (
    <section className="relative h-[70svh] max-h-[720px] min-h-[480px] w-full overflow-hidden bg-espresso-900">
      {steps.map((step, index) => (
        <div
          key={index}
          aria-hidden={index !== activeIndex}
          className={cn(
            "absolute inset-0 motion-safe:transition-opacity motion-safe:duration-500 motion-safe:ease-out",
            index === activeIndex ? "opacity-100" : "opacity-0",
          )}
        >
          {step.photo ? (
            <Image
              src={step.photo.src}
              alt={step.photo.alt}
              fill
              priority={index === 0}
              sizes="100vw"
              className="object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-cream-50/60">
              <ImageOff className="size-6" />
              <span className="text-xs">No photo yet</span>
            </div>
          )}
        </div>
      ))}

      <div className="absolute inset-0 bg-gradient-to-t from-espresso-900/90 via-espresso-900/15 to-transparent" />

      <div className="relative flex h-full flex-col justify-end">
        <div className="mx-auto w-full max-w-6xl px-4 pb-8 sm:px-6 sm:pb-10">
          <p className="text-xs font-semibold tracking-wider text-terracotta-200 uppercase">
            A day in the kitchen
          </p>
          <p className="mt-3 font-heading text-2xl font-semibold text-cream-50 sm:text-3xl">
            {active.title}
          </p>
          <p className="mt-2 max-w-md text-sm text-cream-50/85 sm:text-base">
            {active.description}
          </p>

          <div
            role="tablist"
            aria-label="Steps in the baking day"
            className="mt-6 flex gap-2 overflow-x-auto sm:gap-3"
          >
            {steps.map((step, index) => (
              <button
                key={index}
                type="button"
                role="tab"
                aria-selected={index === activeIndex}
                onClick={() => setActiveIndex(index)}
                className={cn(
                  "shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-semibold tracking-wide whitespace-nowrap transition-colors sm:text-sm",
                  index === activeIndex
                    ? "border-terracotta-500 bg-terracotta-600 text-white"
                    : "border-cream-50/30 text-cream-50/80 hover:border-cream-50/60 hover:text-cream-50",
                )}
              >
                {step.time}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
