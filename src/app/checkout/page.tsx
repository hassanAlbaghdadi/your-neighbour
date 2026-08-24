import { format, addDays } from "date-fns";
import { getSettings } from "@/lib/services/settings/get-settings";
import { getOrderCountsByDate } from "@/lib/services/orders/get-order-counts";
import { CheckoutForm } from "@/components/checkout/checkout-form";
import { AVAILABILITY_WINDOW_DAYS } from "@/lib/checkout/pickup-availability";

export default async function CheckoutPage() {
  const today = new Date();
  const rangeEnd = addDays(today, AVAILABILITY_WINDOW_DAYS);

  const [settings, orderCounts] = await Promise.all([
    getSettings(),
    getOrderCountsByDate(
      format(today, "yyyy-MM-dd"),
      format(rangeEnd, "yyyy-MM-dd"),
    ),
  ]);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 sm:py-10">
      {/* text-2xl on mobile, not text-3xl. Combined with dropping the
          pickup-address card into the form (where it answers a question the
          customer has just asked, rather than one they haven't yet), this
          moves the first thing they can actually touch onto the first
          screen instead of 558px down it. */}
      <h1 className="font-heading text-2xl font-semibold text-foreground sm:text-3xl">
        Checkout
      </h1>

      <CheckoutForm settings={settings} orderCounts={orderCounts} />
    </div>
  );
}
