"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createOrderInputSchema } from "@/lib/validations/order";
import { processNewOrder, OrderError } from "@/lib/services/orders/create-order";
import { updateOrderStatus } from "@/lib/services/orders/update-order-status";
import { ORDER_STATUSES } from "@/types/database";
import type { OrderResult } from "@/lib/services/orders/create-order";
import type { OrderStatus } from "@/types/database";

interface ActionResult<T> {
  success: boolean;
  error?: string;
  data?: T;
}

export async function createOrderAction(
  payload: unknown,
): Promise<ActionResult<OrderResult>> {
  const parsed = createOrderInputSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid order details.",
    };
  }

  try {
    const order = await processNewOrder(parsed.data);
    return { success: true, data: order };
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
