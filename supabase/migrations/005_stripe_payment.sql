-- ======================================================================
-- MIGRATION 005: STRIPE ONLINE PAYMENT
-- Run this ONCE in the Supabase SQL Editor (or via `supabase db push`)
-- against the live project before deploying the app code that calls it.
--
-- Orders already reserve a pickup-capacity slot the moment they're
-- created (see create_order_atomic in 004_atomic_writes.sql) — that's
-- deliberate, it's what lets an online pre-order hold its place before
-- payment finishes. `payment_status` tracks whether that reservation has
-- actually been paid for yet, separately from `status`, which tracks
-- fulfillment (Pending/Confirmed/Preparing/...). No default is needed on
-- create_order_atomic's INSERT — new rows fall through to `payment_status
-- DEFAULT 'unpaid'` below untouched.
-- ======================================================================

BEGIN;

ALTER TABLE orders
  ADD COLUMN payment_status TEXT NOT NULL DEFAULT 'unpaid'
    CHECK (payment_status IN ('unpaid', 'paid')),
  ADD COLUMN stripe_checkout_session_id TEXT;

CREATE INDEX idx_orders_stripe_checkout_session_id
  ON orders(stripe_checkout_session_id);

COMMIT;
