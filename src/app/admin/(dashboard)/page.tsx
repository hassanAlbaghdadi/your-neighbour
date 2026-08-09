import Link from "next/link";
import { format, addDays, subDays, parseISO } from "date-fns";
import { getOrders } from "@/lib/services/orders/get-orders";
import { getBakingSummary } from "@/lib/services/orders/get-baking-summary";
import { OrderStatusSelect } from "@/components/admin/order-status-select";
import { Badge } from "@/components/ui/badge";
import type { OrderStatus } from "@/types/database";

const FILTERS = ["today", "pending", "preparing", "ready", "completed"] as const;
type Filter = (typeof FILTERS)[number];

const FILTER_LABELS: Record<Filter, string> = {
  today: "Today",
  pending: "Pending",
  preparing: "Preparing",
  ready: "Ready",
  completed: "Completed",
};

const STATUS_BY_FILTER: Record<Exclude<Filter, "today">, OrderStatus> = {
  pending: "Pending",
  preparing: "Preparing",
  ready: "Ready",
  completed: "Completed",
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

  const today = format(new Date(), "yyyy-MM-dd");
  const summaryDate =
    typeof params.summaryDate === "string" ? params.summaryDate : today;

  const [orders, bakingSummary] = await Promise.all([
    getOrders(
      filter === "today"
        ? { pickupDate: today }
        : { status: STATUS_BY_FILTER[filter] },
    ),
    getBakingSummary(summaryDate),
  ]);

  const prevDate = format(subDays(parseISO(summaryDate), 1), "yyyy-MM-dd");
  const nextDate = format(addDays(parseISO(summaryDate), 1), "yyyy-MM-dd");

  return (
    <div className="flex flex-col gap-8">
      <section className="rounded-xl border border-border bg-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-heading text-lg font-semibold text-foreground">
            Daily Baking Summary
          </h2>
          <div className="flex items-center gap-3 text-sm">
            <Link
              href={`/admin?filter=${filter}&summaryDate=${prevDate}`}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Previous day"
            >
              ←
            </Link>
            <span className="font-medium text-foreground">
              {format(parseISO(summaryDate), "EEEE, MMMM d, yyyy")}
            </span>
            <Link
              href={`/admin?filter=${filter}&summaryDate=${nextDate}`}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Next day"
            >
              →
            </Link>
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
                key={item.productName}
                className="flex items-center justify-between text-sm"
              >
                <span className="text-foreground">{item.productName}</span>
                <span className="font-medium text-foreground">
                  ×{item.quantity}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
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
          <table className="w-full text-sm">
            <thead className="bg-muted text-left text-muted-foreground">
              <tr>
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
                    colSpan={5}
                    className="px-4 py-8 text-center text-muted-foreground"
                  >
                    No orders in this view.
                  </td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr key={order.id}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">
                        {order.customerName}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {order.customerPhone}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-foreground">
                      {format(parseISO(order.pickupDate), "MMM d")} ·{" "}
                      {order.pickupTime}
                    </td>
                    <td className="px-4 py-3 text-foreground">
                      {order.itemCount}
                    </td>
                    <td className="px-4 py-3 text-foreground">
                      ${order.total.toFixed(2)}
                    </td>
                    <td className="px-4 py-3">
                      <OrderStatusSelect
                        orderId={order.id}
                        status={order.status}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
