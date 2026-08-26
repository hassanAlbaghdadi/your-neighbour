import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { OrderStatus } from "@/types/database";

export interface OrderLineItem {
  productName: string;
  variantLabel: string | null;
  quantity: number;
  unitPrice: number;
}

export interface OrderListItem {
  id: string;
  customerName: string;
  customerPhone: string;
  pickupDate: string;
  pickupTime: string;
  serviceFee: number;
  total: number;
  status: OrderStatus;
  itemCount: number;
  notes: string | null;
  items: OrderLineItem[];
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
  service_fee: number;
  total: number;
  status: OrderStatus;
  notes: string | null;
  order_items: {
    product_name: string;
    variant_label: string | null;
    quantity: number;
    unit_price: number;
  }[];
}

/** Authenticated admin read — relies on RLS ("Admin Full Orders"), not service-role. */
export async function getOrders(
  filter: GetOrdersFilter = {},
): Promise<OrderListItem[]> {
  const supabase = await createClient();

  let query = supabase
    .from("orders")
    .select(
      "id, customer_name, customer_phone, pickup_date, pickup_time, service_fee, total, status, notes, order_items(product_name, variant_label, quantity, unit_price)",
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
    serviceFee: order.service_fee,
    total: order.total,
    status: order.status,
    notes: order.notes,
    itemCount: order.order_items.reduce((sum, item) => sum + item.quantity, 0),
    items: order.order_items.map((item) => ({
      productName: item.product_name,
      variantLabel: item.variant_label,
      quantity: item.quantity,
      unitPrice: item.unit_price,
    })),
  }));
}
