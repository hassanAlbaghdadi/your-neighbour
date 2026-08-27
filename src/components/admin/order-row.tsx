"use client";

import { useState } from "react";
import { format, parseISO } from "date-fns";
import { ChevronDown, ChevronRight } from "lucide-react";
import { OrderStatusSelect } from "@/components/admin/order-status-select";
import { cn, formatPrice } from "@/lib/utils";
import type { OrderListItem } from "@/lib/services/orders/get-orders";

export function OrderRow({
  order,
  overdue = false,
}: {
  order: OrderListItem;
  /** Pickup date has passed and the order still isn't closed out. Styling only -- no new status. */
  overdue?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasDetails = order.items.length > 0 || !!order.notes;
  const dialableCustomerPhone = order.customerPhone.replace(/[^\d+]/g, "");

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
          {/* Phone is stored exactly as the customer typed it (parens, dashes,
              spaces, an optional leading +), so it's displayed as-is; tel:/sms:
              only need the digits (and a leading + if the customer gave one) to
              dial correctly. */}
          <div className="text-xs text-muted-foreground">
            <a href={`tel:${dialableCustomerPhone}`} className="hover:text-foreground hover:underline">
              {order.customerPhone}
            </a>
            {" · "}
            <a href={`sms:${dialableCustomerPhone}`} className="hover:text-foreground hover:underline">
              Text
            </a>
          </div>
        </td>
        <td
          className={cn(
            "px-4 py-3 whitespace-nowrap text-foreground",
            overdue && "font-medium text-destructive",
          )}
        >
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
          {/* flex+gap spaces the item list and the note regardless of which
              one is actually present, instead of a margin conditioned on
              what precedes it -- the previous version of this needed its
              own case-by-case logic and was easy to get wrong the next time
              what could be optional here changed (see git history). */}
          <td className="px-4 py-3" colSpan={5}>
            <div className="flex max-w-md flex-col gap-3">
              {order.items.length > 0 && (
                <ul className="flex flex-col gap-1.5">
                  {order.items.map((item, index) => (
                    <li
                      key={`${item.productName}::${item.variantLabel ?? ""}::${index}`}
                      className="flex items-baseline justify-between gap-4"
                    >
                      <span className="text-sm text-foreground">
                        {item.productName}
                        {item.variantLabel && (
                          <span className="text-muted-foreground"> — {item.variantLabel}</span>
                        )}
                      </span>
                      {/* The quantity is the one number she's actually
                          scanning for -- bumped up in size and weight so it
                          reads before the product name does, not after. */}
                      <span className="shrink-0 text-base font-semibold text-foreground tabular-nums">
                        ×{item.quantity}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {/* Full contrast, not muted -- a customer note can be an
                  allergy or a substitution, not just trivia, so it shouldn't
                  read as less important than the line above it. */}
              {order.notes && (
                <p className="text-sm">
                  <span className="font-medium text-foreground">Note: </span>
                  <span className="text-foreground">{order.notes}</span>
                </p>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
