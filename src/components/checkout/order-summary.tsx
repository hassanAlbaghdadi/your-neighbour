"use client";

import { useState } from "react";
import Image from "next/image";
import { ChevronDown, ImageOff, Pencil } from "lucide-react";
import { useCart } from "@/context/cart-context";
import {
  SERVICE_FEE_RATE_LABEL,
  calculateOrderTotals,
  fromCents,
  toCents,
} from "@/lib/pricing/order-totals";
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

  // Same function the server runs in create-order.ts, over the same cents,
  // so the figure on this screen is the figure Stripe charges rather than
  // a second implementation that agrees with it most of the time. Purely
  // for display — the server recomputes all of it from the database and
  // never trusts a number that came from here.
  const { feeCents, totalCents } = calculateOrderTotals(toCents(subtotal));
  const serviceFee = fromCents(feeCents);
  const total = fromCents(totalCents);

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
        {/* Hidden once open: the Total row below says the same thing.
            Collapsed, this is the only place the figure appears — so it has
            to be the total, fee included. Showing the subtotal here would
            make the one number a phone customer sees the one number that
            isn't what they pay. */}
        {!expanded && (
          <span className="text-sm font-semibold text-foreground tabular-nums">
            {formatPrice(total)}
          </span>
        )}
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

        {/* Itemised rather than rolled into one figure. The fee is small
            enough that hiding it saves nothing and costs the "why is this
            more than the menu said" email — and the percentage next to the
            dollar amount is what shows it was calculated rather than
            invented. Stripe's own page itemises it identically one screen
            later (see create-checkout-session.ts), so there is no number
            waiting there that the customer hasn't already agreed to. */}
        <div className="mt-4 flex flex-col gap-2 border-t border-border pt-4 text-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span>Subtotal</span>
            <span className="tabular-nums">{formatPrice(subtotal)}</span>
          </div>
          <div className="flex items-center justify-between text-muted-foreground">
            <span>{SERVICE_FEE_RATE_LABEL}</span>
            <span className="tabular-nums">{formatPrice(serviceFee)}</span>
          </div>
          <div className="flex items-center justify-between text-base font-medium text-foreground">
            <span>Total</span>
            <span className="tabular-nums">{formatPrice(total)}</span>
          </div>
        </div>

        {/* Still worth saying, and still the same job it did before: the
            customer is otherwise left assuming a tax line waits on the next
            screen, which is the most common reason a cart is abandoned at
            exactly this point. Reworded because the old copy ("No tax or
            delivery fees — this is the final price") stopped being true the
            moment a fee appeared above it. Deliberately doesn't reprint the
            figure: it is already directly above, and on the button. */}
        <p className="mt-2 text-xs text-muted-foreground">
          No tax or delivery — the total above is what you&rsquo;ll pay.
        </p>
      </div>
    </aside>
  );
}
