import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ClearCartOnSuccess } from "@/components/checkout/clear-cart-on-success";
import { PendingPayment } from "@/components/checkout/pending-payment";
import { getOrderById } from "@/lib/services/orders/get-order";
import { getSettings } from "@/lib/services/settings/get-settings";
import { formatPrice } from "@/lib/utils";
import { formatPickupDate, formatPickupTime } from "@/lib/time";

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

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-12 sm:px-6">
      {isPaid && <ClearCartOnSuccess />}
      {isPaid ? (
        <div className="flex flex-col items-center text-center">
          <CheckCircle2 className="size-12 text-primary" />
          <h1 className="mt-4 font-heading text-3xl font-semibold text-foreground">
            Order Confirmed
          </h1>
          <p className="mt-2 text-muted-foreground">
            Thanks, {order.customerName.split(" ")[0]} — we&apos;ll have it
            ready for pickup.
          </p>
        </div>
      ) : (
        // Polls for the webhook to land rather than asking the customer to
        // refresh — Stripe's redirect regularly arrives first. See
        // pending-payment.tsx.
        <PendingPayment />
      )}

      <div className="mt-8 rounded-xl border border-border bg-card p-6">
        <div className="grid grid-cols-2 gap-4 border-b border-border pb-4 text-sm">
          <div>
            <p className="text-muted-foreground">Pickup date</p>
            <p className="font-medium text-foreground">
              {formatPickupDate(order.pickupDate)}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Pickup time</p>
            <p className="font-medium text-foreground">
              {formatPickupTime(order.pickupTime)}
            </p>
          </div>
        </div>

        {settings.pickupAddress && (
          <div className="flex items-start gap-2 border-b border-border py-4 text-sm">
            <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div>
              <p className="text-muted-foreground">Pickup address</p>
              <p className="font-medium text-foreground">
                {settings.pickupAddress}
              </p>
              <a
                href={`https://maps.google.com/?q=${encodeURIComponent(settings.pickupAddress)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-link underline underline-offset-4"
              >
                Open in maps
              </a>
            </div>
          </div>
        )}

        <ul className="flex flex-col gap-3 py-4">
          {order.items.map((item, index) => (
            <li
              key={index}
              className="flex items-center justify-between text-sm"
            >
              <span className="text-foreground">
                {item.quantity} × {item.productName}
                {item.variantLabel && (
                  <span className="text-muted-foreground"> — {item.variantLabel}</span>
                )}
              </span>
              <span className="text-muted-foreground">
                {formatPrice(item.unitPrice * item.quantity)}
              </span>
            </li>
          ))}
        </ul>

        <div className="flex items-center justify-between border-t border-border pt-4 text-base font-medium text-foreground">
          <span>Total</span>
          <span>{formatPrice(order.total)}</span>
        </div>

        {order.notes && (
          <p className="mt-4 rounded-lg bg-muted p-3 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Notes: </span>
            {order.notes}
          </p>
        )}
      </div>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Order #{order.id.slice(0, 8)} · Status: {order.status} · Payment:{" "}
        {isPaid ? "Paid" : "Pending"}
      </p>

      {/* The confirmation page is where someone comes looking when they need
          to change something, so the how-to belongs here rather than only
          on the checkout form they've already left behind. */}
      {isPaid && (
        <p className="mt-3 text-center text-sm text-muted-foreground">
          Need to change or cancel this order?{" "}
          {settings.contactEmail ? (
            <>
              Email{" "}
              <a
                href={`mailto:${settings.contactEmail}?subject=${encodeURIComponent(
                  `Order #${order.id.slice(0, 8)}`,
                )}`}
                className="text-link underline underline-offset-4"
              >
                {settings.contactEmail}
              </a>
            </>
          ) : (
            "Get in touch"
          )}{" "}
          and quote order #{order.id.slice(0, 8)}.
        </p>
      )}

      <div className="mt-8 flex justify-center">
        <Button asChild variant="outline">
          <Link href="/">Back to Menu</Link>
        </Button>
      </div>
    </div>
  );
}
