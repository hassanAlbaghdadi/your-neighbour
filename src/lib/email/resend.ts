import "server-only";

/**
 * Stub — wired up in Phase 4 (Resend integration). Kept as a separate
 * module now so create-order.ts already calls the real call site and
 * doesn't need to change when email sending is implemented.
 */
export async function sendOrderNotifications(orderId: string): Promise<void> {
  console.log(`[email] TODO: send order notifications for order ${orderId}`);
}
