import "server-only";
import { createClient } from "@/lib/supabase/server";

export interface BakingSummaryItem {
  productName: string;
  variantLabel: string | null;
  quantity: number;
}

interface OrderWithItemsRow {
  order_items: { product_name: string; variant_label: string | null; quantity: number }[];
}

/**
 * Total quantities to bake for a given pickup date, across non-cancelled
 * orders. Grouped by product + size — a "Piece" and a "12 Piece" box of the
 * same flavor are very different prep tasks, so they're never merged.
 */
export async function getBakingSummary(
  pickupDate: string,
): Promise<BakingSummaryItem[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("orders")
    .select("order_items(product_name, variant_label, quantity)")
    .eq("pickup_date", pickupDate)
    // Paid only: an order is written before Stripe, so an abandoned
    // checkout is a real row for up to 30 minutes. Baking from it means
    // baking something nobody bought.
    .eq("payment_status", "paid")
    .neq("status", "Cancelled");

  if (error) {
    throw new Error(`Failed to load baking summary: ${error.message}`);
  }

  const totals = new Map<string, BakingSummaryItem>();
  for (const order of data as unknown as OrderWithItemsRow[]) {
    for (const item of order.order_items) {
      const key = `${item.product_name}::${item.variant_label ?? ""}`;
      const existing = totals.get(key);
      totals.set(key, {
        productName: item.product_name,
        variantLabel: item.variant_label,
        quantity: (existing?.quantity ?? 0) + item.quantity,
      });
    }
  }

  return [...totals.values()].sort((a, b) => b.quantity - a.quantity);
}
