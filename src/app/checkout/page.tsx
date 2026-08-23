import { format, addDays } from "date-fns";
import { getSettings } from "@/lib/services/settings/get-settings";
import { getOrderCountsByDate } from "@/lib/services/orders/get-order-counts";
import { MapPin } from "lucide-react";
import { CheckoutForm } from "@/components/checkout/checkout-form";

export default async function CheckoutPage() {
  const today = new Date();
  const rangeEnd = addDays(today, 60);

  const [settings, orderCounts] = await Promise.all([
    getSettings(),
    getOrderCountsByDate(
      format(today, "yyyy-MM-dd"),
      format(rangeEnd, "yyyy-MM-dd"),
    ),
  ]);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="font-heading text-3xl font-semibold text-foreground">
        Checkout
      </h1>
      <p className="mt-2 text-muted-foreground">
        Pick a pickup date and time, then tell us how to reach you.
      </p>

      {/* Before the form, not after it. Pickup-only means "where do I
          collect this?" is a question the customer needs answered while
          deciding whether to pay -- not once they already have. */}
      {settings.pickupAddress && (
        <div className="mt-6 flex items-start gap-2 rounded-xl border border-border bg-card p-4 text-sm">
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
              className="text-primary underline underline-offset-4"
            >
              Open in maps
            </a>
          </div>
        </div>
      )}

      <CheckoutForm settings={settings} orderCounts={orderCounts} />
    </div>
  );
}
