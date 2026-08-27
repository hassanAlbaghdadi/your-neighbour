"use client";

import { useEffect } from "react";
import { track } from "@/lib/analytics";

/**
 * Rendered on the confirmation page only once payment_status is "paid" --
 * mounted the same way as ClearCartOnSuccess, right beside it.
 *
 * This is the one event that answers "how many of the people we sent to
 * Stripe actually paid." Without it, payment_redirect (checkout-form.tsx)
 * is the last funnel step ever recorded, and conversion past that point is
 * invisible.
 *
 * Plain track(), not trackOnce(): trackOnce dedupes by event name for the
 * whole browser session, which would silently drop a second real order
 * placed in the same sitting. A page refresh double-counting one order is
 * a much smaller error than undercounting a genuine second conversion.
 */
export function TrackOrderConfirmed() {
  useEffect(() => {
    track("order_confirmed");
  }, []);

  return null;
}
