import { describe, it, expect, vi, beforeEach } from "vitest";

const updateMock = vi.fn();
const eqMock = vi.fn();
const fromMock = vi.fn();

vi.mock("@/lib/supabase/serviceRole", () => ({
  createServiceRoleClient: () => ({ from: fromMock }),
}));

const { cancelExpiredOrder } = await import("./cancel-expired-order");

const ORDER_ID = "11111111-1111-4111-8111-111111111111";
const SESSION_ID = "cs_test_abc123";

/** update(...).eq(...).eq(...).eq(...).select(...).maybeSingle() */
function buildChain(result: { data?: unknown; error: unknown }) {
  const chain = {
    eq: eqMock.mockImplementation(() => chain),
    select: () => chain,
    maybeSingle: () => Promise.resolve(result),
  };
  fromMock.mockReturnValue({ update: updateMock.mockReturnValue(chain) });
}

describe("cancelExpiredOrder", () => {
  beforeEach(() => {
    updateMock.mockReset();
    eqMock.mockReset();
    fromMock.mockReset();
  });

  it("cancels an unpaid order to free its pickup-capacity slot", async () => {
    buildChain({ data: { id: ORDER_ID }, error: null });

    const cancelled = await cancelExpiredOrder(ORDER_ID, SESSION_ID);

    expect(cancelled).toBe(true);
    expect(updateMock).toHaveBeenCalledWith({ status: "Cancelled" });
    expect(eqMock).toHaveBeenCalledWith("id", ORDER_ID);
    expect(eqMock).toHaveBeenCalledWith("payment_status", "unpaid");
  });

  it("only cancels when the expired session is the one the order is waiting on", async () => {
    // Otherwise a stale session's `expired` event could cancel an order the
    // customer is still paying for on a newer one — the payment_status
    // guard alone doesn't catch that for delayed payment methods, which
    // stay "unpaid" for days after checkout completes.
    buildChain({ data: { id: ORDER_ID }, error: null });

    await cancelExpiredOrder(ORDER_ID, SESSION_ID);

    expect(eqMock).toHaveBeenCalledWith(
      "stripe_checkout_session_id",
      SESSION_ID,
    );
  });

  it("reports that nothing was cancelled when a guard declined", async () => {
    // The caller uses this to decide whether to email the customer — a
    // no-op cancel must not produce a "your payment failed" email for an
    // order that is alive and well.
    buildChain({ data: null, error: null });

    expect(await cancelExpiredOrder(ORDER_ID, SESSION_ID)).toBe(false);
  });

  it("throws when the update fails", async () => {
    buildChain({ data: null, error: { message: "db down" } });

    await expect(cancelExpiredOrder(ORDER_ID, SESSION_ID)).rejects.toThrow(
      "db down",
    );
  });
});
