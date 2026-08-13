"use client";

import { useEffect, useRef, useState } from "react";

// Fades+rises a block in the first time it scrolls into view — same
// IntersectionObserver primitive already used for analytics (see
// founder-note.tsx), just driving a visual reveal instead of a tracking
// call. Starts "visible" (not "armed") so a block already on screen at
// mount — or a no-JS/pre-hydration render — never renders hidden; it can
// only become "armed" once the observer's first real callback confirms
// the element is off-screen, which requires JS to actually be running.
export function useScrollReveal<T extends HTMLElement>(threshold = 0.2) {
  const ref = useRef<T>(null);
  const [state, setState] = useState<"visible" | "armed">("visible");

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setState("visible");
          observer.disconnect();
        } else {
          setState("armed");
        }
      },
      { threshold },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return { ref, visible: state === "visible" };
}
