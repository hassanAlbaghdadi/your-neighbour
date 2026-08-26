import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { format } from "date-fns";
import {
  createDateStatusResolver,
  findEarliestAvailable,
} from "./pickup-availability";
import type { StoreSettings } from "@/lib/services/settings/get-settings";

const BASE: StoreSettings = {
  businessName: "Your Neighbour",
  contactEmail: "hello@example.com",
  pickupAddress: "12 Example St",
  maxOrdersPerDay: 2,
  minAdvanceHours: 48,
  pickupTimeSlots: ["09:00", "12:00"],
  blackoutDates: [],
};

// Fixed so the assertions don't drift with the wall clock. Well clear of a
// DST boundary in America/Halifax, which pickupInstant resolves against.
const NOW = new Date("2026-08-23T12:00:00-03:00");
const minAllowed = new Date(NOW.getTime() + 48 * 60 * 60 * 1000);

// Pinning `minAllowed` above was only ever half the job, and the missing
// half was a time bomb rather than a flake: createDateStatusResolver reads
// `new Date()` itself for its `past` check, before the lead-time and
// capacity branches it is being tested on. So every date literal here
// quietly depended on the suite being run before 2026-08-24 — and once
// that day passed, two tests started getting a correct "past" back for a
// day they meant to be merely too-soon.
//
// Freezing the clock to the same NOW those literals were written against
// is what makes them mean again what they say. Editing them to new future
// dates would only re-arm it.
//
// `toFake: ["Date"]` and not the whole timer suite, matching
// create-order.test.ts: this file is synchronous today, but faking timers
// wholesale stalls awaited promises, so the narrow form is the one that
// stays safe if an async case is added here later.
beforeAll(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});

afterAll(() => {
  vi.useRealTimers();
});

function resolver(overrides: Partial<StoreSettings> = {}, counts = {}) {
  return createDateStatusResolver({
    settings: { ...BASE, ...overrides },
    orderCounts: counts,
    minAllowed,
  });
}

function day(iso: string) {
  // Noon local, so the date never slides across a day boundary.
  return new Date(`${iso}T12:00:00`);
}

describe("createDateStatusResolver", () => {
  it("reports a day inside the lead time as too-soon, not merely unavailable", () => {
    // Three rules produced identical grey before this, so a customer whose
    // day was greyed out had no way to tell policy from a bug.
    expect(resolver()(day("2026-08-24"))).toBe("too-soon");
  });

  it("reports an open day past the lead time as available", () => {
    expect(resolver()(day("2026-08-26"))).toBe("available");
  });

  it("reports a blackout date as closed", () => {
    expect(resolver({ blackoutDates: ["2026-08-26"] })(day("2026-08-26"))).toBe(
      "closed",
    );
  });

  it("reports a day at capacity as full", () => {
    expect(resolver({}, { "2026-08-26": 2 })(day("2026-08-26"))).toBe("full");
  });

  it("prefers 'full' over 'too-soon' when a day is both", () => {
    // "Fully booked" is the more actionable of the two: it is the one where
    // trying a different day is guaranteed to help.
    expect(resolver({}, { "2026-08-24": 5 })(day("2026-08-24"))).toBe("full");
  });

  it("treats a store with no configured slots as having nothing to offer", () => {
    expect(resolver({ pickupTimeSlots: [] })(day("2026-09-15"))).toBe(
      "too-soon",
    );
  });
});

describe("findEarliestAvailable", () => {
  it("skips over blacked-out and fully booked days", () => {
    // 48h from noon on the 23rd lands exactly on the 12:00 slot on the
    // 25th, so that is the first day on offer; the next two are removed by
    // the other two rules.
    const statusFor = resolver(
      { blackoutDates: ["2026-08-25", "2026-08-26"] },
      { "2026-08-27": 2 },
    );

    const earliest = findEarliestAvailable(statusFor, NOW);

    expect(earliest).not.toBeNull();
    // Formatted locally, the way the resolver reads a date — toISOString
    // would compare a UTC calendar day against a local one.
    expect(format(earliest!, "yyyy-MM-dd")).toBe("2026-08-28");
  });

  it("agrees with the resolver the calendar itself uses", () => {
    // The hint's whole job is to name a day the picker will accept. A hint
    // that disagreed with the picker underneath it would be worse than none.
    const statusFor = resolver();
    const earliest = findEarliestAvailable(statusFor, NOW);

    expect(statusFor(earliest!)).toBe("available");
  });

  it("returns null rather than guessing past the window counts were loaded for", () => {
    // Beyond 60 days the order counts are unknown, so there is no honest
    // answer to give.
    const statusFor = resolver({ maxOrdersPerDay: 0 });

    expect(findEarliestAvailable(statusFor, NOW)).toBeNull();
  });
});
