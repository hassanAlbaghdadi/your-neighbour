import "server-only";
import Stripe from "stripe";

let client: Stripe | null = null;

// Lazily constructed, not a module-level singleton: Stripe's constructor
// throws immediately on a missing/empty key, and this module is imported
// by the webhook route — Next evaluates route modules to collect their
// config during `next build`, which would fail the build whenever
// STRIPE_SECRET_KEY isn't set yet, not just at request time.
export function getStripeClient(): Stripe {
  if (!client) {
    client = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      // Pinned rather than left to the SDK's built-in default, which moves
      // with every major SDK bump and would otherwise change request and
      // webhook payload shapes as a side effect of an unrelated `npm
      // update`. This is the default that ships with stripe@22.5.0, so
      // it's a no-op today and a guardrail later.
      apiVersion: "2026-07-29.dahlia",
      // The SDK retries nothing by default, so a single transient network
      // blip surfaced to the customer as a failed checkout. Retries are
      // only safe alongside the idempotency key that
      // create-checkout-session.ts passes — without one, a retried
      // create call can leave a second live session behind.
      maxNetworkRetries: 2,
    });
  }
  return client;
}
