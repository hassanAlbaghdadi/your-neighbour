import Link from "next/link";
import Image from "next/image";
import { Lock } from "lucide-react";

/**
 * The header checkout gets instead of the site one.
 *
 * The full header carries a hamburger, a home link, Menu, Our story and
 * Instagram; the footer beneath it repeats most of that. That is eleven
 * ways out of a page whose only job is one form, and two of them lead to
 * Instagram. What survives is the logo — pointing at the menu rather than
 * the homepage, because "leave checkout" almost always means "I need
 * another item" — and a secure mark.
 *
 * No cart button: the order summary's "Edit order" opens the same drawer,
 * is always visible, and says what it does.
 */
export function CheckoutHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80">
      <div className="mx-auto flex h-14 max-w-4xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link href="/#menu" className="flex items-center gap-2.5">
          <Image
            src="/brand/mark-black.png"
            alt=""
            width={26}
            height={26}
            priority
            className="shrink-0"
          />
          <span className="font-heading text-lg font-semibold tracking-tight text-foreground">
            Your Neighbour
          </span>
        </Link>

        {/* A glance-level signal, at the top where it frames the form
            rather than arriving after the customer has committed. The detail
            behind it lives once, above the submit button. */}
        <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Lock className="size-3.5" aria-hidden="true" />
          Secure checkout
        </span>
      </div>
    </header>
  );
}
