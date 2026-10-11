-- ======================================================================
-- MIGRATION 013: DELIVERY AS A SECOND FULFILMENT METHOD
-- Run this ONCE in the Supabase SQL Editor (or via `supabase db push`)
-- against the live project BEFORE deploying the app code that uses it —
-- get-orders.ts starts selecting the new columns, and /admin errors on a
-- column that doesn't exist yet. On its own this migration is invisible:
-- the currently deployed code never reads or writes any of it.
--
-- Delivery is an alternative to pickup, not a separate schedule. A delivery
-- order books the same date, the same time slot and the same daily
-- capacity as a pickup; Sarah drops it off around that time. So
-- `pickup_date` / `pickup_time` keep their names and now mean "the handover
-- date and time, whichever method" — renaming them would touch ~200 lines
-- for no behavioural gain.
--
-- No delivery-area check: the customer types an address and Sarah phones
-- them if it's too far, the same way she already handles order changes.
--
-- DEFAULT 'pickup' / DEFAULT 0 backfill every existing order accurately —
-- they were all pickups, with no delivery fee — and keep
-- `subtotal + service_fee + delivery_fee = total` true for them.
-- ======================================================================

BEGIN;

ALTER TABLE orders
  ADD COLUMN fulfillment_method TEXT NOT NULL DEFAULT 'pickup'
    CHECK (fulfillment_method IN ('pickup', 'delivery')),
  ADD COLUMN delivery_fee NUMERIC(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN delivery_address TEXT;

-- Off by default: the code ships dark, and the owner switches it on from
-- /admin/settings once the fee is set.
INSERT INTO settings (key, value, description) VALUES
  ('delivery_enabled', 'false'::jsonb, 'Offer delivery as well as pickup at checkout'),
  ('delivery_fee', '0'::jsonb, 'Flat delivery fee in dollars, added to delivery orders')
ON CONFLICT (key) DO NOTHING;

-- Same three-argument signature as 011_service_fee.sql, so a plain CREATE
-- OR REPLACE — the new fields ride inside the existing p_order_row JSONB.
-- The capacity lock and re-check are unchanged: a delivery takes a day's
-- slot exactly as a pickup does, because the baking is the constraint.
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
    pickup_date, pickup_time, notes, subtotal, service_fee, total,
    fulfillment_method, delivery_fee, delivery_address
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
    COALESCE((p_order_row->>'service_fee')::NUMERIC, 0),
    (p_order_row->>'total')::NUMERIC,
    -- COALESCE so app code that predates this migration still inserts a
    -- valid pickup order rather than failing the NOT NULL constraints.
    COALESCE(p_order_row->>'fulfillment_method', 'pickup'),
    COALESCE((p_order_row->>'delivery_fee')::NUMERIC, 0),
    p_order_row->>'delivery_address'
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
