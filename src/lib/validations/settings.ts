import { z } from "zod";

export const settingsSchema = z.object({
  businessName: z.string().min(1, "Required").max(200),
  contactEmail: z.string().email("Enter a valid email address"),
  // Optional: a shop mid-setup shouldn't be blocked from saving anything
  // else. Every render site treats "" as "hide this block".
  pickupAddress: z.string().max(300).optional().default(""),
  maxOrdersPerDay: z.coerce.number().int().min(1).max(500),
  minAdvanceHours: z.coerce.number().int().min(0).max(168),
  pickupTimeSlots: z
    .array(z.string().regex(/^\d{2}:\d{2}$/, "Use HH:MM format"))
    .min(1, "Add at least one pickup time"),
  blackoutDates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD format")),
});

export type SettingsValues = z.output<typeof settingsSchema>;
export type SettingsFormInput = z.input<typeof settingsSchema>;
