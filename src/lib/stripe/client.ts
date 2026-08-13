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
    client = new Stripe(process.env.STRIPE_SECRET_KEY!);
  }
  return client;
}
