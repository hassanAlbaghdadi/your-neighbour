import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/serviceRole";

/**
 * Aggregate order counts per pickup_date, used to disable "sold out" dates
 * on the public checkout calendar. Uses the service-role client because the
 * `orders` table itself is not publicly readable (RLS) — only this
 * aggregate count is ever exposed to the storefront, never raw order rows.
 */
export async function getOrderCountsByDate(
  startDate: string,
  endDate: string,
): Promise<Record<string, number>> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("orders")
    .select("pickup_date")
    .neq("status", "Cancelled")
    .gte("pickup_date", startDate)
    .lte("pickup_date", endDate);

  if (error) {
    throw new Error(`Failed to load order counts: ${error.message}`);
  }

  const counts: Record<string, number> = {};
  for (const row of data) {
    counts[row.pickup_date] = (counts[row.pickup_date] ?? 0) + 1;
  }
  return counts;
}
