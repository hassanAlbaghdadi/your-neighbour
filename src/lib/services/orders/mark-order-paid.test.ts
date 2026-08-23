import { describe, it, expect, vi, beforeEach } from "vitest";

const fromMock = vi.fn();
const getOrderByIdMock = vi.fn();
const getSettingsMock = vi.fn();
const sendOwnerAlertMock = vi.fn();
const sendCustomerReceiptMock = vi.fn();

vi.mock("@/lib/supabase/serviceRole", () => ({
  createServiceRoleClient: () => ({ from: fromMock }),
}));
vi.mock("@/lib/services/orders/get-order", () => ({
  getOrderById: (...args: unknown[]) => getOrderByIdMock(...args),
}));
vi.mock("@/lib/services/settings/get-settings", () => ({
  getSettings: (...args: unknown[]) => getSettingsMock(...args),
}));
vi.mock("@/lib/email/resend", () => ({
  sendOwnerAlert: (...args: unknown[]) => sendOwnerAlertMock(...args),
  sendCustomerReceipt: (...args: unknown[]) => sendCustomerReceiptMock(...args),
}));

const { markOrderPaid } = await import("./mark-order-paid");

const ORDER_ID = "11111111-1111-4111-8111-111111111111";

interface QueryResult {
  data?: unknown;
  error: unknown;
}

interface Builder {
  payload: Record<string, unknown> | null;
  update: (values: Record<string, unknown>) => Builder;
  eq: (...args: unknown[]) => Builder;
  is: (...args: unknown[]) => Builder;
  select: (...args: unknown[]) => Builder;
  maybeSingle: () => Promise<QueryResult>;
  then: (
    resolve: (value: QueryResult) => unknown,
    reject?: (reason: unknown) => unknown,
  ) => Promise<unknown>;
}

/**
 * Supabase's query builder is thenable — `.update().eq()` is awaited
 * directly when there's no `.select()` on the end — so the stub has to be
 * too, not just a chain of mockReturnThis().
 */
function makeBuilder(result: QueryResult): Builder {
  const builder = {
    payload: null,
    update(values: Record<string, unknown>) {
      builder.payload = values;
      return builder;
    },
    eq: () => builder,
    is: () => builder,
    select: () => builder,
    maybeSingle: () => Promise.resolve(result),
    then: (
      resolve: (value: QueryResult) => unknown,
      reject?: (reason: unknown) => unknown,
    ) => Promise.resolve(result).then(resolve, reject),
  } as Builder;
  return builder;
}

/** Queues the builders `markOrderPaid` will pull, in call order. */
function queueBuilders(...results: QueryResult[]): Builder[] {
  const builders = results.map(makeBuilder);
  for (const builder of builders) {
    fromMock.mockReturnValueOnce(builder);
  }
  return builders;
}

const ORDER = { id: ORDER_ID, customerEmail: "jane@example.com" };

describe("markOrderPaid", () => {
  beforeEach(() => {
    fromMock.mockReset();
    getOrderByIdMock.mockReset();
    getSettingsMock.mockReset();
    sendOwnerAlertMock.mockReset();
    sendCustomerReceiptMock.mockReset();
    getOrderByIdMock.mockResolvedValue(ORDER);
    sendOwnerAlertMock.mockResolvedValue(undefined);
    sendCustomerReceiptMock.mockResolvedValue(undefined);
    getSettingsMock.mockResolvedValue({
      businessName: "Your Neighbour",
      contactEmail: "owner@example.com",
      maxOrdersPerDay: 50,
      minAdvanceHours: 0,
      pickupTimeSlots: ["10:00"],
      blackoutDates: [],
    });
  });

  it("flips payment_status to paid and sends the order notification emails", async () => {
    const [flip, claim] = queueBuilders(
      { error: null },
      { data: { id: ORDER_ID }, error: null },
    );

    await markOrderPaid(ORDER_ID);

    expect(flip.payload).toEqual({ payment_status: "paid" });
    expect(claim.payload).toMatchObject({ notified_at: expect.any(String) });
    expect(sendOwnerAlertMock).toHaveBeenCalledWith(ORDER, "owner@example.com");
    expect(sendCustomerReceiptMock).toHaveBeenCalledWith(
      ORDER,
      "Your Neighbour",
      "owner@example.com",
    );
  });

  it("still sends the notification on a redelivery when the first attempt never sent it", async () => {
    // The regression this whole lease exists for. The order is already
    // `paid` (so the flip matches zero rows), but the previous delivery
    // died before the emails went out. Gating the send on the unpaid ->
    // paid transition — as this used to — lost them permanently: the
    // customer had paid and the baker was never told the order existed.
    const [, claim] = queueBuilders(
      { error: null },
      { data: { id: ORDER_ID }, error: null },
    );

    await markOrderPaid(ORDER_ID);

    expect(claim.payload).toMatchObject({ notified_at: expect.any(String) });
    expect(sendOwnerAlertMock).toHaveBeenCalledTimes(1);
    expect(sendCustomerReceiptMock).toHaveBeenCalledTimes(1);
  });

  it("does not send duplicate emails when an earlier delivery already sent them", async () => {
    // notified_at was already set, so the conditional claim matches nothing.
    queueBuilders({ error: null }, { data: null, error: null });

    await markOrderPaid(ORDER_ID);

    expect(getOrderByIdMock).not.toHaveBeenCalled();
    expect(sendOwnerAlertMock).not.toHaveBeenCalled();
    expect(sendCustomerReceiptMock).not.toHaveBeenCalled();
  });

  it("releases the lease and rethrows when the owner alert fails, so Stripe retries", async () => {
    const [, , release] = queueBuilders(
      { error: null },
      { data: { id: ORDER_ID }, error: null },
      { error: null },
    );
    sendOwnerAlertMock.mockRejectedValue(new Error("resend down"));

    await expect(markOrderPaid(ORDER_ID)).rejects.toThrow("resend down");

    // Handed back to NULL — without this the retry's claim would find the
    // lease taken and skip the send forever.
    expect(release.payload).toEqual({ notified_at: null });
  });

  it("still sends the owner alert when the customer receipt fails", async () => {
    // The bug this split exists for. The two sends shared one Promise.all,
    // so a customer receipt that always fails — which is exactly what an
    // unverified sending domain produces — discarded the bake list too.
    queueBuilders({ error: null }, { data: { id: ORDER_ID }, error: null });
    sendCustomerReceiptMock.mockRejectedValue(new Error("domain not verified"));

    await markOrderPaid(ORDER_ID);

    expect(sendOwnerAlertMock).toHaveBeenCalledTimes(1);
  });

  it("keeps the lease when only the customer receipt fails, so the owner isn't re-alerted", async () => {
    // A permanently failing receipt must not put Stripe into a retry loop
    // that mails the baker the same order over and over.
    const builders = queueBuilders(
      { error: null },
      { data: { id: ORDER_ID }, error: null },
      { error: null },
    );
    sendCustomerReceiptMock.mockRejectedValue(new Error("domain not verified"));

    await expect(markOrderPaid(ORDER_ID)).resolves.toBeUndefined();

    // Only the flip and the claim ran; no third call released the lease.
    expect(builders[2].payload).toBeNull();
  });

  it("throws when the payment flip fails", async () => {
    queueBuilders({ error: { message: "db down" } });

    await expect(markOrderPaid(ORDER_ID)).rejects.toThrow("db down");
    expect(sendOwnerAlertMock).not.toHaveBeenCalled();
    expect(sendCustomerReceiptMock).not.toHaveBeenCalled();
  });
});
