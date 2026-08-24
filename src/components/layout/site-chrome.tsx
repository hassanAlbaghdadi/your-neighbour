"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { CheckoutHeader } from "@/components/layout/checkout-header";
import { CheckoutFooter } from "@/components/layout/checkout-footer";
import { CartDrawer } from "@/components/cart/cart-drawer";

interface SiteChromeProps {
  minAdvanceHours: number;
  businessName: string;
  contactEmail: string;
  categories: { id: string; name: string }[];
  children: ReactNode;
}

/**
 * Picks the header and footer a route gets.
 *
 * A client component reading the pathname, rather than route groups with
 * two layouts: the alternative would mean moving every existing page into
 * an `(site)` group to change one route's chrome, and the admin section —
 * which nests its own layout under the site one — would have to move with
 * them. `children` stays a prop, so everything inside still renders on the
 * server; only the choice of wrapper is client-side.
 *
 * The cart drawer lives here rather than inside either header, because both
 * of them open it and only one of them is ever mounted.
 */
export function SiteChrome({
  minAdvanceHours,
  businessName,
  contactEmail,
  categories,
  children,
}: SiteChromeProps) {
  const pathname = usePathname();
  const isCheckout = pathname === "/checkout";

  return (
    <>
      {isCheckout ? <CheckoutHeader /> : <SiteHeader />}

      <main className="flex flex-1 flex-col">{children}</main>

      {isCheckout ? (
        <CheckoutFooter
          businessName={businessName}
          contactEmail={contactEmail}
        />
      ) : (
        <SiteFooter
          businessName={businessName}
          contactEmail={contactEmail}
          categories={categories}
        />
      )}

      <CartDrawer minAdvanceHours={minAdvanceHours} />
    </>
  );
}
