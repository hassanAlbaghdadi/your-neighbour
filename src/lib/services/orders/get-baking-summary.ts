import "server-only";
import { createClient } from "@/lib/supabase/server";

export interface BakingSummaryItem {
  productName: string;
  quantity: number;
}

interface OrderWithItemsRow {
  order_items: { product_name: string; quantity: number }[];
}

/** Total quantities to bake for a given pickup date, across non-cancelled orders. */
export async function getBakingSummary(
  pickupDate: string,
): Promise<BakingSummaryItem[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("orders")
    .select("order_items(product_name, quantity)")
    .eq("pickup_date", pickupDate)
    .neq("status", "Cancelled");

  if (error) {
    throw new Error(`Failed to load baking summary: ${error.message}`);
  }

  const totals = new Map<string, number>();
  for (const order of data as unknown as OrderWithItemsRow[]) {
    for (const item of order.order_items) {
      totals.set(
        item.product_name,
        (totals.get(item.product_name) ?? 0) + item.quantity,
      );
    }
  }

  return [...totals.entries()]
    .map(([productName, quantity]) => ({ productName, quantity }))
    .sort((a, b) => b.quantity - a.quantity);
}
