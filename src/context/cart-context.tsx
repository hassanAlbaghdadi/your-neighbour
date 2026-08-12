"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { CartItem } from "@/types/cart";
import { MAX_ITEM_QUANTITY } from "@/lib/validations/order";
import { cartItemsSchema } from "@/lib/validations/cart";

const STORAGE_KEY = "your-neighbour-cart";

interface CartContextValue {
  items: CartItem[];
  itemCount: number;
  subtotal: number;
  addItem: (item: Omit<CartItem, "quantity">, quantity?: number) => void;
  removeItem: (variantId: string) => void;
  updateQuantity: (variantId: string, quantity: number) => void;
  clearCart: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        // Validated, not just JSON-parsed: a stale cart from before a
        // CartItem field was added/renamed would otherwise load with
        // undefined fields instead of being treated as corrupt.
        const parsed = cartItemsSchema.safeParse(JSON.parse(stored));
        if (parsed.success) {
          // Deliberately deferred to an effect rather than a lazy useState
          // initializer: localStorage isn't available during SSR, so reading
          // it eagerly would make the client's first render disagree with
          // the server-rendered HTML (e.g. the header's cart-count badge)
          // and trigger a hydration mismatch. This is the documented
          // exception in React's own guidance — syncing with an external
          // system the server can't see — so the setState-in-effect lint
          // rule is a false positive here.
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setItems(parsed.data);
        }
      } catch {
        // Corrupted (non-JSON) cart data — start fresh rather than crash.
      }
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items, hydrated]);

  function addItem(item: Omit<CartItem, "quantity">, quantity = 1) {
    setItems((current) => {
      const existing = current.find((i) => i.variantId === item.variantId);
      if (existing) {
        return current.map((i) =>
          i.variantId === item.variantId
            ? { ...i, quantity: Math.min(i.quantity + quantity, MAX_ITEM_QUANTITY) }
            : i,
        );
      }
      return [...current, { ...item, quantity: Math.min(quantity, MAX_ITEM_QUANTITY) }];
    });
  }

  function removeItem(variantId: string) {
    setItems((current) => current.filter((i) => i.variantId !== variantId));
  }

  function updateQuantity(variantId: string, quantity: number) {
    if (quantity <= 0) {
      removeItem(variantId);
      return;
    }
    const clamped = Math.min(quantity, MAX_ITEM_QUANTITY);
    setItems((current) =>
      current.map((i) =>
        i.variantId === variantId ? { ...i, quantity: clamped } : i,
      ),
    );
  }

  function clearCart() {
    setItems([]);
  }

  const itemCount = useMemo(
    () => items.reduce((sum, i) => sum + i.quantity, 0),
    [items],
  );
  const subtotal = useMemo(
    () => items.reduce((sum, i) => sum + i.price * i.quantity, 0),
    [items],
  );

  const value: CartContextValue = {
    items,
    itemCount,
    subtotal,
    addItem,
    removeItem,
    updateQuantity,
    clearCart,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
