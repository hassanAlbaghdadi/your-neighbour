/**
 * Pickup dates and times are wall-clock values in the bakery's own timezone.
 * Nothing else in the stack is: a customer can order from any timezone, and
 * the deploy host runs UTC. `new Date("2026-08-22T10:00:00")` has no offset
 * designator, so it resolves against whatever zone the *process* happens to
 * be in — which is why the checkout calendar (browser zone) could offer a
 * slot that create-order (server zone) then rejected for insufficient
 * notice. Anything converting a pickup date + time into an instant, or
 * asking what "today" is, has to go through here.
 *
 * The IANA id rather than a fixed AST offset: Halifax runs ADT (UTC-3) from
 * March to November, so a hardcoded -4 would be an hour off for most of the
 * year. Intl carries the transition table; we don't.
 */
export const BUSINESS_TIME_ZONE = "America/Halifax"

const partsFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: BUSINESS_TIME_ZONE,
  hour12: false,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
})

interface BusinessParts {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

function businessParts(instant: Date): BusinessParts {
  const parts: Record<string, string> = {}
  for (const part of partsFormatter.formatToParts(instant)) {
    if (part.type !== "literal") parts[part.type] = part.value
  }
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    // hour12:false renders midnight as "24" in some ICU versions.
    hour: Number(parts.hour) % 24,
    minute: Number(parts.minute),
    second: Number(parts.second),
  }
}

/** How far the business zone sits from UTC at a given instant, in ms. */
function offsetMsAt(instant: Date): number {
  const p = businessParts(instant)
  const asIfUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
  return asIfUtc - instant.getTime()
}

/**
 * Resolves a `yyyy-MM-dd` + `HH:mm` pair, read as business-local wall clock,
 * to an absolute instant. Returns an invalid Date for malformed input so
 * callers can reject it the same way they would any other bad field.
 *
 * Two passes: the first offset is sampled at the naive instant, which can
 * land on the wrong side of a DST transition for slots within an hour of
 * the changeover; re-sampling at the corrected instant settles it. Times
 * that don't exist (the skipped hour each spring) resolve to the following
 * hour rather than throwing — pickup slots are owner-configured, so this is
 * a well-formedness backstop, not a case worth surfacing.
 */
export function pickupInstant(date: string, time: string): Date {
  const naiveUtc = Date.parse(`${date}T${time}:00Z`)
  if (Number.isNaN(naiveUtc)) return new Date(Number.NaN)
  const firstPass = new Date(naiveUtc - offsetMsAt(new Date(naiveUtc)))
  return new Date(naiveUtc - offsetMsAt(firstPass))
}

/**
 * The current business-local date as `yyyy-MM-dd`. Not interchangeable with
 * `format(new Date(), "yyyy-MM-dd")`, which reads the host's zone — on a UTC
 * server that rolls over to tomorrow at 20:00 (ADT) local, so the admin's
 * "Today" would show the wrong day's pickups all evening.
 */
export function businessToday(now: Date = new Date()): string {
  const p = businessParts(now)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`
}

/**
 * Both formatters below deliberately build a UTC instant and format it back
 * in UTC. A pickup date is a wall-clock calendar day with no instant behind
 * it, so any zone conversion can only ever move it to the wrong day:
 * `new Date("2026-08-26")` parses as UTC midnight, which is 21:00 on the
 * 25th in Halifax, so a naive format renders the day *before* the customer
 * is meant to collect their order. Anchoring at UTC noon and reading it back
 * in UTC keeps the calendar day the customer picked, whatever zone the
 * process is in.
 *
 * en-US rather than en-CA: the two render the date identically, but en-CA
 * formats times as "9:00 a.m." where en-US gives "9:00 AM", which is what
 * the rest of the UI already looks like.
 */
const DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  weekday: "long",
  year: "numeric",
  month: "long",
  day: "numeric",
})

const TIME_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
})

/** `2026-08-26` -> `Wednesday, August 26, 2026`. Input passes through unchanged if malformed. */
export function formatPickupDate(date: string): string {
  const [year, month, day] = date.split("-").map(Number)
  if (!year || !month || !day) return date
  return DATE_FORMATTER.format(new Date(Date.UTC(year, month - 1, day, 12)))
}

/**
 * `09:00` -> `9:00 AM`. Also accepts `09:00:00`, which is what Postgres
 * hands back for a `time` column — the settings slots carry no seconds but
 * orders.pickup_time does, and both reach these callers.
 */
export function formatPickupTime(time: string): string {
  const [hour, minute] = time.split(":").map(Number)
  if (Number.isNaN(hour) || Number.isNaN(minute)) return time
  return TIME_FORMATTER.format(new Date(Date.UTC(2000, 0, 1, hour, minute)))
}
