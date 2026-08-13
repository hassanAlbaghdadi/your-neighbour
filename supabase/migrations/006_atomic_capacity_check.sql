-- ======================================================================
-- MIGRATION 006: ATOMIC CAPACITY CHECK
-- Run this ONCE in the Supabase SQL Editor (or via `supabase db push`)
-- against the live project before deploying the app code that calls it.
--
-- Closes a check-then-act race in the old flow: processNewOrder counted
-- same-day orders in one query, then inserted in a second, separate call.
-- Two requests landing in the same instant for a nearly-full day could
-- both read "under the limit" and both insert, overselling that day's
-- capacity. create_order_atomic now takes the day's limit as a parameter
-- and re-checks it itself, inside the same transaction as the insert,
-- after taking a per-pickup-date advisory lock — that lock serializes
-- concurrent calls for the *same* date (calls for different dates never
-- block each other) so the count-then-insert can no longer race.
--
-- The app still does its own pre-check for a fast, friendly failure
-- before doing any variant/price lookups — this function is the
-- authoritative, race-proof one underneath it.
-- ======================================================================

BEGIN;

CREATE OR REPLACE FUNCTION create_order_atomic(
  p_order_row JSONB,
  p_items JSONB,
  p_max_orders_per_day INT
)
RETURNS orders
LANGUAGE plpgsql
AS $$
DECLARE
  new_order orders;
  pickup_date_val DATE;
  current_count INT;
BEGIN
  pickup_date_val := (p_order_row->>'pickup_date')::DATE;

  -- Held for the rest of this transaction only (xact-scoped), and only
  -- contends with other calls for this exact pickup_date.
  PERFORM pg_advisory_xact_lock(hashtext(pickup_date_val::text));

  SELECT COUNT(*) INTO current_count
  FROM orders
  WHERE pickup_date = pickup_date_val
    AND status <> 'Cancelled';

  IF current_count >= p_max_orders_per_day THEN
    RAISE EXCEPTION 'CAPACITY_FULL';
  END IF;

  INSERT INTO orders (
    id, customer_name, customer_email, customer_phone,
    pickup_date, pickup_time, notes, subtotal, total
  )
  SELECT
    (p_order_row->>'id')::UUID,
    p_order_row->>'customer_name',
    p_order_row->>'customer_email',
    p_order_row->>'customer_phone',
    pickup_date_val,
    (p_order_row->>'pickup_time')::TIME,
    p_order_row->>'notes',
    (p_order_row->>'subtotal')::NUMERIC,
    (p_order_row->>'total')::NUMERIC
  RETURNING * INTO new_order;

  INSERT INTO order_items (
    order_id, product_id, product_name, variant_id, variant_label, quantity, unit_price
  )
  SELECT
    new_order.id,
    (item->>'product_id')::UUID,
    item->>'product_name',
    (item->>'variant_id')::UUID,
    item->>'variant_label',
    (item->>'quantity')::INT,
    (item->>'unit_price')::NUMERIC
  FROM jsonb_array_elements(p_items) AS item;

  RETURN new_order;
END;
$$;

COMMIT;
