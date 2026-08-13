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
  const { clearCart } = useCart();
  const cleared = useRef(false);

  useEffect(() => {
    if (cleared.current) return;
    cleared.current = true;
    clearCart();
  }, [clearCart]);

  return null;
}
