"use client";

import { useEffect, useState } from "react";

/**
 * Subscribes to a CSS media query from JS.
 *
 * Starts `false` on every render path — server, first client render, and
 * jsdom — and only flips after mount. That is deliberate: reading
 * `window.matchMedia` during render would make the server's HTML and the
 * client's first pass disagree and blow up hydration. Callers should
 * therefore treat `false` as "not yet known to match", and pick a default
 * that is safe to render before the real answer arrives.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    // Guarded for jsdom, which only gained matchMedia recently and still
    // omits it under some environments.
    if (typeof window.matchMedia !== "function") return;

    const list = window.matchMedia(query);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMatches(list.matches);

    const onChange = (event: MediaQueryListEvent) => setMatches(event.matches);
    list.addEventListener("change", onChange);
    return () => list.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}

/** Tailwind's `sm` breakpoint, as the media query JS needs to ask for it. */
export const BELOW_SM = "(max-width: 639px)";
