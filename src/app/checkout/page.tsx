import { format, addDays } from "date-fns";
import { getSettings } from "@/lib/services/settings/get-settings";
import { getOrderCountsByDate } from "@/lib/services/orders/get-order-counts";
import { CheckoutForm } from "@/components/checkout/checkout-form";

export default async function CheckoutPage() {
  const settings = await getSettings();

  const today = new Date();
  const rangeEnd = addDays(today, 60);
  const orderCounts = await getOrderCountsByDate(
    format(today, "yyyy-MM-dd"),
    format(rangeEnd, "yyyy-MM-dd"),
  );

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="font-heading text-3xl font-semibold text-foreground">
        Checkout
      </h1>
      <p className="mt-2 text-muted-foreground">
        Pick a pickup date and time, then tell us how to reach you.
      </p>

      <CheckoutForm settings={settings} orderCounts={orderCounts} />
    </div>
  );
}
