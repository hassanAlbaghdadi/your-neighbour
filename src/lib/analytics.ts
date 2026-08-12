type EventPayload = Record<string, string | number | boolean>;

declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
  }
}

/**
 * Pre-launch placeholder for real analytics: pushes to window.dataLayer (the
 * format GA4/GTM/Vercel Analytics all read natively) so wiring up a real
 * tool later is a config change, not a rewrite. Logs in dev for visibility.
 */
export function track(event: string, payload: EventPayload = {}) {
  if (typeof window === "undefined") return;
  window.dataLayer = window.dataLayer ?? [];
  window.dataLayer.push({ event, ...payload, timestamp: Date.now() });
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
