import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export interface StoreSettings {
  businessName: string;
  contactEmail: string;
  pickupAddress: string;
  maxOrdersPerDay: number;
  minAdvanceHours: number;
  pickupTimeSlots: string[];
  blackoutDates: string[];
}

const DEFAULTS: StoreSettings = {
  businessName: "Your Neighbour",
  contactEmail: "",
  pickupAddress: "",
  maxOrdersPerDay: 15,
  minAdvanceHours: 24,
  pickupTimeSlots: [],
  blackoutDates: [],
};

// Wrapped in React's cache() so the root layout's call and a page's own
// call within the same request dedupe to a single Supabase round-trip
// instead of two.
export const getSettings = cache(async (): Promise<StoreSettings> => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("settings").select("key, value");

  if (error) {
    throw new Error(`Failed to load store settings: ${error.message}`);
  }

  const value = new Map(data.map((row) => [row.key, row.value]));

  return {
    businessName:
      (value.get("business_name") as string | undefined) ?? DEFAULTS.businessName,
    contactEmail:
      (value.get("contact_email") as string | undefined) ?? DEFAULTS.contactEmail,
    pickupAddress:
      (value.get("pickup_address") as string | undefined) ??
      DEFAULTS.pickupAddress,
    maxOrdersPerDay:
      (value.get("max_orders_per_day") as number | undefined) ??
      DEFAULTS.maxOrdersPerDay,
    minAdvanceHours:
      (value.get("min_advance_hours") as number | undefined) ??
      DEFAULTS.minAdvanceHours,
    pickupTimeSlots:
      (value.get("pickup_time_slots") as string[] | undefined) ??
      DEFAULTS.pickupTimeSlots,
    blackoutDates:
      (value.get("blackout_dates") as string[] | undefined) ??
      DEFAULTS.blackoutDates,
  };
});
