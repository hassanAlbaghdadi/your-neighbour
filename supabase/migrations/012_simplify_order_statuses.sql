-- ======================================================================
-- MIGRATION 012: SIMPLIFY ORDER STATUSES (6 -> 4)
-- Run this ONCE in the Supabase SQL Editor (or via `supabase db push`)
-- against the live project BEFORE deploying the app code that uses it —
-- src/types/database.ts starts offering only the new vocabulary in the
-- admin status dropdown and filter tabs.
--
-- `status` is the baker's fulfilment tracker on /admin; the customer never
-- sees it. Only two of the old six values were ever set by the app:
-- 'Pending' (the column default) and 'Cancelled' (set automatically on an
-- abandoned/unpaid checkout). 'Confirmed' and 'Preparing' were reachable
-- only by a manual dropdown pick and carried no signal — payment success
-- already means paid, and a home baker bakes the day's batch at once.
--
--   Pending / Confirmed / Preparing  ->  New       (placed, not yet actioned)
--   Ready                            ->  Ready      (unchanged — packed / ready for pickup)
--   Completed                        ->  Fulfilled  (handed over; method-neutral for future delivery)
--   Cancelled                        ->  Cancelled  (unchanged — set automatically)
--
-- No "in progress" state survives, so any un-fulfilled order maps to 'New'.
-- 'Ready' and 'Cancelled' rows keep their names untouched.
--
-- Everything runs in one transaction: if any step fails, the whole thing
-- rolls back and the old constraint is left exactly as it was.
--
-- create_order_atomic (latest body in 011_service_fee.sql) needs no change:
-- its `status <> 'Cancelled'` guard is unaffected and its INSERT does not
-- list `status`, so new rows fall through to the column DEFAULT set below.
-- ======================================================================

BEGIN;

-- 1. Drop the existing status CHECK FIRST. The new vocabulary ('New',
--    'Fulfilled') is not valid under the old constraint, so the remap in
--    step 2 cannot run until it's gone. Found by definition rather than by
--    name so this stays correct however it was created, and so it matches
--    the status CHECK specifically -- not the separate payment_status one.
DO $$
DECLARE
  con_name TEXT;
BEGIN
  SELECT conname INTO con_name
  FROM pg_constraint
  WHERE conrelid = 'orders'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%(status %';
  IF con_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE orders DROP CONSTRAINT %I', con_name);
  END IF;
END $$;

-- 2. Remap existing rows. The old CHECK guaranteed status was one of the
--    six, so these two UPDATEs plus the pass-through of 'Ready' and
--    'Cancelled' cover every existing row.
UPDATE orders SET status = 'New'       WHERE status IN ('Pending', 'Confirmed', 'Preparing');
UPDATE orders SET status = 'Fulfilled' WHERE status = 'Completed';

-- 3. Add the new constraint (Postgres validates every existing row here)
--    and set the default for future inserts.
ALTER TABLE orders ADD CONSTRAINT orders_status_check
  CHECK (status IN ('New', 'Ready', 'Fulfilled', 'Cancelled'));
ALTER TABLE orders ALTER COLUMN status SET DEFAULT 'New';

-- 4. Belt and braces: abort (rolling back everything above) if any row
--    somehow still holds an unmapped status.
DO $$
DECLARE
  bad_count INT;
BEGIN
  SELECT COUNT(*) INTO bad_count
  FROM orders
  WHERE status NOT IN ('New', 'Ready', 'Fulfilled', 'Cancelled');
  IF bad_count > 0 THEN
    RAISE EXCEPTION 'Migration 012: % order row(s) still hold an unmapped status', bad_count;
  END IF;
END $$;

COMMIT;
