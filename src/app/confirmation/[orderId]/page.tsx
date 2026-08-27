import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  CheckCircle2,
  MapPin,
  CalendarPlus,
  Navigation,
  ImageOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ClearCartOnSuccess } from "@/components/checkout/clear-cart-on-success";
import { PendingPayment } from "@/components/checkout/pending-payment";
import { TrackOrderConfirmed } from "@/components/checkout/track-order-confirmed";
import { getOrderById } from "@/lib/services/orders/get-order";
import { getSettings } from "@/lib/services/settings/get-settings";
import { SERVICE_FEE_LABEL } from "@/lib/pricing/order-totals";
import { formatPrice } from "@/lib/utils";
import { formatPickupDate, formatPickupTime } from "@/lib/time";

import type { Metadata } from "next";

const MAX_VISIBLE_ITEMS = 4;

/**
 * A Google Calendar "add event" link needs the pickup date/time expressed
 * without ambiguity about which timezone they're in. Rather than convert to
 * UTC by hand -- easy to get wrong across the AST/ADT daylight-saving
 * boundary -- this passes the wall-clock time as-is and tells Google which
 * zone to interpret it in via ctz. No date-math library needed for one link.
 */
function toCalendarStamp(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
}

function googleCalendarUrl(opts: {
  pickupDate: string;
  pickupTime: string;
  businessName: string;
  address: string | null;
}): string {
  const [year, month, day] = opts.pickupDate.split("-").map(Number);
  const [hour, minute] = opts.pickupTime.split(":").map(Number);
  // A real Date, not string/modulo arithmetic on the parts -- a naive
  // "(minute + 30) % 60" approach breaks at the hour boundary (23:50 + 30min
  // produces an invalid "24:20") and doesn't roll the date forward either.
  // Date.setMinutes handles both correctly.
  const start = new Date(year, month - 1, day, hour, minute);
  const end = new Date(start);
  end.setMinutes(end.getMinutes() + 30);

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `Pickup — ${opts.businessName}`,
    dates: `${toCalendarStamp(start)}/${toCalendarStamp(end)}`,
    ctz: "America/Halifax",
  });
  if (opts.address) params.set("location", opts.address);
  return `https://calendar.google.com/calendar/render?${params}`;
}

// This page renders a customer's first name, pickup time and collection
// address. The order id is an unguessable uuid and nothing links here, so the
// realistic risk is low -- but the cost of being wrong is someone's pickup
// address in a search result, and this is three lines.
export const metadata: Metadata = {
  title: "Order Confirmed | Your Neighbour",
  robots: { index: false, follow: false },
};

