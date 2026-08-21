import { describe, it, expect } from "vitest"
import { pickupInstant, businessToday } from "./time"

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
