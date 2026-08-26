-- ======================================================================
-- MIGRATION 011: SERVICE FEE
-- Run this ONCE in the Supabase SQL Editor (or via `supabase db push`)
-- against the live project BEFORE deploying the app code that calls it —
-- create-order.ts starts sending `service_fee` inside p_order_row, and the
-- old function body would silently drop it on the floor.
--
-- A flat percentage (see SERVICE_FEE_RATE in src/lib/pricing/order-totals.ts)
-- charged on every order's subtotal. Stored on the order rather than
-- recomputed on read: the rate is a deploy-time constant, so an order
-- placed before a future rate change must keep showing the fee it was
-- actually charged, on its receipt and in the admin list, forever.
--
-- DEFAULT 0 backfills every existing order with a zero fee, which is
-- historically accurate — they were placed before this existed — and keeps
-- `subtotal + service_fee = total` true for them too.
-- ======================================================================

BEGIN;

ALTER TABLE orders
  ADD COLUMN service_fee NUMERIC(10, 2) NOT NULL DEFAULT 0;

-- Same three-argument signature as 006_atomic_capacity_check.sql, so this
-- is a plain CREATE OR REPLACE with no DROP FUNCTION needed — the new
-- field rides inside the existing p_order_row JSONB. The capacity lock and
-- re-check below are unchanged from 006; only the INSERT column list moved.
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
    pickup_date, pickup_time, notes, subtotal, service_fee, total
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
    -- COALESCE so a deploy that briefly runs the old app code against this
    -- new function inserts 0 rather than failing the NOT NULL constraint.
    COALESCE((p_order_row->>'service_fee')::NUMERIC, 0),
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
