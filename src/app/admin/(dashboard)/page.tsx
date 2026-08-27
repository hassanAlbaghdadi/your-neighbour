import Link from "next/link";
import { format, addDays, subDays, parseISO } from "date-fns";
import { getOrders } from "@/lib/services/orders/get-orders";
import { getBakingSummary } from "@/lib/services/orders/get-baking-summary";
import { OrderRow } from "@/components/admin/order-row";
import { PageHeader } from "@/components/admin/page-header";
import { StatTile } from "@/components/admin/stat-tile";
import { PrintButton } from "@/components/admin/print-button";
import { Badge } from "@/components/ui/badge";
import { formatPrice, resolveSummaryDate } from "@/lib/utils";
import { businessToday } from "@/lib/time";
import type { OrderStatus } from "@/types/database";

const FILTERS = ["today", "new", "ready", "fulfilled"] as const;
type Filter = (typeof FILTERS)[number];

const FILTER_LABELS: Record<Filter, string> = {
  today: "Today",
  new: "New",
  ready: "Ready",
  fulfilled: "Fulfilled",
};

const STATUS_BY_FILTER: Record<Exclude<Filter, "today">, OrderStatus> = {
  new: "New",
  ready: "Ready",
  fulfilled: "Fulfilled",
};

function isFilter(value: unknown): value is Filter {
  return typeof value === "string" && (FILTERS as readonly string[]).includes(value);
}

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const filter = isFilter(params.filter) ? params.filter : "today";

  const today = businessToday();
  const summaryDate = resolveSummaryDate(
    typeof params.summaryDate === "string" ? params.summaryDate : undefined,
    today,
  );

  const [orders, bakingSummary, todaysOrders] = await Promise.all([
    getOrders(
      filter === "today"
        ? { pickupDate: today }
        : { status: STATUS_BY_FILTER[filter] },
    ),
    getBakingSummary(summaryDate),
    getOrders({ pickupDate: today }),
  ]);

  // An order row exists from the moment "Continue to payment" is clicked and
  // survives as Cancelled after an abandoned checkout, so counting every row
  // overstates both tiles -- and revenue is the one number here that reads as
  // money. Cancelled orders stay visible in the list below; they just don't
  // count.
  const liveOrders = todaysOrders.filter((o) => o.status !== "Cancelled");
  const todaysOrderCount = liveOrders.length;
  const newCount = liveOrders.filter((o) => o.status === "New").length;
  const todaysRevenue = liveOrders
    .filter((o) => o.paymentStatus === "paid")
    .reduce((sum, o) => sum + o.total, 0);

  const prevDate = format(subDays(parseISO(summaryDate), 1), "yyyy-MM-dd");
  const nextDate = format(addDays(parseISO(summaryDate), 1), "yyyy-MM-dd");

  return (
    <div className="flex flex-col gap-8">
      <div className="print:hidden">
        <PageHeader
          title="Orders"
          description="Review pickups and manage order status."
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 print:hidden">
        <StatTile label="Today's Orders" value={String(todaysOrderCount)} />
        <StatTile label="New" value={String(newCount)} accent="primary" />
        <StatTile label="Today's Revenue" value={formatPrice(todaysRevenue)} accent="secondary" />
      </div>

      <section className="rounded-xl border border-border bg-card p-6 print:border-0 print:p-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-heading text-lg font-semibold text-foreground">
            Daily Baking Summary
          </h2>
          <div className="flex items-center gap-3 text-sm">
            <Link
              href={`/admin?filter=${filter}&summaryDate=${prevDate}`}
              className="text-muted-foreground hover:text-foreground print:hidden"
              aria-label="Previous day"
            >
              ←
            </Link>
            <span className="font-medium text-foreground">
              {format(parseISO(summaryDate), "EEEE, MMMM d, yyyy")}
            </span>
            <Link
              href={`/admin?filter=${filter}&summaryDate=${nextDate}`}
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
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <Badge
              key={f}
              asChild
              variant={filter === f ? "default" : "outline"}
              className="cursor-pointer px-3 py-1 text-sm"
            >
              <Link href={`/admin?filter=${f}&summaryDate=${summaryDate}`}>
                {FILTER_LABELS[f]}
              </Link>
            </Badge>
          ))}
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
                    No orders in this view.
                  </td>
                </tr>
              ) : (
                orders.map((order) => <OrderRow key={order.id} order={order} />)
              )}
            </tbody>
          </table>
          </div>
        </div>
      </section>
    </div>
  );
}
