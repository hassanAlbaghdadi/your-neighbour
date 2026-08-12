import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { CartProvider, useCart } from "./cart-context";

const STORAGE_KEY = "your-neighbour-cart";

function renderCart() {
  return renderHook(() => useCart(), { wrapper: CartProvider });
}

describe("CartProvider localStorage validation", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("loads a valid stored cart", async () => {
    const validItem = {
      productId: "p1",
      variantId: "v1",
      name: "Sourdough Loaf",
      variantLabel: "Large",
      slug: "sourdough",
      price: 8,
      quantity: 2,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([validItem]));

    const { result } = renderCart();

    await waitFor(() => expect(result.current.items).toHaveLength(1));
    expect(result.current.items[0]).toMatchObject(validItem);
  });

  it("starts fresh when stored cart is missing a required field", async () => {
    // Simulates a stale cart from before `slug` existed on CartItem.
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        {
          productId: "p1",
          variantId: "v1",
          name: "X",
          variantLabel: "",
          price: 8,
          quantity: 1,
        },
      ]),
    );

    const { result } = renderCart();

    // The write-back effect only fires after hydration completes, so
    // waiting for localStorage to reflect an empty cart proves the invalid
    // stored data was rejected, not just that state hasn't updated yet.
    await waitFor(() =>
      expect(window.localStorage.getItem(STORAGE_KEY)).toBe("[]"),
    );
    expect(result.current.items).toEqual([]);
  });

  it("starts fresh on corrupted (non-JSON) stored cart", async () => {
    window.localStorage.setItem(STORAGE_KEY, "{not-json");

    const { result } = renderCart();

    await waitFor(() =>
      expect(window.localStorage.getItem(STORAGE_KEY)).toBe("[]"),
    );
    expect(result.current.items).toEqual([]);
  });

  it("still clamps quantity to MAX_ITEM_QUANTITY via addItem", async () => {
    const { result } = renderCart();
    await waitFor(() =>
      expect(window.localStorage.getItem(STORAGE_KEY)).toBe("[]"),
    );

    act(() => {
      result.current.addItem(
        {
          productId: "p1",
          variantId: "v1",
          name: "Sourdough Loaf",
          variantLabel: "Large",
          slug: "sourdough",
          price: 8,
        },
        999,
      );
    });

    await waitFor(() => expect(result.current.items[0]?.quantity).toBe(20));
  });
});
