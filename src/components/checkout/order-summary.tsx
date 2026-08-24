"use client";

import { useState } from "react";
import Image from "next/image";
import { ChevronDown, ImageOff, Pencil } from "lucide-react";
import { useCart } from "@/context/cart-context";
import { cn, formatPrice } from "@/lib/utils";

/**
 * The order review that sits above the form on mobile and beside it on
 * desktop.
 *
 * It used to be strictly worse than the cart drawer one screen earlier: no
 * photo, no way to change a quantity, no way back. That is backwards — this
 * is the screen where the money is committed, and four of the products are
 * the same bread under a different topping, so the photo is the fastest way
 * to catch the wrong one. "Edit order" reopens the real cart rather than
 * rebuilding steppers here, so there is exactly one place quantities change.
 *
 * Collapsed by default below `lg`, because fully expanded it was 195px of a
 * 558px run-up before the customer could touch anything. The total stays on
 * screen either way — that is the part they came here to check.
 */
export function OrderSummary() {
  const { items, itemCount, subtotal, openCart } = useCart();
  const [expanded, setExpanded] = useState(false);

  return (
    <aside className="h-fit rounded-xl border border-border bg-card p-4 sm:p-5 lg:sticky lg:top-20 lg:order-2">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-heading text-lg font-semibold text-foreground">
          Order Summary
        </h2>
        <button
          type="button"
          onClick={openCart}
          className="flex items-center gap-1.5 rounded-md text-sm font-medium text-link underline underline-offset-4 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <Pencil className="size-3.5" aria-hidden="true" />
          Edit order
        </button>
      </div>

      {/* The disclosure is mobile-only: on desktop the column has the room,
          and a summary you have to open is just a step. */}
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls="order-summary-details"
        onClick={() => setExpanded((open) => !open)}
        className="mt-3 flex w-full items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5 text-left lg:hidden"
      >
        <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
          {itemCount} {itemCount === 1 ? "item" : "items"}
          <ChevronDown
            className={cn(
              "size-4 text-muted-foreground transition-transform",
              expanded && "rotate-180",
            )}
            aria-hidden="true"
          />
        </span>
        <span className="text-sm font-semibold text-foreground tabular-nums">
          {formatPrice(subtotal)}
        </span>
      </button>

      <div
        id="order-summary-details"
        className={cn("mt-4", !expanded && "hidden lg:block")}
      >
        <ul className="flex flex-col gap-3">
          {items.map((item) => (
            <li key={item.variantId} className="flex items-center gap-3 text-sm">
              {/* Requested at 112 to match the cart drawer exactly, so the
                  browser serves this from the candidate it already fetched
                  there rather than pulling a second size. Painted at 48. */}
              <div className="relative size-12 shrink-0 overflow-hidden rounded-md bg-muted">
                {item.imageUrl ? (
                  <Image
                    src={item.imageUrl}
                    alt=""
                    width={112}
                    height={112}
                    className="size-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-muted-foreground">
                    <ImageOff className="size-4" />
                  </div>
                )}
              </div>

              <span className="min-w-0 flex-1 text-foreground">
                {item.quantity} × {item.name}
                {item.variantLabel && (
                  <span className="block text-muted-foreground">
                    {item.variantLabel}
                  </span>
                )}
              </span>

              <span className="shrink-0 text-muted-foreground tabular-nums">
                {formatPrice(item.price * item.quantity)}
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-4 flex items-center justify-between border-t border-border pt-4 text-base font-medium text-foreground">
          <span>Total</span>
          <span className="tabular-nums">{formatPrice(subtotal)}</span>
        </div>

        {/* The Stripe session sets no automatic tax and there is no delivery,
            so this figure really is final. Saying so is free — the customer
            is otherwise left to assume a tax line is waiting on the next
            screen, which is the single most common reason a cart is
            abandoned at exactly this point. */}
        <p className="mt-2 text-xs text-muted-foreground">
          No tax or delivery fees — {formatPrice(subtotal)} is the final total.
        </p>
      </div>
    </aside>
  );
}
