import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { StoreSettings } from "@/lib/services/settings/get-settings";

const KEY_MAP: Record<keyof StoreSettings, string> = {
  businessName: "business_name",
  contactEmail: "contact_email",
  maxOrdersPerDay: "max_orders_per_day",
  minAdvanceHours: "min_advance_hours",
  pickupTimeSlots: "pickup_time_slots",
  blackoutDates: "blackout_dates",
};

export async function updateSettings(settings: StoreSettings): Promise<void> {
  const supabase = await createClient();

  const rows = (Object.keys(settings) as (keyof StoreSettings)[]).map((key) => ({
    key: KEY_MAP[key],
    value: settings[key],
  }));

  const { error } = await supabase
    .from("settings")
    .upsert(rows, { onConflict: "key" });

  if (error) {
    throw new Error(`Failed to update settings: ${error.message}`);
  }
}