export default async function ConfirmationPage(
  props: PageProps<"/confirmation/[orderId]">,
) {
  const { orderId } = await props.params;
  const [order, settings] = await Promise.all([
    getOrderById(orderId),
    getSettings(),
  ]);

  if (!order) {
    notFound();
  }

  const isPaid = order.paymentStatus === "paid";

  if (!isPaid) {
    // Polls for the webhook to land rather than asking the customer to
    // refresh -- Stripe's redirect regularly arrives first. See
    // pending-payment.tsx. Nothing else renders alongside it: the pickup
    // card below now carries "add to calendar" / "get directions" actions,
    // which don't belong on an order that isn't confirmed paid yet.
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-12 sm:px-6">
        <PendingPayment />
      </div>
    );
  }

  const hasNotes = Boolean(order.notes?.trim());
  const visibleItems = order.items.slice(0, MAX_VISIBLE_ITEMS);
  const hiddenCount = order.items.length - visibleItems.length;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pt-6 pb-12 sm:px-6">
      <ClearCartOnSuccess />
      <TrackOrderConfirmed />

      {/* Order reference as a top-right pill rather than a line of body text
          at the foot of the page -- it's the one thing a customer comes
          back to quote, so it reads better parked where a receipt number
          usually sits. "Paid" isn't repeated here: the check, the heading
          and "we've sent your receipt" already carry it. */}
      <div className="flex justify-end">
        <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
          Order #{order.id.slice(0, 8)}
        </span>
      </div>

      <div className="mt-2 flex flex-col items-center text-center">
        <div className="flex items-center gap-2.5">
          <CheckCircle2 className="size-8 shrink-0 text-primary" />
          <h1 className="font-heading text-3xl font-semibold text-foreground">
            Order Confirmed!
          </h1>
        </div>
        {/* "Ready for pickup" dropped: the very next section is labeled
            PICKUP with the date, time and address, so it was telling the
            reader something the page says again two inches lower. The
            spam caveat dropped too -- anyone who doesn't get the receipt
            has "Need to make changes? Email us" below already, so it
            wasn't load-bearing, just a hedge that undercut the one line
            on the page that should be uncomplicated good news. */}
        <p className="mt-2 text-muted-foreground">
          Thanks {order.customerName.split(" ")[0]}! We&apos;ve sent your
          receipt to {order.customerEmail}.
        </p>
      </div>

      <div className="mt-6 rounded-xl border border-border bg-card p-6 sm:p-7">
        <p className="text-xs font-semibold tracking-wider text-terracotta-600 uppercase">
          Pickup Details
        </p>
        <div className="mt-3 flex items-baseline justify-between gap-3 text-foreground">
          <span className="text-lg font-semibold">
            {formatPickupDate(order.pickupDate)}
          </span>
          <span className="shrink-0 text-lg font-semibold">
            {formatPickupTime(order.pickupTime)}
          </span>
        </div>
        {settings.pickupAddress && (
          <div className="mt-3 flex items-start gap-2 text-sm">
            <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <p className="text-foreground">{settings.pickupAddress}</p>
          </div>
        )}

        {/* Calendar and directions are the two things someone actually needs
            to not miss pickup -- promoted to equal-billing buttons, right
            next to the details they act on, rather than a small link buried
            in the address line and nothing at all for the other. Calendar
            stays the filled/primary of the two: it's the "don't forget this
            happened" action, directions is "help if you need it" -- both
            real, not equally urgent. Directions is dropped (not just
            disabled) when there's no address to route to. */}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button asChild>
            <a
              href={googleCalendarUrl({
                pickupDate: order.pickupDate,
                pickupTime: order.pickupTime,
                businessName: settings.businessName,
                address: settings.pickupAddress,
              })}
              target="_blank"
              rel="noopener noreferrer"
            >
              <CalendarPlus /> Add to calendar
            </a>
          </Button>
          {settings.pickupAddress && (
            <Button asChild variant="outline">
              <a
                href={`https://maps.google.com/?q=${encodeURIComponent(settings.pickupAddress)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Navigation /> Get Directions
              </a>
            </Button>
          )}
        </div>

        <div className="mt-5 border-t border-border pt-5">
          <p className="text-xs font-semibold tracking-wider text-terracotta-600 uppercase">
            Your order
          </p>
          <ul className="mt-3 flex flex-col gap-3">
            {visibleItems.map((item, index) => (
              <li key={index} className="flex items-center gap-3 text-sm">
                {/* Sized at 112 for a 40px box, matching the cart drawer's
                    reasoning: a sized image only gets 1x/2x candidates, so
                    asking for the paint size leaves DPR-3 phones upscaling a
                    soft thumbnail. 112 lands on the 128w/256w rungs. */}
                <div className="relative size-10 shrink-0 overflow-hidden rounded-md bg-muted">
                  {item.imageUrl ? (
                    <Image
                      src={item.imageUrl}
                      alt=""
                      width={112}
                      height={112}
                      className="size-full object-cover"
                    />
                  ) : (
                    <div className="flex size-full items-center justify-center text-muted-foreground">
                      <ImageOff className="size-4" />
                    </div>
                  )}
                </div>
                <span className="min-w-0 flex-1 text-foreground">
                  {item.productName}
                  {item.variantLabel && (
                    <span className="text-muted-foreground">
                      {" "}
                      ({item.variantLabel})
                    </span>
                  )}
                </span>
                <span className="shrink-0 text-muted-foreground">
                  ×{item.quantity} — {formatPrice(item.unitPrice * item.quantity)}
                </span>
              </li>
            ))}
            {/* Caps the row count instead of letting a large order push the
                page past one screen -- the full breakdown still exists, in
                the receipt email and in Sarah's own admin view, so nothing
                is lost, only kept off a page whose job is a quick glance at
                pickup details, not a full itemized reprint. Subtotal below
                already reflects every item, hidden or not. */}
            {hiddenCount > 0 && (
              <li className="text-sm text-muted-foreground ps-[52px]">
                + {hiddenCount} more item{hiddenCount > 1 ? "s" : ""}
              </li>
            )}
          </ul>

          {/* Broken out the same way checkout broke it out, but read off the
              order rather than recomputed, so this shows what was actually
              charged rather than what today's rate would charge.
              SERVICE_FEE_LABEL carries no percentage for the same reason.
              Anything without a positive fee falls back to a plain Total. */}
          <div className="mt-4 flex flex-col gap-1.5 border-t border-border pt-4 text-sm">
            {order.serviceFee > 0 && (
              <>
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Subtotal</span>
                  <span>{formatPrice(order.subtotal)}</span>
                </div>
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>{SERVICE_FEE_LABEL}</span>
                  <span>{formatPrice(order.serviceFee)}</span>
                </div>
              </>
            )}
            <div className="mt-1 flex items-center justify-between text-base font-medium text-foreground">
              <span>Total</span>
              <span>{formatPrice(order.total)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Whitespace-only notes pass the checkout schema today (it has no
          .trim()), so a note of just a few spaces is a real, reachable case
          -- checking .trim() here, not just truthiness, keeps that from
          rendering an empty-looking box. Styled as a callout with a tail
          pointing back at the order card, so it reads as the customer's
          own words rather than a form field dump. The label sits on its own
          line, bold -- enough contrast to read as a label, but sentence
          case rather than the terracotta uppercase eyebrow the main card's
          sections use: this is an aside beside the order, not a section of
          it, and shouldn't rank alongside PICKUP DETAILS / YOUR ORDER. */}
      {hasNotes && (
        <div className="relative mt-5 rounded-xl bg-muted px-5 py-4 text-sm text-muted-foreground">
          {/* A rotated square, half-hidden behind the box's top edge, is the
              speech-bubble tail. rounded-[2px] softens its tip to match the
              container's corners. */}
          <div className="absolute -top-1.5 left-8 size-3 rotate-45 rounded-[2px] bg-muted" />
          <p className="font-semibold text-foreground">Your note to us</p>
          <p className="mt-1">{order.notes}</p>
        </div>
      )}

      {/* One line in Sarah's own voice before the logistics links -- the
          heading serif marks that shift from information to person, the
          same way the founder note and Our Story's pull quote do. Not in
          the mockup, kept on purpose. */}
      <p className="mt-8 text-center font-heading text-lg text-espresso-700">
        Can&apos;t wait to bake this for you! — Sarah
      </p>

      {/* The mockup's footer: a support link and the way back to the menu,
          side by side. Its big "modify your order" button is omitted --
          changes go through the same contact route "Need to make changes?"
          already points at, so the button was a second door to one room.
          The order number rides in the mailto subject, so "quote your
          order number" is covered without spelling it out here. Falls back
          to plain text when no contact address is configured. */}
      <div className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-3">
        {settings.contactEmail ? (
          <a
            href={`mailto:${settings.contactEmail}?subject=${encodeURIComponent(`Order #${order.id.slice(0, 8)}`)}`}
            className="text-sm text-link underline underline-offset-4"
          >
            Need to make changes?
          </a>
        ) : (
          <span className="text-sm text-muted-foreground">
            Need to make changes? Get in touch.
          </span>
        )}
        <Button asChild variant="outline">
          <Link href="/">Back to Menu</Link>
        </Button>
      </div>
    </div>
  );
}
