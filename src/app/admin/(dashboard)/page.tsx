import Link from "next/link";
import { Fragment } from "react";
import { format, addDays, subDays, parseISO } from "date-fns";
import { getOrders } from "@/lib/services/orders/get-orders";
import { getBakingSummary } from "@/lib/services/orders/get-baking-summary";
import { OrderRow } from "@/components/admin/order-row";
import { PageHeader } from "@/components/admin/page-header";
import { PrintButton } from "@/components/admin/print-button";
import { resolveSummaryDate } from "@/lib/utils";
import { businessToday } from "@/lib/time";

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const showHistory = params.view === "history";
  const today = businessToday();

  // The forward book: every paid order not yet closed out, nearest pickup
  // first -- this is the whole admin screen now, not one tab among four.
  // History (Fulfilled) is a separate, explicit request via ?view=history
  // rather than something shown by default.
  //
  // Marking an order Fulfilled drops it out of openOnly immediately, which
  // is right once the day is over but wrong mid-service: mark one order
  // picked up, the same customer comes back two minutes later for a second
  // order under a different name, and it's already gone from the screen.
  // Today's fulfilled orders stay in the list through the rest of the day;
  // anything fulfilled on an earlier day has already rolled off to history.
  const [openOrders, fulfilledToday] = showHistory
    ? [[], []]
    : await Promise.all([
        getOrders({ openOnly: true }),
        getOrders({ status: "Fulfilled", pickupDate: today }),
      ]);
  const orders = showHistory
    ? await getOrders({ status: "Fulfilled" })
    : [...openOrders, ...fulfilledToday].sort(
        (a, b) =>
          a.pickupDate.localeCompare(b.pickupDate) ||
          a.pickupTime.localeCompare(b.pickupTime),
      );

  // The baking summary used to default to "today", which orders can never
  // land on -- pickups need 48h notice, so today's (and often tomorrow's)
  // list is permanently closed by the time anyone opens this page. Default
  // to the earliest date that actually has an order instead. `orders` is
  // already sorted by pickup_date ascending, so the first one at or after
  // today is it; if nothing qualifies (an open order stuck in the past, or
  // no orders at all), fall back to today and let the existing empty state
  // say so.
  const earliestUpcoming = openOrders.find((o) => o.pickupDate >= today)?.pickupDate;
  const summaryDateParam =
    typeof params.summaryDate === "string" ? params.summaryDate : undefined;
  const summaryDate = resolveSummaryDate(summaryDateParam, earliestUpcoming ?? today);
  const bakingSummary = await getBakingSummary(summaryDate);

  const prevDate = format(subDays(parseISO(summaryDate), 1), "yyyy-MM-dd");
  const nextDate = format(addDays(parseISO(summaryDate), 1), "yyyy-MM-dd");
  const viewParam = showHistory ? "&view=history" : "";

  return (
    <div className="flex flex-col gap-8">
      <div className="print:hidden">
        <PageHeader
          title="Orders"
          description="What to bake, and which orders are still open."
        />
      </div>

      <section className="rounded-xl border border-border bg-card p-6 print:border-0 print:p-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-heading text-lg font-semibold text-foreground">
            Daily Baking Summary
          </h2>
          <div className="flex items-center gap-3 text-sm">
            <Link
              href={`/admin?summaryDate=${prevDate}${viewParam}`}
              className="text-muted-foreground hover:text-foreground print:hidden"
              aria-label="Previous day"
            >
              ←
            </Link>
            <span className="font-medium text-foreground">
              {format(parseISO(summaryDate), "EEEE, MMMM d, yyyy")}
            </span>
            <Link
              href={`/admin?summaryDate=${nextDate}${viewParam}`}
              className="text-muted-foreground hover:text-foreground print:hidden"
              aria-label="Next day"
            >
              →
            </Link>
            <PrintButton />
          </div>
        </div>

        {bakingSummary.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            No orders for this date yet.
          </p>
        ) : (
          <ul className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
            {bakingSummary.map((item) => (
              <li
                key={`${item.productName}::${item.variantLabel ?? ""}`}
                className="flex items-center justify-between text-sm"
              >
                <span className="text-foreground">
                  {item.productName}
                  {item.variantLabel && (
                    <span className="text-muted-foreground"> — {item.variantLabel}</span>
                  )}
                </span>
                <span className="font-medium text-foreground">
                  ×{item.quantity}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-heading text-lg font-semibold text-foreground">
            {showHistory ? "Past orders" : "Open orders"}
          </h2>
          {showHistory ? (
            <Link
              href={`/admin?summaryDate=${summaryDate}`}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              ← Back to open orders
            </Link>
          ) : (
            <Link
              href={`/admin?summaryDate=${summaryDate}&view=history`}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Past orders →
            </Link>
          )}
        </div>

        <div className="mt-4 overflow-hidden rounded-xl border border-border">
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left text-muted-foreground">
              <tr>
                <th className="w-8 px-2 py-2" aria-hidden />
                <th className="px-4 py-2 font-medium">Customer</th>
                <th className="px-4 py-2 font-medium">Pickup</th>
                <th className="px-4 py-2 font-medium">Items</th>
                <th className="px-4 py-2 font-medium">Total</th>
                <th className="px-4 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-card">
              {orders.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-muted-foreground"
                  >
                    {showHistory ? "No past orders yet." : "No open orders."}
                  </td>
                </tr>
              ) : (
                orders.map((order, index) => {
                  // A plain divider marking where "today or overdue" ends
                  // and the rest of the forward book begins -- not a
                  // grouped view, just one label inserted into an
                  // otherwise flat, already-sorted list.
                  const isFirstUpcoming =
                    !showHistory &&
                    order.pickupDate > today &&
                    (index === 0 || orders[index - 1].pickupDate <= today);
                  return (
                    <Fragment key={order.id}>
                      {isFirstUpcoming && (
                        <tr className="bg-muted/60">
                          <td
                            colSpan={6}
                            className="px-4 py-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground"
                          >
                            Upcoming
                          </td>
                        </tr>
                      )}
                      <OrderRow
                        order={order}
                        overdue={!showHistory && order.pickupDate < today}
                      />
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
          </div>
        </div>
      </section>
    </div>
  );
}
