"use client";

import { useEffect, useRef } from "react";
import { useCart } from "@/context/cart-context";

/**
 * Rendered on the confirmation page only once an order's payment_status is
 * "paid". The cart is intentionally left alone until this point — see the
 * comment in checkout-form.tsx's onSubmit — so an abandoned Stripe
 * Checkout attempt returns the customer to a cart that's still there.
 */
export function ClearCartOnSuccess() {
  const { hydrated, clearCart } = useCart();
  const cleared = useRef(false);

  useEffect(() => {
    // Stripe's redirect back is a real navigation, so CartProvider mounts
    // fresh here and its own effect re-reads the (still-populated)
    // localStorage cart. That effect commits after this one — child effects
    // run before their parent's — so clearing before hydration finishes
    // gets silently overwritten by the stale cart it loads back in. Waiting
    // for hydrated guarantees the clear is the last write.
    if (!hydrated || cleared.current) return;
    cleared.current = true;
    clearCart();
  }, [hydrated, clearCart]);

  return null;
}
