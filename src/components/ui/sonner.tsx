"use client"

import { useSyncExternalStore } from "react"
import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

const MOBILE_QUERY = "(width < 640px)"

function subscribe(onChange: () => void) {
  const mql = window.matchMedia(MOBILE_QUERY)
  mql.addEventListener("change", onChange)
  return () => mql.removeEventListener("change", onChange)
}

/**
 * Server snapshot is `false`, which is safe: the toaster renders an empty
 * list until something fires a toast, so there is nothing to mismatch.
 */
function useIsMobile() {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(MOBILE_QUERY).matches,
    () => false,
  )
}

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()
  const isMobile = useIsMobile()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      // Bottom-centre is where a phone puts toasts by default, and on the
      // menu that is exactly where the price and Add to Cart sit -- the
      // control you just tapped, and the one you tap again to change the
      // quantity, covered for two seconds by a confirmation about the tap
      // you already made. Top on mobile also puts it next to the cart badge
      // it is talking about. Desktop keeps the corner, where nothing
      // overlaps and the pointer is nowhere near it.
      position={isMobile ? "top-center" : "bottom-right"}
      // Clears the 64px sticky header so the toast sits under it rather than
      // on top of the cart badge it is talking about.
      mobileOffset={{ top: "72px", left: "16px", right: "16px" }}
      className="toaster group"
      icons={{
        success: (
          <CircleCheckIcon className="size-4" />
        ),
        info: (
          <InfoIcon className="size-4" />
        ),
        warning: (
          <TriangleAlertIcon className="size-4" />
        ),
        error: (
          <OctagonXIcon className="size-4" />
        ),
        loading: (
          <Loader2Icon className="size-4 animate-spin" />
        ),
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
