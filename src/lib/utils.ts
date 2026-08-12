import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { isValid, parseISO } from "date-fns"
import type { MouseEvent } from "react"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Smooth-scrolls to an in-page anchor even when the URL hash already points
 * there — clicking a same-hash link fires no `hashchange`, so the browser's
 * native anchor scroll silently no-ops on a second click (e.g. hero CTA or
 * footer link after the user has scrolled back up). Falls through to normal
 * link navigation when the target isn't on the current page.
 */
export function scrollToAnchor(
  event: MouseEvent<HTMLAnchorElement>,
  id: string,
) {
  const target = document.getElementById(id)
  if (!target) return
  event.preventDefault()
  target.scrollIntoView({ behavior: "smooth", block: "start" })
  history.pushState(null, "", `#${id}`)
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

/**
 * Falls back to `today` for anything that isn't a well-formed date string —
 * feeding an unvalidated query param straight into date-fns#parseISO throws
 * a RangeError on invalid input, which previously had no error boundary to
 * catch it (crashed the whole admin dashboard on a typo'd URL).
 */
export function resolveSummaryDate(param: string | undefined, today: string): string {
  if (typeof param !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(param)) {
    return today
  }
  return isValid(parseISO(param)) ? param : today
}

const priceFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
})

/**
 * Centralizes the `$X.XX` display format used across cart, checkout, admin,
 * and email receipts — previously each call site hand-rolled its own
 * `$${x.toFixed(2)}` template, risking drift (e.g. no thousands separator
 * on a large total).
 */
export function formatPrice(amount: number): string {
  return priceFormatter.format(amount)
}
