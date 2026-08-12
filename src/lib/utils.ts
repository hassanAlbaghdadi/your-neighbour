import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
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
