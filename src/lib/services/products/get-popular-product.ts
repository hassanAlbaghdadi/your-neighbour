import "server-only";
import { cache } from "react";
import { createServiceRoleClient } from "@/lib/supabase/serviceRole";

/**
 * How many separate orders a product needs before it can be called the most
 * popular one. Below this the "winner" is noise — with two orders on the
 * books the first thing anyone bought would wear the badge, which is how a
 * badge meant to summarise what customers choose ends up inventing that
 * claim instead.
 */
const MIN_ORDERS = 5;

/**
 * "Popular" means recently popular. An all-time count would let a product
 * that sold well one season keep the badge long after the menu moved on,
 * and it can never be dislodged by a newer item without accumulating years
 * of history first.
 */
const WINDOW_DAYS = 90;

/**
 * The product customers ordered most often in the recent window, or null
 * when there isn't a defensible answer.
 *
 * Counts *orders containing* the product, not units sold. Units would hand
 * the badge to whatever comes in the largest pack — a single 24-piece box
 * outweighs twenty-four people each choosing something else — which
 * measures pack size rather than popularity.
 *
 * Returns null on a tie as well as below the floor: two products cannot
 * both be the most popular one, and picking a winner arbitrarily would put
 * a claim on the page that the data doesn't support.
 *
 * Service-role client for the same reason as getOrderCountsByDate: `orders`
 * is not publicly readable under RLS, and only this single derived id is
 * ever exposed to the storefront — never an order row.
 */
export const getMostPopularProductId = cache(async (): Promise<string | null> => {
  const supabase = createServiceRoleClient();
  const since = new Date(
    Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  // !inner so the filters on the embedded order actually restrict the rows
  // returned rather than just nulling the embed out.
  const { data, error } = await supabase
    .from("order_items")
    .select("product_id, order_id, orders!inner(payment_status, created_at)")
    .eq("orders.payment_status", "paid")
    .gte("orders.created_at", since);

  if (error) {
    throw new Error(`Failed to load popular product: ${error.message}`);
  }

  // Distinct orders per product: a cart holding three lines of the same
  // product is one customer choosing it, not three.
  const ordersByProduct = new Map<string, Set<string>>();
  for (const row of data ?? []) {
    if (!row.product_id || !row.order_id) continue;
    let orders = ordersByProduct.get(row.product_id);
    if (!orders) {
      orders = new Set();
      ordersByProduct.set(row.product_id, orders);
    }
    orders.add(row.order_id);
  }

  const ranked = [...ordersByProduct.entries()]
    .map(([productId, orders]) => ({ productId, count: orders.size }))
    .sort((a, b) => b.count - a.count);

  const [first, second] = ranked;
  if (!first || first.count < MIN_ORDERS) return null;
  if (second && second.count === first.count) return null;

  return first.productId;
});
