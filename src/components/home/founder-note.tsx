"use client";

import { useEffect, useRef } from "react";
import { trackOnce } from "@/lib/analytics";

export function FounderNote() {
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
      <p className="mx-auto max-w-2xl px-4 py-6 text-center font-heading text-base text-espresso-700 sm:px-6">
        Baked by Sarah in the North End — every order is proofed and baked
        fresh, never pulled from a shelf.
      </p>
    </section>
  );
}
