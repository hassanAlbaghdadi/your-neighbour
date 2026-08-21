import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ProductCard } from "./product-card";
import type { Product } from "@/lib/services/products/get-products";

const addItemMock = vi.fn();
const trackMock = vi.fn();
const adjustQuantityMock = vi.fn();

// `items` drives the footer: the card shows Add to Cart while this variant
// isn't in the cart and swaps to a stepper once it is. Empty here so these
// tests exercise the add path.
let cartItems: { variantId: string; quantity: number }[] = [];

vi.mock("@/context/cart-context", () => ({
  useCart: () => ({
    items: cartItems,
    addItem: addItemMock,
    adjustQuantity: adjustQuantityMock,
  }),
}));

vi.mock("@/lib/analytics", () => ({
  track: (...args: unknown[]) => trackMock(...args),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn() },
}));

const product: Product = {
  id: "product-1",
  category_id: null,
  name: "Sourdough Loaf",
  slug: "sourdough-loaf",
  description: null,
  image_url: null,
  is_available: true,
  preparation_notice: null,
  allergens: null,
  display_order: 0,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  category: null,
  variants: [
    {
      id: "variant-1",
      product_id: "product-1",
      label: "Large",
      price: 8.5,
      image_url: null,
      is_available: true,
      display_order: 0,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    },
  ],
};

describe("ProductCard", () => {
  beforeEach(() => {
    addItemMock.mockReset();
    trackMock.mockReset();
    adjustQuantityMock.mockReset();
    cartItems = [];
  });

  it("displays the price formatted, but adds the raw numeric price to the cart", () => {
    render(<ProductCard product={product} />);

    expect(screen.getByText("$8.50")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /add to cart/i }));

    expect(addItemMock).toHaveBeenCalledTimes(1);
    const [payload] = addItemMock.mock.calls[0] as [{ price: unknown }];
    expect(payload.price).toBe(8.5);
    expect(typeof payload.price).toBe("number");
  });

  it("swaps Add to Cart for a stepper once this variant is in the cart", () => {
    // The footer is the only place the menu tells you what you've already
    // picked up -- the header badge is in the far corner and the toast is
    // gone in two seconds.
    cartItems = [{ variantId: "variant-1", quantity: 2 }];
    render(<ProductCard product={product} />);

    expect(
      screen.queryByRole("button", { name: /add to cart/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /increase/i }));
    expect(adjustQuantityMock).toHaveBeenCalledWith("variant-1", 1);

    fireEvent.click(screen.getByRole("button", { name: /remove|decrease/i }));
    expect(adjustQuantityMock).toHaveBeenCalledWith("variant-1", -1);
  });

  it("still fires the add_to_cart analytics event unchanged", () => {
    render(<ProductCard product={product} />);

    fireEvent.click(screen.getByRole("button", { name: /add to cart/i }));

    expect(trackMock).toHaveBeenCalledWith(
      "add_to_cart",
      expect.objectContaining({ product: "Sourdough Loaf" }),
    );
  });
});
