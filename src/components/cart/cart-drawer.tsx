"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { ImageOff, Minus, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { useCart } from "@/context/cart-context";
import { MAX_ITEM_QUANTITY } from "@/lib/validations/order";
import { formatPrice } from "@/lib/utils";
import { track } from "@/lib/analytics";

interface CartDrawerProps {
  minAdvanceHours: number;
}

export function CartDrawer({ minAdvanceHours }: CartDrawerProps) {
  // Checkout opens this same drawer as its "Edit order" affordance, so the
  // footer has to stop describing checkout as something still ahead of them.
  const onCheckout = usePathname() === "/checkout";
  const {
    items,
    itemCount,
    subtotal,
    adjustQuantity,
    removeItem,
    cartOpen: open,
    setCartOpen: onOpenChange,
  } = useCart();

  useEffect(() => {
    if (open) toast.dismiss();
  }, [open]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle>
            Your Cart
            {itemCount > 0 && (
              <span className="font-normal text-muted-foreground">
                {" "}
                ({itemCount})
              </span>
            )}
          </SheetTitle>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-muted-foreground">
            Your cart is empty. Add something fresh from the menu.
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-4">
            <ul className="divide-y divide-border">
              {items.map((item) => (
                <li key={item.variantId} className="flex gap-3 py-4">
                  {/* The cart already carried imageUrl and never rendered it.
                      Four of the products are the same bread under a
                      different drizzle, so on the one screen that reviews
                      the order before payment, the photo is the fastest way
                      to catch the wrong one. */}
                  <div className="relative size-14 shrink-0 overflow-hidden rounded-md bg-muted">
                    {/* Sized rather than `fill`, and requested at 112 for a
                        box that paints at 56.

                        `fill` makes next/image emit the whole candidate
                        ladder (32w ... 3840w). The product card has already
                        fetched the same photo at 750w, so the browser reuses
                        that cached candidate rather than refetching a small
                        one -- reasonable of it, but it leaves a 48KB JPEG
                        being decoded into a 56px box, six times over.

                        112 rather than 56 because a sized image only gets 1x
                        and 2x candidates: asking for 56 caps the ladder at
                        128w, which a DPR-3 phone upscales into a
                        168-device-pixel box and renders permanently soft.
                        112 moves it to 128w/256w, so 3x screens get a sharp
                        candidate and the transfer is still ~3KB instead of
                        48KB. `size-full` keeps it painted at 56 CSS px. */}
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

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      {/* Name and variant on separate lines. Together on one
                          truncated line, the variant was what got cut --
                          "Cheesecake — 9" Pan" rendered as "Cheesecake..." --
                          hiding the size on a menu where the size is most of
                          the decision and all of the price. */}
                      <div className="min-w-0">
                        <p className="font-medium text-foreground">{item.name}</p>
                        {item.variantLabel && (
                          <p className="text-sm text-muted-foreground">
                            {item.variantLabel}
                          </p>
                        )}
                      </div>

                      {/* 44px hit area around a 16px glyph, and moved to the
                          opposite corner from the stepper. It used to be a
                          bare 16x16 button immediately beside "+" -- under
                          the 24px WCAG 2.5.8 floor, and one fat thumb from
                          deleting a line rather than incrementing it. Now
                          that singles are gone, that line is $25-95. */}
                      <button
                        type="button"
                        onClick={() => removeItem(item.variantId)}
                        aria-label={`Remove ${item.name}, ${item.variantLabel}, from cart`}
                        className="-mt-2 -mr-2 flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-destructive focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                      >
                        <X className="size-4" />
                      </button>
                    </div>

                    <div className="mt-2 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <Button
                          variant="outline"
                          size="icon-sm"
                          onClick={() => adjustQuantity(item.variantId, -1)}
                          aria-label={`Decrease quantity of ${item.name}, ${item.variantLabel}`}
                        >
                          <Minus />
                        </Button>
                        <span
                          aria-live="polite"
                          aria-atomic="true"
                          className="w-5 text-center text-sm tabular-nums"
                        >
                          {item.quantity}
                        </span>
                        <Button
                          variant="outline"
                          size="icon-sm"
                          disabled={item.quantity >= MAX_ITEM_QUANTITY}
                          onClick={() => adjustQuantity(item.variantId, 1)}
                          aria-label={`Increase quantity of ${item.name}, ${item.variantLabel}`}
                        >
                          <Plus />
                        </Button>
                      </div>

                      {/* The line total, not the unit price. The old row
                          showed "$35.00" next to a quantity of 2 and left
                          the customer to multiply -- and the only other
                          number in the drawer was the subtotal, so there was
                          nothing to reconcile it against. */}
                      <span className="text-sm font-medium text-foreground tabular-nums">
                        {formatPrice(item.price * item.quantity)}
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {items.length > 0 && (
          <SheetFooter className="border-t border-border">
            {/* Lead time was stated once on the homepage and then nowhere
                else until create-order rejected the order outright. Someone
                could fill a cart, reach checkout and only there discover
                they can't have it when they need it -- so it belongs at the
                point the cart is committed, not just on a page they may
                never have scrolled through. */}
            <p className="text-xs text-muted-foreground">
              {onCheckout
                ? "Change quantities here, then close to finish your order."
                : `Pickup only — orders need ${minAdvanceHours} hours’ notice. You’ll pick a day and time next.`}
            </p>
            <div className="flex items-center justify-between text-base font-medium text-foreground">
              <span>Subtotal</span>
              <span>{formatPrice(subtotal)}</span>
            </div>
            {onCheckout ? (
              <Button size="lg" onClick={() => onOpenChange(false)}>
                Done
              </Button>
            ) : (
              <Button
                asChild
                size="lg"
                onClick={() => {
                  track("begin_checkout", {
                    value: subtotal,
                    items: itemCount,
                  });
                  onOpenChange(false);
                }}
              >
                <Link href="/checkout">Checkout</Link>
              </Button>
            )}
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}
