import { track as vercelTrack } from "@vercel/analytics";

type EventPayload = Record<string, string | number | boolean>;

declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
  }
}

/**
 * Fans one call out to two places.
 *
 * `window.dataLayer` is kept because it costs nothing and is the format a
 * tag manager would read if one is ever added. The Vercel call is the part
 * that actually records anything: until it was added, all fourteen call
 * sites pushed into an array no code on the site ever read, so the funnel
 * these events exist to measure was invisible while the code looked
 * instrumented.
 *
 * Cookieless and same-origin, which is why it needs no consent banner under
 * PIPEDA and no third-party origin in the CSP.
 */
export function track(event: string, payload: EventPayload = {}) {
  if (typeof window === "undefined") return;
  window.dataLayer = window.dataLayer ?? [];
  window.dataLayer.push({ event, ...payload, timestamp: Date.now() });
  vercelTrack(event, payload);
  if (process.env.NODE_ENV !== "production") {
    console.log(`[track] ${event}`, payload);
  }
}

/** Fires at most once per browser session — for view/impression events that would otherwise fire on every scroll past the target. */
export function trackOnce(event: string, payload: EventPayload = {}) {
  if (typeof window === "undefined") return;
  const key = `tracked:${event}`;
  if (window.sessionStorage.getItem(key)) return;
  window.sessionStorage.setItem(key, "1");
  track(event, payload);
}
