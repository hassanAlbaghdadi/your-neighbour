"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createOrderInputSchema } from "@/lib/validations/order";
import { processNewOrder, OrderError } from "@/lib/services/orders/create-order";
import { createCheckoutSessionForOrder } from "@/lib/services/orders/create-checkout-session";
import { releaseUnstartedReservation } from "@/lib/services/orders/release-unpaid-reservation";
import { updateOrderStatus } from "@/lib/services/orders/update-order-status";
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

export async function createOrderAction(
  payload: unknown,
): Promise<ActionResult<CreateOrderResult>> {
  const parsed = createOrderInputSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid order details.",
    };
  }

  try {
    const order = await processNewOrder(parsed.data);
    if (order.paymentStatus === "paid") {
      return { success: true, data: { order, checkoutUrl: null } };
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
      return { success: false, error: error.message };
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
