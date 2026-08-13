import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/serviceRole";
import { getSettings } from "@/lib/services/settings/get-settings";
import { getOrderById } from "@/lib/services/orders/get-order";
import type { OrderResult } from "@/lib/services/orders/create-order";
import type { StoreSettings } from "@/lib/services/settings/get-settings";

/**
 * Hard ceiling on how long a send may hold the webhook response open.
 * Stripe gives a delivery roughly 20 seconds before it times out and
 * redelivers, and a timed-out delivery is precisely how a notification used
 * to get lost — so we'd rather give up early, release the lease, and let
 * Stripe's retry drive a clean second attempt than sit on a hung Resend
 * call until Stripe gives up on us.
 */
const NOTIFY_TIMEOUT_MS = 10_000;

/**
 * Runs `send` exactly once per order, across any number of Stripe
 * redeliveries.
 *
 * An order gets exactly one outcome email — "confirmed" once payment
 * lands, or "payment didn't go through" if it doesn't — and `notified_at`
 * is what makes that true. It's a lease rather than a log: claiming it
 * (NULL -> now()) is what grants the right to send, two concurrent
 * deliveries race on that single conditional UPDATE so only one can win,
 * and a failed send hands it back before rethrowing so the webhook's 500
 * turns into a real retry rather than a dead end.
 *
 * See 007_order_notification_lease.sql for the bug this exists to prevent.
 */
export async function notifyOnce(
  orderId: string,
  send: (order: OrderResult, settings: StoreSettings) => Promise<void>,
): Promise<void> {
  if (!(await claimLease(orderId))) return;

  try {
    const [order, settings] = await Promise.all([
      getOrderById(orderId),
      getSettings(),
    ]);
    if (!order) {
      throw new Error(`Order ${orderId} vanished before it could be notified.`);
    }

    await withTimeout(send(order, settings), NOTIFY_TIMEOUT_MS);
  } catch (error) {
    await releaseLease(orderId);
    throw error;
  }
}

/** True if this caller now owns the send, false if someone else already did it. */
async function claimLease(orderId: string): Promise<boolean> {
  const supabase = createServiceRoleClient();

  const { data: claimed, error } = await supabase
    .from("orders")
    .update({ notified_at: new Date().toISOString() })
    .eq("id", orderId)
    .is("notified_at", null)
    .select("id")
    .maybeSingle();

  if (error) {
    throw new Error(
      `Failed to claim notification for order ${orderId}: ${error.message}`,
    );
  }

  return Boolean(claimed);
}

/**
 * Best-effort, and intentionally so: this runs on a path that is already
 * failing, and its caller is about to rethrow. Masking that original error
 * with a second one from the release would lose the reason the send failed
 * in the first place. If the release itself fails the order simply stays
 * claimed-but-unsent, which the `notified_at IS NULL` index makes
 * queryable — better than a confusing error trail.
 */
async function releaseLease(orderId: string): Promise<void> {
  try {
    const supabase = createServiceRoleClient();
    const { error } = await supabase
      .from("orders")
      .update({ notified_at: null })
      .eq("id", orderId);
    if (error) throw error;
  } catch (error) {
    console.error(
      `Failed to release notification lease for order ${orderId}:`,
      error,
    );
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`Order notification timed out after ${ms}ms`)),
        ms,
      );
    }),
    // Clearing matters in a serverless function: an uncleared timer keeps
    // the event loop alive after the response has already been sent.
  ]).finally(() => clearTimeout(timer)) as Promise<T>;
}
