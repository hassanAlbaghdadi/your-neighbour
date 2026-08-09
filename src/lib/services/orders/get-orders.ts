import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { OrderStatus } from "@/types/database";

export interface OrderListItem {
  id: string;
  customerName: string;
  customerPhone: string;
  pickupDate: string;
  pickupTime: string;
  total: number;
  status: OrderStatus;
  itemCount: number;
}

interface GetOrdersFilter {
  status?: OrderStatus;
  pickupDate?: string;
}

interface OrderRow {
  id: string;
  customer_name: string;
  customer_phone: string;
  pickup_date: string;
  pickup_time: string;
  total: number;
  status: OrderStatus;
  order_items: { quantity: number }[];
}

/** Authenticated admin read — relies on RLS ("Admin Full Orders"), not service-role. */
export async function getOrders(
  filter: GetOrdersFilter = {},
): Promise<OrderListItem[]> {
  const supabase = await createClient();

  let query = supabase
    .from("orders")
    .select(
      "id, customer_name, customer_phone, pickup_date, pickup_time, total, status, order_items(quantity)",
    )
    .order("pickup_date", { ascending: true })
    .order("pickup_time", { ascending: true });

  if (filter.status) {
    query = query.eq("status", filter.status);
  }
  if (filter.pickupDate) {
    query = query.eq("pickup_date", filter.pickupDate);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to load orders: ${error.message}`);
  }

  return (data as unknown as OrderRow[]).map((order) => ({
    id: order.id,
    customerName: order.customer_name,
    customerPhone: order.customer_phone,
    pickupDate: order.pickup_date,
    pickupTime: order.pickup_time.slice(0, 5),
    total: order.total,
    status: order.status,
    itemCount: order.order_items.reduce((sum, item) => sum + item.quantity, 0),
  }));
}
