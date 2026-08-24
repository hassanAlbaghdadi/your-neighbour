/**
 * How long a pending order holds its pickup-capacity slot before the Stripe
 * session expires and the webhook frees it again (see cancel-expired-order).
 *
 * Kept short — same-week pickup orders don't need a 24h-default hold on a
 * slot someone else might want — and 30 minutes is as short as it goes:
 * Stripe rejects an `expires_at` less than 30 minutes or more than 24 hours
 * from creation.
 *
 * Lives here, outside the server-only module that uses it, so checkout can
 * tell the customer the same number rather than a hardcoded guess that
 * drifts the first time this changes.
 */
export const SESSION_HOLD_MINUTES = 30;
export const SESSION_HOLD_SECONDS = SESSION_HOLD_MINUTES * 60;
