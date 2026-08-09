import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/serviceRole";
import { getSettings } from "@/lib/services/settings/get-settings";
import { sendOrderNotifications } from "@/lib/email/resend";
import type { CreateOrderInput } from "@/lib/validations/order";
import type { OrderStatus } from "@/types/database";

export class OrderError extends Error {}

export interface OrderResultItem {
  productName: string;
  quantity: number;
  unitPrice: number;
}

export interface OrderResult {
  id: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  pickupDate: string;
  pickupTime: string;
  notes: string | null;
  subtotal: number;
  total: number;
  status: OrderStatus;
  items: OrderResultItem[];
}

export async function processNewOrder(
  input: CreateOrderInput,
): Promise<OrderResult> {
  const existing = await getExistingOrder(input.id);
  if (existing) {
    return existing;
  }

  const settings = await getSettings();

  if (!settings.pickupTimeSlots.includes(input.pickupTime)) {
    throw new OrderError("Selected pickup time is no longer available.");
  }

  if (settings.blackoutDates.includes(input.pickupDate)) {
    throw new OrderError("We're closed for orders on the selected date.");
  }

  const pickupDateTime = new Date(`${input.pickupDate}T${input.pickupTime}:00`);
  const minAllowed = new Date(
    Date.now() + settings.minAdvanceHours * 60 * 60 * 1000,
  );
  if (pickupDateTime < minAllowed) {
    throw new OrderError(
      `Orders require at least ${settings.minAdvanceHours} hours notice. Please choose a later pickup date or time.`,
    );
  }

  const supabase = createServiceRoleClient();

  const { count, error: countError } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("pickup_date", input.pickupDate)
    .neq("status", "Cancelled");
  if (countError) {
    throw new Error(`Failed to check capacity: ${countError.message}`);
  }
  if ((count ?? 0) >= settings.maxOrdersPerDay) {
    throw new OrderError(
      "Sorry, that pickup date is fully booked. Please choose another date.",
    );
  }

  const productIds = input.items.map((item) => item.productId);
  const { data: products, error: productsError } = await supabase
    .from("products")
    .select("id, name, price, is_available")
    .in("id", productIds);
  if (productsError) {
    throw new Error(`Failed to verify products: ${productsError.message}`);
  }

  const productMap = new Map(products.map((product) => [product.id, product]));
  for (const item of input.items) {
    const product = productMap.get(item.productId);
    if (!product || !product.is_available) {
      throw new OrderError(
        "Some items in your cart are no longer available.",
      );
    }
  }

  const orderItems = input.items.map((item) => {
    const product = productMap.get(item.productId)!;
    return {
      product_id: product.id,
      product_name: product.name,
      quantity: item.quantity,
      unit_price: product.price,
    };
  });
  const subtotal = orderItems.reduce(
    (sum, item) => sum + item.unit_price * item.quantity,
    0,
  );
  const total = subtotal;

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      id: input.id,
      customer_name: input.customerName,
      customer_email: input.customerEmail,
      customer_phone: input.customerPhone,
      pickup_date: input.pickupDate,
      pickup_time: input.pickupTime,
      notes: input.notes || null,
      subtotal,
      total,
    })
    .select()
    .single();
  if (orderError || !order) {
    throw new Error(`Failed to create order: ${orderError?.message}`);
  }

  const { error: itemsError } = await supabase
    .from("order_items")
    .insert(orderItems.map((item) => ({ ...item, order_id: order.id })));
  if (itemsError) {
    throw new Error(`Failed to save order items: ${itemsError.message}`);
  }

  sendOrderNotifications(order.id).catch((error: unknown) => {
    console.error(
      `Failed to send order notification emails for ${order.id}:`,
      error,
    );
  });

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
    items: orderItems.map((item) => ({
      productName: item.product_name,
      quantity: item.quantity,
      unitPrice: item.unit_price,
    })),
  };
}

async function getExistingOrder(id: string): Promise<OrderResult | null> {
  const supabase = createServiceRoleClient();

  const { data: order, error } = await supabase
    .from("orders")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    throw new Error(`Failed to check existing order: ${error.message}`);
  }
  if (!order) return null;

  const { data: items, error: itemsError } = await supabase
    .from("order_items")
    .select("product_name, quantity, unit_price")
    .eq("order_id", id);
  if (itemsError) {
    throw new Error(`Failed to load existing order items: ${itemsError.message}`);
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
      quantity: item.quantity,
      unitPrice: item.unit_price,
    })),
  };
}
