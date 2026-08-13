import "server-only";
import { z } from "zod";
import { createServiceRoleClient } from "@/lib/supabase/serviceRole";
import { getSettings } from "@/lib/services/settings/get-settings";
import type { CreateOrderInput } from "@/lib/validations/order";
import type { OrderStatus, PaymentStatus } from "@/types/database";

const uuidSchema = z.string().uuid();

export class OrderError extends Error {}

export interface OrderResultItem {
  productName: string;
  variantLabel: string | null;
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
  paymentStatus: PaymentStatus;
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

  // Fast, friendly pre-check — not the actual guarantee. Two requests for
  // a nearly-full date could both pass this and still both reach the RPC
  // below; create_order_atomic re-checks the same limit under a
  // per-pickup-date lock, which is what actually prevents overselling.
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

  const variantIds = input.items.map((item) => item.variantId);
  const { data: variants, error: variantsError } = await supabase
    .from("product_variants")
    .select("id, label, price, is_available, product:products(id, name, is_available)")
    .in("id", variantIds);
  if (variantsError) {
    throw new Error(`Failed to verify products: ${variantsError.message}`);
  }

  const variantMap = new Map(
    (variants as unknown as Array<{
      id: string;
      label: string;
      price: number;
      is_available: boolean;
      product: { id: string; name: string; is_available: boolean } | null;
    }>).map((variant) => [variant.id, variant]),
  );
  for (const item of input.items) {
    const variant = variantMap.get(item.variantId);
    if (!variant || !variant.product || !variant.product.is_available || !variant.is_available) {
      throw new OrderError(
        "Some items in your cart are no longer available.",
      );
    }
  }

  const orderItems = input.items.map((item) => {
    const variant = variantMap.get(item.variantId)!;
    return {
      product_id: variant.product!.id,
      product_name: variant.product!.name,
      variant_id: variant.id,
      variant_label: variant.label,
      quantity: item.quantity,
      unit_price: variant.price,
    };
  });
  const subtotal = orderItems.reduce(
    (sum, item) => sum + item.unit_price * item.quantity,
    0,
  );
  const total = subtotal;

  // A single RPC call: the order row and its items are inserted inside one
  // PL/pgSQL function body (see supabase/migrations/004_atomic_writes.sql),
  // so a failure partway through rolls back the whole write instead of
  // leaving an order with no items behind. It also re-checks
  // p_max_orders_per_day itself under a per-pickup-date lock (see
  // 006_atomic_capacity_check.sql) — that's the actual capacity
  // guarantee; the count query above is only a fast pre-check.
  const { data: order, error: orderError } = await supabase.rpc(
    "create_order_atomic",
    {
      p_order_row: {
        id: input.id,
        customer_name: input.customerName,
        customer_email: input.customerEmail,
        customer_phone: input.customerPhone,
        pickup_date: input.pickupDate,
        pickup_time: input.pickupTime,
        notes: input.notes || null,
        subtotal,
        total,
      },
      p_items: orderItems,
      p_max_orders_per_day: settings.maxOrdersPerDay,
    },
  );
  if (orderError?.message === "CAPACITY_FULL") {
    throw new OrderError(
      "Sorry, that pickup date is fully booked. Please choose another date.",
    );
  }
  if (orderError || !order) {
    throw new Error(`Failed to create order: ${orderError?.message}`);
  }

  const result: OrderResult = {
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
    paymentStatus: order.payment_status,
    items: orderItems.map((item) => ({
      productName: item.product_name,
      variantLabel: item.variant_label,
      quantity: item.quantity,
      unitPrice: item.unit_price,
    })),
  };

  // Confirmation emails wait for the Stripe webhook to confirm payment
  // (see mark-order-paid.ts) — sending them here would tell a customer
  // their order is "confirmed" before they've actually paid for it.

  return result;
}

async function getExistingOrder(id: string): Promise<OrderResult | null> {
  // input.id is already validated by createOrderInputSchema before this
  // is reached in practice; kept here too so this function is safe to call
  // with an unvalidated id, matching getOrderById's same defense.
  if (!uuidSchema.safeParse(id).success) return null;

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
    .select("product_name, variant_label, quantity, unit_price")
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
    paymentStatus: order.payment_status,
    items: (items ?? []).map((item) => ({
      productName: item.product_name,
      variantLabel: item.variant_label,
      quantity: item.quantity,
      unitPrice: item.unit_price,
    })),
  };
}
