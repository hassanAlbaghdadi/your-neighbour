"use client";

import { useState } from "react";
import { format, parseISO } from "date-fns";
import { ChevronDown, ChevronRight } from "lucide-react";
import { OrderStatusSelect } from "@/components/admin/order-status-select";
import { SERVICE_FEE_LABEL } from "@/lib/pricing/order-totals";
import { cn, formatPrice } from "@/lib/utils";
import type { OrderListItem } from "@/lib/services/orders/get-orders";

export function OrderRow({ order }: { order: OrderListItem }) {
  const [expanded, setExpanded] = useState(false);
  const hasDetails =
    order.items.length > 0 || !!order.notes || order.serviceFee > 0;

  return (
    <>
      <tr>
        <td className="px-2 py-3">
          {hasDetails && (
            <button
              type="button"
              onClick={() => setExpanded((e) => !e)}
              aria-label={expanded ? "Collapse order details" : "Expand order details"}
              className="text-muted-foreground hover:text-foreground"
            >
              {expanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
            </button>
          )}
        </td>
        <td className="px-4 py-3">
          <div className="font-medium text-foreground">{order.customerName}</div>
          <div className="text-xs text-muted-foreground">{order.customerPhone}</div>
        </td>
        <td className="px-4 py-3 whitespace-nowrap text-foreground">
          {format(parseISO(order.pickupDate), "MMM d")} · {order.pickupTime}
        </td>
        <td className="px-4 py-3 text-foreground">{order.itemCount}</td>
        <td className="px-4 py-3 text-foreground">{formatPrice(order.total)}</td>
        <td className="px-4 py-3">
          <OrderStatusSelect orderId={order.id} status={order.status} />
        </td>
      </tr>
      {expanded && hasDetails && (
        <tr className="bg-muted/40">
          <td className="px-2 py-3" />
          <td className="px-4 py-3" colSpan={5}>
            {order.items.length > 0 && (
              <ul className="flex flex-col gap-1">
                {order.items.map((item, index) => (
                  <li
                    key={`${item.productName}::${item.variantLabel ?? ""}::${index}`}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="text-foreground">
                      {item.productName}
                      {item.variantLabel && (
                        <span className="text-muted-foreground"> — {item.variantLabel}</span>
                      )}
                    </span>
                    <span className="text-muted-foreground">×{item.quantity}</span>
                  </li>
                ))}
              </ul>
            )}
            {/* The Total column is what the customer paid; this is the part
                of it that isn't the food. Without it the admin list is the
                one screen where the money doesn't reconcile against the
                receipt the customer is holding. */}
            {order.serviceFee > 0 && (
              <p className={cn("text-sm", order.items.length > 0 && "mt-2")}>
                <span className="font-medium text-foreground">
                  {SERVICE_FEE_LABEL}:{" "}
                </span>
                <span className="text-muted-foreground">
                  {formatPrice(order.serviceFee)} of {formatPrice(order.total)}
                </span>
              </p>
            )}
            {/* Spaced against whatever actually precedes it, which is now
                either the item list or the fee line. Keying the margin off
                the item count alone left the notes flush against the fee on
                an order that has a fee and notes but no items. */}
            {order.notes && (
              <p
                className={cn(
                  "text-sm",
                  (order.items.length > 0 || order.serviceFee > 0) && "mt-2",
                )}
              >
                <span className="font-medium text-foreground">Note: </span>
                <span className="text-muted-foreground">{order.notes}</span>
              </p>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
