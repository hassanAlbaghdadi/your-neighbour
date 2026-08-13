-- ======================================================================
-- MIGRATION 007: ORDER NOTIFICATION LEASE
-- Run this ONCE in the Supabase SQL Editor (or via `supabase db push`)
-- against the live project before deploying the app code that calls it.
--
-- Fixes a silent data-loss path in markOrderPaid (mark-order-paid.ts).
-- That function flipped payment_status unpaid -> paid and then awaited the
-- confirmation emails, using the conditional flip as its only dedup guard.
-- So when Resend failed, the whole webhook threw a 500, Stripe redelivered
-- the event, and the redelivery's `.eq("payment_status", "unpaid")` matched
-- zero rows — the handler returned early and the emails were never sent
-- again. The customer had paid, the row read "paid", and the baker was
-- never told the order existed.
--
-- The root cause was one column doing two jobs: payment_status was both
-- the payment flag and the "notifications already sent" marker. It is a
-- correct dedup guard and an incorrect completion marker, because the
-- notification can fail long after the payment is durably recorded.
--
-- `notified_at` splits the second job out. It is a lease, not a log:
-- claiming it (NULL -> now()) is what grants the right to send, and a
-- failed send releases it back to NULL so Stripe's next delivery attempt
-- can pick the work up cleanly.
-- ======================================================================

BEGIN;

ALTER TABLE orders
  ADD COLUMN notified_at TIMESTAMPTZ;

-- Orders that were already paid before this migration ran have, by
-- definition, already been through the old notify path. Backfill them as
-- notified so a late webhook redelivery for a historical order can't
-- resurrect a duplicate receipt weeks after the fact. New unpaid orders
-- stay NULL and go through the lease normally.
UPDATE orders
SET notified_at = updated_at
WHERE payment_status = 'paid';

-- Partial index: the only query that touches this column looks for the
-- unclaimed set (`notified_at IS NULL`), which stays small — every
-- successfully notified order drops out of the index for good.
CREATE INDEX idx_orders_awaiting_notification
  ON orders(payment_status)
  WHERE notified_at IS NULL;

COMMIT;
