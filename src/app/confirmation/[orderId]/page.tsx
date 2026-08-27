import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, MapPin, CalendarPlus, Navigation } from "lucide-react";
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
    <div className="mx-auto w-full max-w-2xl px-4 py-12 sm:px-6">
      <ClearCartOnSuccess />
      <TrackOrderConfirmed />

      <div className="flex flex-col items-center text-center">
        <CheckCircle2 className="size-11 text-primary" />
        <h1 className="mt-3 font-heading text-3xl font-semibold text-foreground">
          Order Confirmed
        </h1>
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
          Pickup
        </p>
        <div className="mt-3 flex items-baseline justify-between text-foreground">
          <span className="font-medium">
            {formatPickupDate(order.pickupDate)}
          </span>
          <span className="font-medium">
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
                <Navigation /> Directions
              </a>
            </Button>
          )}
        </div>

        <div className="mt-5 border-t border-border pt-5">
          <p className="text-xs font-semibold tracking-wider text-terracotta-600 uppercase">
            Your order
          </p>
          <ul className="mt-3 flex flex-col gap-2">
            {visibleItems.map((item, index) => (
              <li
                key={index}
                className="flex items-center justify-between text-sm"
              >
                <span className="text-foreground">
                  {item.quantity} × {item.productName}
                  {item.variantLabel && (
                    <span className="text-muted-foreground">
                      {" "}
                      — {item.variantLabel}
                    </span>
                  )}
                </span>
                <span className="text-muted-foreground">
                  {formatPrice(item.unitPrice * item.quantity)}
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
              <li className="text-sm text-muted-foreground">
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
          rendering an empty-looking box. "You told us" rather than "Notes:"
          -- the label is the only difference, but one reads as a field
          dump and the other as someone confirming they actually read it. */}
      {hasNotes && (
        <p className="mt-4 rounded-xl bg-muted px-5 py-4 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">You told us: </span>
          {order.notes}
        </p>
      )}

      {/* 1. Order badge */}
      <p className="mt-5 text-center text-sm text-muted-foreground">
        Order #{order.id.slice(0, 8)} · Paid
      </p>

      {/* 2. Compact support line. The order number still reaches Sarah --
          via the mailto subject instead of spelled out in visible text, so
          the "quote your order number" job the old longer line did isn't
          lost, only moved off the page. Falls back to plain text, matching
          the original's behaviour, when no contact address is configured. */}
      <p className="mt-2 text-center text-sm text-muted-foreground">
        {settings.contactEmail ? (
          <>
            Need to make changes?{" "}
            <a
              href={`mailto:${settings.contactEmail}?subject=${encodeURIComponent(`Order #${order.id.slice(0, 8)}`)}`}
              className="text-link underline underline-offset-4"
            >
              Email us
            </a>
          </>
        ) : (
          "Need to make changes? Get in touch."
        )}
      </p>

      {/* 3. Warm closing & CTA. Back to Menu is a plain link, not a bordered
          button -- there's no competing action left on the page for it to
          out-rank, so the padding and border were pure weight with nothing
          to justify it. Matches how "Email us" above is already styled, so
          the page ends with one consistent kind of quiet link. Every other
          page that speaks in Sarah's own voice (the founder note, Our
          Story's pull quote) uses the heading serif to mark that shift from
          information to person -- this is the last thing before they leave
          the page, so it's the right place for the one line that isn't
          logistics. */}
      <p className="mt-4 text-center font-heading text-lg text-espresso-700">
        Can&apos;t wait to bake this for you! — Sarah
      </p>

      <p className="mt-3 text-center">
        <Link
          href="/"
          className="text-sm text-link underline underline-offset-4"
        >
          Back to Menu
        </Link>
      </p>
    </div>
  );
}
