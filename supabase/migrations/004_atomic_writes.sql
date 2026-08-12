-- ======================================================================
-- MIGRATION 004: ATOMIC ORDER + PRODUCT WRITES
-- Run this ONCE in the Supabase SQL Editor (or via `supabase db push`)
-- against the live project before deploying the app code that calls it.
--
-- Fixes two audit findings:
--   1. processNewOrder (create-order.ts) inserted `orders` then
--      `order_items` as two separate calls. If the second failed, an
--      order row was left behind with no items, and since the existing
--      idempotency check only looks for the order row (not its items), a
--      retry with the same client-generated id would silently return that
--      item-less order as if it had succeeded.
--   2. updateProduct (manage-products.ts) ran 4-5 separate statements
--      (update product, delete removed variants, update kept variants one
--      at a time, insert new variants) with no rollback — a failure
--      partway through left the product and its variants inconsistent.
--
-- Both functions run as SECURITY INVOKER (the default — omitted below),
-- so they execute with the calling role's own privileges and are still
-- subject to the existing RLS policies on `orders`/`order_items`/
-- `products`/`product_variants` (unchanged by this migration). A single
-- PL/pgSQL function body is one implicit transaction: any unhandled
-- exception (including the 23505/23503 constraint violations the app
-- already catches by error code) rolls back everything the function did.
-- ======================================================================

BEGIN;

-- ----------------------------------------------------------------------
-- create_order_atomic: insert an order and its line items together.
-- Called by processNewOrder() via the service-role client.
-- ----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION create_order_atomic(
  p_order_row JSONB,
  p_items JSONB
)
RETURNS orders
LANGUAGE plpgsql
AS $$
DECLARE
  new_order orders;
BEGIN
  INSERT INTO orders (
    id, customer_name, customer_email, customer_phone,
    pickup_date, pickup_time, notes, subtotal, total
  )
  SELECT
    (p_order_row->>'id')::UUID,
    p_order_row->>'customer_name',
    p_order_row->>'customer_email',
    p_order_row->>'customer_phone',
    (p_order_row->>'pickup_date')::DATE,
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

-- ----------------------------------------------------------------------
-- update_product_atomic: update a product and reconcile its variants
-- (delete removed, update kept, insert new) together.
-- Called by updateProduct() via the regular (RLS-enforced) client.
-- ----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_product_atomic(
  p_product_id UUID,
  p_product_row JSONB,
  p_variants_to_update JSONB,
  p_variants_to_insert JSONB,
  p_variant_ids_to_delete UUID[]
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE products SET
    name = p_product_row->>'name',
    slug = p_product_row->>'slug',
    category_id = (p_product_row->>'category_id')::UUID,
    image_url = p_product_row->>'image_url',
    description = p_product_row->>'description',
    is_available = (p_product_row->>'is_available')::BOOLEAN,
    preparation_notice = p_product_row->>'preparation_notice',
    allergens = p_product_row->>'allergens',
    display_order = (p_product_row->>'display_order')::INT
  WHERE id = p_product_id;

  IF COALESCE(array_length(p_variant_ids_to_delete, 1), 0) > 0 THEN
    DELETE FROM product_variants WHERE id = ANY(p_variant_ids_to_delete);
  END IF;

  UPDATE product_variants AS pv SET
    label = v.label,
    price = v.price,
    image_url = v.image_url,
    is_available = v.is_available,
    display_order = v.display_order
  FROM (
    SELECT
      (item->>'id')::UUID AS id,
      item->>'label' AS label,
      (item->>'price')::NUMERIC AS price,
      item->>'image_url' AS image_url,
      (item->>'is_available')::BOOLEAN AS is_available,
      (item->>'display_order')::INT AS display_order
    FROM jsonb_array_elements(p_variants_to_update) AS item
  ) AS v
  WHERE pv.id = v.id;

  INSERT INTO product_variants (product_id, label, price, image_url, is_available, display_order)
  SELECT
    p_product_id,
    item->>'label',
    (item->>'price')::NUMERIC,
    item->>'image_url',
    (item->>'is_available')::BOOLEAN,
    (item->>'display_order')::INT
  FROM jsonb_array_elements(p_variants_to_insert) AS item;
END;
$$;

COMMIT;
