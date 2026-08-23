import { describe, it, expect } from "vitest"
import {
  pickupInstant,
  businessToday,
  formatPickupDate,
  formatPickupTime,
} from "./time"

describe("pickupInstant", () => {
  it("reads the wall clock as Atlantic, not as the host's zone", () => {
    // ADT (UTC-3) in August: 10:00 in Halifax is 13:00Z.
    expect(pickupInstant("2026-08-22", "10:00").toISOString()).toBe(
      "2026-08-22T13:00:00.000Z",
    )
    // AST (UTC-4) in January: the same wall clock is 14:00Z.
    expect(pickupInstant("2026-01-22", "10:00").toISOString()).toBe(
      "2026-01-22T14:00:00.000Z",
    )
  })

  it("resolves slots on either side of a DST changeover", () => {
    // Halifax springs forward 2026-03-08 at 02:00 AST -> 03:00 ADT.
    expect(pickupInstant("2026-03-08", "01:00").toISOString()).toBe(
      "2026-03-08T05:00:00.000Z",
    )
    expect(pickupInstant("2026-03-08", "10:00").toISOString()).toBe(
      "2026-03-08T13:00:00.000Z",
    )
  })

  it("returns an invalid date for malformed input rather than throwing", () => {
    expect(Number.isNaN(pickupInstant("not-a-date", "10:00").getTime())).toBe(true)
    expect(Number.isNaN(pickupInstant("2026-08-22", "").getTime())).toBe(true)
  })
})

describe("businessToday", () => {
  it("uses the business day, not the host's", () => {
    // 23:30 Halifax on the 21st is already 02:30Z on the 22nd.
    expect(businessToday(new Date("2026-08-22T02:30:00Z"))).toBe("2026-08-21")
    expect(businessToday(new Date("2026-08-22T12:00:00Z"))).toBe("2026-08-22")
  })
})

describe("formatPickupDate", () => {
  it("renders the calendar day the customer actually picked", () => {
    expect(formatPickupDate("2026-08-26")).toBe("Wednesday, August 26, 2026")
  })

  it("does not shift the day backwards in a negative-offset zone", () => {
    // The bug this formatter exists to prevent. `new Date("2026-08-26")`
    // parses as UTC midnight, which is 21:00 on the 25th in Halifax, so a
    // naive format tells the customer to collect their order a day early.
    expect(formatPickupDate("2026-08-26")).toContain("26")
    expect(formatPickupDate("2026-08-26")).not.toContain("25")
  })

  it("handles the first of a month, where an off-by-one also changes the month", () => {
    expect(formatPickupDate("2026-09-01")).toBe("Tuesday, September 1, 2026")
  })

  it("passes malformed input through rather than rendering a wrong date", () => {
    expect(formatPickupDate("not-a-date")).toBe("not-a-date")
  })
})

describe("formatPickupTime", () => {
  it("renders a settings slot in 12-hour form", () => {
    expect(formatPickupTime("09:00")).toBe("9:00 AM")
    expect(formatPickupTime("09:30")).toBe("9:30 AM")
  })

  it("accepts the seconds-bearing form Postgres returns for a time column", () => {
    // orders.pickup_time comes back as "09:00:00"; settings slots do not.
    expect(formatPickupTime("09:00:00")).toBe("9:00 AM")
  })

  it("disambiguates noon, which 24-hour 12:00 left ambiguous", () => {
    expect(formatPickupTime("12:00")).toBe("12:00 PM")
  })

  it("passes malformed input through", () => {
    expect(formatPickupTime("nope")).toBe("nope")
  })
})
