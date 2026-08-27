"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createOrderInputSchema } from "@/lib/validations/order";
import { processNewOrder, OrderError } from "@/lib/services/orders/create-order";
import { createCheckoutSessionForOrder } from "@/lib/services/orders/create-checkout-session";
import { releaseUnstartedReservation } from "@/lib/services/orders/release-unpaid-reservation";
import { updateOrderStatus } from "@/lib/services/orders/update-order-status";
import {
  checkRateLimits,
  getClientIp,
} from "@/lib/services/rate-limit/check-rate-limit";
import { ORDER_STATUSES } from "@/types/database";
import type { OrderResult } from "@/lib/services/orders/create-order";
import type { OrderStatus } from "@/types/database";
import type { ActionResult } from "@/types/action-result";

export interface CreateOrderResult {
  order: OrderResult;
  // null only when the order was already paid (an idempotent resubmit
  // after a successful payment) — there's nothing left to check out.
  checkoutUrl: string | null;
}

// Sized against max_orders_per_day (15 by default), not against what a
// polite client would send: every order created here holds a pickup slot
// until its Stripe session expires, so the limit has to be low enough that
// a single source can't clear a day's capacity. A real customer places
// one order; these leave room for a handful of failed retries on top.
const ORDERS_PER_IP_PER_HOUR = 5;
const ORDERS_PER_EMAIL_PER_HOUR = 3;

export async function createOrderAction(
  payload: unknown,
): Promise<ActionResult<CreateOrderResult>> {
  const parsed = createOrderInputSchema.safeParse(payload);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      success: false,
      error: issue?.message ?? "Invalid order details.",
      // The browser validates the same schema first, so reaching here means
      // the two disagreed. Still name the field: it costs nothing and beats
      // a form that reports a problem it won't point at.
      field: typeof issue?.path[0] === "string" ? issue.path[0] : undefined,
    };
  }

  try {
    const order = await processNewOrder(parsed.data);
    if (order.paymentStatus === "paid") {
      return { success: true, data: { order, checkoutUrl: null } };
    }

    // Checked here rather than before processNewOrder: the business-rule
    // rejections it throws for (blackout date, inside the notice window,
    // fully booked, an item withdrawn) are walls a customer can hit through
    // no fault of their own, several times, while placing zero real orders.
    // Counting those against the limit could lock someone out of ordering
    // entirely without them ever having consumed a pickup slot. This only
    // runs once an order has actually reserved one.
    //
    // Checked on both axes because either alone is easy to slip: one IP can
    // cycle through throwaway emails, and one email can be submitted from a
    // pool of addresses.
    const withinLimits = await checkRateLimits([
      {
        scope: "order:ip",
        identifier: await getClientIp(),
        limit: ORDERS_PER_IP_PER_HOUR,
        windowSeconds: 3600,
      },
      {
        scope: "order:email",
        identifier: parsed.data.customerEmail.toLowerCase(),
        limit: ORDERS_PER_EMAIL_PER_HOUR,
        windowSeconds: 3600,
      },
    ]);
    if (!withinLimits) {
      await releaseUnstartedReservation(order.id);
      return {
        success: false,
        error:
          "That's a lot of orders in a short time. Please wait a little while before placing another, or get in touch and we'll sort it out.",
      };
    }

    try {
      const checkoutUrl = await createCheckoutSessionForOrder(order);
      return { success: true, data: { order, checkoutUrl } };
    } catch (checkoutError) {
      // No Stripe session was ever created, so nothing will ever expire it
      // — release the pickup-capacity slot this order reserved ourselves
      // rather than leaving it stuck for good.
      await releaseUnstartedReservation(order.id);
      throw checkoutError;
    }
  } catch (error) {
    if (error instanceof OrderError) {
      // Logged, not just returned. These are the walls a real customer hits
      // -- fully booked, too little notice, an item withdrawn since they
      // added it -- and every one of them ends a checkout that got as far as
      // filling in the whole form. Without this line they leave no trace
      // anywhere: no row, no event, nothing to explain a quiet week.
      console.warn("Order rejected:", {
        reason: error.message,
        field: error.field,
      });
      return {
        success: false,
        error: error.message,
        field: error.field ?? undefined,
      };
    }
    console.error("createOrderAction failed:", error);
    return {
      success: false,
      error: "Something went wrong placing your order. Please try again.",
    };
  }
}

const orderStatusSchema = z.enum(ORDER_STATUSES as [OrderStatus, ...OrderStatus[]]);

export async function updateOrderStatusAction(
  orderId: string,
  status: OrderStatus,
): Promise<ActionResult<null>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: "Unauthorized" };
  }

  const parsedStatus = orderStatusSchema.safeParse(status);
  if (!parsedStatus.success) {
    return { success: false, error: "Invalid status." };
  }

  try {
    await updateOrderStatus(orderId, parsedStatus.data);
    revalidatePath("/admin");
    return { success: true };
  } catch (error) {
    console.error("updateOrderStatusAction failed:", error);
    return { success: false, error: "Failed to update order status." };
  }
}
