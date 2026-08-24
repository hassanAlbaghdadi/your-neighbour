import { describe, it, expect, beforeEach } from "vitest";
import { useEffect } from "react";
import { render, screen, within } from "@testing-library/react";
import { CartProvider, useCart } from "@/context/cart-context";
import { CartDrawer } from "./cart-drawer";

const STORAGE_KEY = "your-neighbour-cart";

const ITEMS = [
  {
    productId: "p1",
    variantId: "v1",
    name: "Cheesecake",
    variantLabel: '9" Pan',
    slug: "cheesecake",
    price: 35,
    quantity: 2,
    imageUrl: null,
  },
  {
    productId: "p2",
    variantId: "v2",
    name: "A Little Mix",
    variantLabel: "6 Mix Pieces",
    slug: "a-little-mix",
    price: 25,
    quantity: 1,
    imageUrl: null,
  },
];

// The drawer reads its own open state from the cart context now (checkout
// needs to open it too, so the header can't own it any more). Nothing in
// the provider's public surface opens it on mount, so this flips it via the
// same hook the header uses.
function OpenOnMount() {
  const { openCart } = useCart();
  useEffect(() => {
    openCart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

function renderDrawer() {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ITEMS));
  return render(
    <CartProvider>
      <OpenOnMount />
      <CartDrawer minAdvanceHours={48} />
    </CartProvider>,
  );
}

describe("CartDrawer", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("shows the line total, not the unit price", async () => {
    // 2 x $35 previously rendered as "$35.00" and left the customer to
    // multiply, with only the subtotal to reconcile it against.
    renderDrawer();

    expect(await screen.findByText("$70.00")).toBeInTheDocument();
    expect(screen.getByText("$25.00")).toBeInTheDocument();
  });

  it("gives the remove control a tap target that clears WCAG 2.5.8", async () => {
    // Was a bare 16x16 button sitting next to "+", under the 24px floor and
    // one mis-tap from deleting a $25-95 line instead of incrementing it.
    renderDrawer();

    const remove = await screen.findByRole("button", {
      name: /remove cheesecake, 9" pan, from cart/i,
    });
    expect(remove.className).toMatch(/size-11/);
  });

  it("names the variant in the remove label, so the two rows are distinguishable", async () => {
    renderDrawer();

    expect(
      await screen.findByRole("button", { name: /remove cheesecake, 9" pan/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /remove a little mix, 6 mix pieces/i }),
    ).toBeInTheDocument();
  });

  it("keeps the variant visible instead of truncating it away", async () => {
    // Name and variant shared one truncated line, so '9" Pan' -- the size,
    // and the entire reason for the price -- was what got cut.
    renderDrawer();

    expect(await screen.findByText('9" Pan')).toBeInTheDocument();
    expect(screen.getByText("6 Mix Pieces")).toBeInTheDocument();
  });

  it("puts the item count in the title", async () => {
    renderDrawer();

    const heading = await screen.findByRole("heading", { name: /your cart/i });
    expect(within(heading).getByText("(3)")).toBeInTheDocument();
  });

  it("still totals the cart correctly in the footer", async () => {
    renderDrawer();

    expect(await screen.findByText("$95.00")).toBeInTheDocument();
  });
});
