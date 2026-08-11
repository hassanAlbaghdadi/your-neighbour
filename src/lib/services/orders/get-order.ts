import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/serviceRole";
import type { OrderResult } from "@/lib/services/orders/create-order";

/**
 * Fetched by opaque UUID right after checkout for the confirmation page.
 * Uses the service-role client since `orders` isn't publicly readable —
 * the unguessable id is the access control here, same model as most
 * checkout-confirmation flows.
 */
export async function getOrderById(id: string): Promise<OrderResult | null> {
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
    total: order.total,
    status: order.status,
    items: (items ?? []).map((item) => ({
      productName: item.product_name,
      variantLabel: item.variant_label,
      quantity: item.quantity,
      unitPrice: item.unit_price,
    })),
  };
}
