import "server-only";
import { z } from "zod";
import { createServiceRoleClient } from "@/lib/supabase/serviceRole";
import type { OrderResult } from "@/lib/services/orders/create-order";

const uuidSchema = z.string().uuid();

/**
 * Fetched by opaque UUID right after checkout for the confirmation page.
 * Uses the service-role client since `orders` isn't publicly readable —
 * the unguessable id is the access control here, same model as most
 * checkout-confirmation flows.
 */
export async function getOrderById(id: string): Promise<OrderResult | null> {
  // A malformed id (bad paste, truncated link, bot probing) makes Postgres
  // reject the `.eq("id", id)` query below with an "invalid input syntax
  // for type uuid" error, which the code re-throws — treat it the same as
  // "not found" instead, since there had been no error boundary to catch it.
  if (!uuidSchema.safeParse(id).success) return null;

  const supabase = createServiceRoleClient();

  const { data: order, error } = await supabase
    .from("orders")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    throw new Error(`Failed to load order: ${error.message}`);
  }
  if (!order) return null;

  const { data: items, error: itemsError } = await supabase
    .from("order_items")
    .select("product_name, variant_label, quantity, unit_price")
    .eq("order_id", id);
  if (itemsError) {
    throw new Error(`Failed to load order items: ${itemsError.message}`);
  }

  return {
    id: order.id,
    customerName: order.customer_name,
    customerEmail: order.customer_email,
    customerPhone: order.customer_phone,
    pickupDate: order.pickup_date,
    pickupTime: order.pickup_time.slice(0, 5),
    notes: order.notes,
    subtotal: order.subtotal,
    serviceFee: order.service_fee,
    total: order.total,
    status: order.status,
    paymentStatus: order.payment_status,
    items: (items ?? []).map((item) => ({
      productName: item.product_name,
      variantLabel: item.variant_label,
      quantity: item.quantity,
      unitPrice: item.unit_price,
    })),
  };
}
