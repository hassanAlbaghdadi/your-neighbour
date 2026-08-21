"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Minus, Plus, X } from "lucide-react";
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

interface CartDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  minAdvanceHours: number;
}

export function CartDrawer({
  open,
  onOpenChange,
  minAdvanceHours,
}: CartDrawerProps) {
  const { items, subtotal, adjustQuantity, removeItem } = useCart();

  useEffect(() => {
    if (open) toast.dismiss();
  }, [open]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Your Cart</SheetTitle>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-muted-foreground">
            Your cart is empty. Add something fresh from the menu.
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-4">
            <ul className="divide-y divide-border">
              {items.map((item) => (
                <li key={item.variantId} className="flex items-center gap-3 py-4">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-foreground">
                      {item.name}
                      {item.variantLabel && (
                        <span className="text-muted-foreground"> — {item.variantLabel}</span>
                      )}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {formatPrice(item.price)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="icon-sm"
                      onClick={() => adjustQuantity(item.variantId, -1)}
                      aria-label={`Decrease quantity of ${item.name}`}
                    >
                      <Minus />
                    </Button>
                    <span className="w-5 text-center text-sm tabular-nums">
                      {item.quantity}
                    </span>
                    <Button
                      variant="outline"
                      size="icon-sm"
                      disabled={item.quantity >= MAX_ITEM_QUANTITY}
                      onClick={() => adjustQuantity(item.variantId, 1)}
                      aria-label={`Increase quantity of ${item.name}`}
                    >
                      <Plus />
                    </Button>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeItem(item.variantId)}
                    aria-label={`Remove ${item.name} from cart`}
                    className="text-muted-foreground transition-colors hover:text-destructive"
                  >
                    <X className="size-4" />
                  </button>
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
              Pickup only — orders need {minAdvanceHours} hours’ notice.
              You’ll pick a day and time next.
            </p>
            <div className="flex items-center justify-between text-base font-medium text-foreground">
              <span>Subtotal</span>
              <span>{formatPrice(subtotal)}</span>
            </div>
            <Button asChild size="lg" onClick={() => onOpenChange(false)}>
              <Link href="/checkout">Checkout</Link>
            </Button>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}
