import { addDays, isBefore, startOfDay, format } from "date-fns";
import { pickupInstant } from "@/lib/time";
import type { StoreSettings } from "@/lib/services/settings/get-settings";

/**
 * Why a given day is or isn't offered.
 *
 * The calendar used to answer this with one boolean, so three different
 * rules all painted the same grey. "Fully booked" is the one that matters
 * most to distinguish — it is the only one where trying the next day is
 * guaranteed to help, and the only one a customer is likely to read as a
 * bug rather than a policy.
 */
export type DateStatus = "available" | "past" | "too-soon" | "closed" | "full";

/** How far ahead the checkout page loads order counts for. */
export const AVAILABILITY_WINDOW_DAYS = 60;

interface AvailabilityInput {
  settings: StoreSettings;
  orderCounts: Record<string, number>;
  /** Now + minAdvanceHours, captured once so it can't move mid-checkout. */
  minAllowed: Date;
}

export function createDateStatusResolver({
  settings,
  orderCounts,
  minAllowed,
}: AvailabilityInput) {
  return function statusFor(date: Date): DateStatus {
    if (isBefore(date, startOfDay(new Date()))) return "past";

    const dateStr = format(date, "yyyy-MM-dd");
    if (settings.blackoutDates.includes(dateStr)) return "closed";
    if ((orderCounts[dateStr] ?? 0) >= settings.maxOrdersPerDay) return "full";

    // Checked last, so a day that is both fully booked and inside the lead
    // time reports "full" — the more actionable of the two.
    const hasValidSlot = settings.pickupTimeSlots.some(
      (slot) => pickupInstant(dateStr, slot) >= minAllowed,
    );
    return hasValidSlot ? "available" : "too-soon";
  };
}

/**
 * The first date the calendar will actually accept, or null if there isn't
 * one inside the window order counts were loaded for.
 *
 * Deliberately runs the real resolver rather than re-deriving the rules — a
 * hint that disagreed with the picker underneath it would be worse than no
 * hint at all. Past the window the counts are unknown, so null just hides
 * the hint rather than guessing.
 */
export function findEarliestAvailable(
  statusFor: (date: Date) => DateStatus,
  from: Date = new Date(),
): Date | null {
  const start = startOfDay(from);
  for (let offset = 0; offset < AVAILABILITY_WINDOW_DAYS; offset += 1) {
    const candidate = addDays(start, offset);
    if (statusFor(candidate) === "available") return candidate;
  }
  return null;
}
