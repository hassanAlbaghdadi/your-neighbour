-- ======================================================================
-- MIGRATION 001: PRODUCT VARIANTS
-- Run this ONCE in the Supabase SQL Editor against the live project
-- (brzvwghjrfugovyheurq). Safe to inspect before running — it's wrapped in
-- a single transaction, so it either fully applies or fully rolls back.
--
-- What this does:
--   1. Creates product_variants (schema.sql already documents the
--      steady-state shape — this block creates it on the live DB).
--   2. Adds order_items.variant_id / variant_label.
--   3. Consolidates today's 14 flat product rows into 5 products with
--      2-3 variants each (confirmed groupings — see plan). Every existing
--      order_items row referencing a row being retired is repointed to the
--      new product/variant ids FIRST, so this is safe even if orders exist
--      by the time you run this (checked live on 2026-08-11: order_items
--      is currently empty, so the repoint UPDATEs below are no-ops today,
--      but they're the correct pattern to reuse if you ever merge/rename
--      flavors again later with real order history in place).
--   4. Drops products.price (fully replaced by product_variants.price).
-- ======================================================================

BEGIN;

-- ----------------------------------------------------------------------
-- 1. Schema: product_variants table + order_items columns
-- ----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS product_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  price NUMERIC(10, 2) NOT NULL,
  is_available BOOLEAN NOT NULL DEFAULT TRUE,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_product_variants_product_id ON product_variants(product_id);

CREATE TRIGGER update_product_variants_updated_at
  BEFORE UPDATE ON product_variants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Read Product Variants" ON product_variants FOR SELECT USING (true);
CREATE POLICY "Admin Full Product Variants" ON product_variants FOR ALL TO authenticated USING (true);

ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS variant_id UUID REFERENCES product_variants(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS variant_label TEXT;

-- ----------------------------------------------------------------------
-- 2. Consolidate the 5 confirmed flavor/style groups
--    Each block: create variants under one canonical product, repoint any
--    order_items off the rows being retired, then delete those rows.
-- ----------------------------------------------------------------------

-- Group: Classic (canonical slug: classic)
DO $$
DECLARE
  canonical_id UUID;
  v_piece UUID; v_nine UUID; v_twelve UUID;
  old_nine_id UUID; old_twelve_id UUID;
BEGIN
  SELECT id INTO canonical_id FROM products WHERE slug = 'classic';
  SELECT id INTO old_nine_id FROM products WHERE slug = '9-classic';
  SELECT id INTO old_twelve_id FROM products WHERE slug = '12-piece-classic';

  INSERT INTO product_variants (product_id, label, price, is_available, display_order)
    VALUES (canonical_id, 'Piece', 4.00, true, 0) RETURNING id INTO v_piece;
  INSERT INTO product_variants (product_id, label, price, is_available, display_order)
    VALUES (canonical_id, '9"', 25.00, true, 1) RETURNING id INTO v_nine;
  INSERT INTO product_variants (product_id, label, price, is_available, display_order)
    VALUES (canonical_id, '12 Piece', 45.00, true, 2) RETURNING id INTO v_twelve;

  UPDATE order_items SET product_id = canonical_id, variant_id = v_piece, variant_label = 'Piece'
    WHERE product_id = canonical_id AND variant_id IS NULL;
  UPDATE order_items SET product_id = canonical_id, variant_id = v_nine, variant_label = '9"'
    WHERE product_id = old_nine_id;
  UPDATE order_items SET product_id = canonical_id, variant_id = v_twelve, variant_label = '12 Piece'
    WHERE product_id = old_twelve_id;

  DELETE FROM products WHERE id IN (old_nine_id, old_twelve_id);
END $$;

-- Group: Cinnamon Sugar (canonical slug: cinnamon-sugar)
DO $$
DECLARE
  canonical_id UUID;
  v_piece UUID; v_nine UUID; v_twelve UUID;
  old_nine_id UUID; old_twelve_id UUID;
BEGIN
  SELECT id INTO canonical_id FROM products WHERE slug = 'cinnamon-sugar';
  SELECT id INTO old_nine_id FROM products WHERE slug = '9-cinnamon-sugar';
  SELECT id INTO old_twelve_id FROM products WHERE slug = '12-piece-cinnamon-sugar';

  INSERT INTO product_variants (product_id, label, price, is_available, display_order)
    VALUES (canonical_id, 'Piece', 4.50, true, 0) RETURNING id INTO v_piece;
  INSERT INTO product_variants (product_id, label, price, is_available, display_order)
    VALUES (canonical_id, '9"', 35.00, true, 1) RETURNING id INTO v_nine;
  INSERT INTO product_variants (product_id, label, price, is_available, display_order)
    VALUES (canonical_id, '12 Piece', 55.00, true, 2) RETURNING id INTO v_twelve;

  UPDATE order_items SET product_id = canonical_id, variant_id = v_piece, variant_label = 'Piece'
    WHERE product_id = canonical_id AND variant_id IS NULL;
  UPDATE order_items SET product_id = canonical_id, variant_id = v_nine, variant_label = '9"'
    WHERE product_id = old_nine_id;
  UPDATE order_items SET product_id = canonical_id, variant_id = v_twelve, variant_label = '12 Piece'
    WHERE product_id = old_twelve_id;

  DELETE FROM products WHERE id IN (old_nine_id, old_twelve_id);
END $$;

-- Group: Cheesecake (canonical slug: cheese-cake)
DO $$
DECLARE
  canonical_id UUID;
  v_piece UUID; v_nine UUID; v_twelve UUID;
  old_nine_id UUID; old_twelve_id UUID;
BEGIN
  SELECT id INTO canonical_id FROM products WHERE slug = 'cheese-cake';
  SELECT id INTO old_nine_id FROM products WHERE slug = '9-cheesecake';
  SELECT id INTO old_twelve_id FROM products WHERE slug = '12-piece-cheese-cake';

  INSERT INTO product_variants (product_id, label, price, is_available, display_order)
    VALUES (canonical_id, 'Piece', 4.50, true, 0) RETURNING id INTO v_piece;
  INSERT INTO product_variants (product_id, label, price, is_available, display_order)
    VALUES (canonical_id, '9"', 35.00, true, 1) RETURNING id INTO v_nine;
  INSERT INTO product_variants (product_id, label, price, is_available, display_order)
    VALUES (canonical_id, '12 Piece', 55.00, true, 2) RETURNING id INTO v_twelve;

  UPDATE order_items SET product_id = canonical_id, variant_id = v_piece, variant_label = 'Piece'
    WHERE product_id = canonical_id AND variant_id IS NULL;
  UPDATE order_items SET product_id = canonical_id, variant_id = v_nine, variant_label = '9"'
    WHERE product_id = old_nine_id;
  UPDATE order_items SET product_id = canonical_id, variant_id = v_twelve, variant_label = '12 Piece'
    WHERE product_id = old_twelve_id;

  DELETE FROM products WHERE id IN (old_nine_id, old_twelve_id);
END $$;

-- Group: Caramelized Condensed Milk (canonical slug: caramelized-condensed-milk)
-- Standardizes naming: the old "9\" Dulche de Leche" row becomes this
-- product's 9" variant rather than a separately-named product.
DO $$
DECLARE
  canonical_id UUID;
  v_piece UUID; v_nine UUID; v_twelve UUID;
  old_nine_id UUID; old_twelve_id UUID;
BEGIN
  SELECT id INTO canonical_id FROM products WHERE slug = 'caramelized-condensed-milk';
  SELECT id INTO old_nine_id FROM products WHERE slug = '9-dulche-de-leche';
  SELECT id INTO old_twelve_id FROM products WHERE slug = '12-piece-caramelized-condensed-milk';

  INSERT INTO product_variants (product_id, label, price, is_available, display_order)
    VALUES (canonical_id, 'Piece', 4.50, true, 0) RETURNING id INTO v_piece;
  INSERT INTO product_variants (product_id, label, price, is_available, display_order)
    VALUES (canonical_id, '9"', 30.00, true, 1) RETURNING id INTO v_nine;
  INSERT INTO product_variants (product_id, label, price, is_available, display_order)
    VALUES (canonical_id, '12 Piece', 50.00, true, 2) RETURNING id INTO v_twelve;

  UPDATE order_items SET product_id = canonical_id, variant_id = v_piece, variant_label = 'Piece'
    WHERE product_id = canonical_id AND variant_id IS NULL;
  UPDATE order_items SET product_id = canonical_id, variant_id = v_nine, variant_label = '9"'
    WHERE product_id = old_nine_id;
  UPDATE order_items SET product_id = canonical_id, variant_id = v_twelve, variant_label = '12 Piece'
    WHERE product_id = old_twelve_id;

  DELETE FROM products WHERE id IN (old_nine_id, old_twelve_id);
END $$;

-- Group: 4 Tier Cake Bread (canonical slug: 4-tier-bread-cake, renamed)
-- Confirmed: "4 Tier Bread Cake" and "4 Tier Decorated Cake Bread" are the
-- same cake — the latter adds fresh flower decoration. Merging into one
-- product with a Plain / With Fresh Flowers style choice.
DO $$
DECLARE
  canonical_id UUID;
  v_plain UUID; v_flowers UUID;
  old_flowers_id UUID;
BEGIN
  SELECT id INTO canonical_id FROM products WHERE slug = '4-tier-bread-cake';
  SELECT id INTO old_flowers_id FROM products WHERE slug = '4-tier-decorated-cake-bread';

  UPDATE products SET name = '4 Tier Cake Bread' WHERE id = canonical_id;

  INSERT INTO product_variants (product_id, label, price, is_available, display_order)
    VALUES (canonical_id, 'Plain', 120.00, true, 0) RETURNING id INTO v_plain;
  INSERT INTO product_variants (product_id, label, price, is_available, display_order)
    VALUES (canonical_id, 'With Fresh Flowers', 130.00, true, 1) RETURNING id INTO v_flowers;

  UPDATE order_items SET product_id = canonical_id, variant_id = v_plain, variant_label = 'Plain'
    WHERE product_id = canonical_id AND variant_id IS NULL;
  UPDATE order_items SET product_id = canonical_id, variant_id = v_flowers, variant_label = 'With Fresh Flowers'
    WHERE product_id = old_flowers_id;

  DELETE FROM products WHERE id = old_flowers_id;
END $$;

-- ----------------------------------------------------------------------
-- 3. Safety check: fail the whole transaction if any product was missed
--    (every remaining product must have at least one variant before we
--    drop products.price).
-- ----------------------------------------------------------------------
DO $$
DECLARE
  orphan_count INT;
BEGIN
  SELECT COUNT(*) INTO orphan_count
  FROM products p
  WHERE NOT EXISTS (SELECT 1 FROM product_variants v WHERE v.product_id = p.id);

  IF orphan_count > 0 THEN
    RAISE EXCEPTION 'Migration aborted: % product(s) have no variant rows', orphan_count;
  END IF;
END $$;

-- ----------------------------------------------------------------------
-- 4. Drop the now-fully-replaced products.price column
-- ----------------------------------------------------------------------
ALTER TABLE products DROP COLUMN IF EXISTS price;

COMMIT;

-- ----------------------------------------------------------------------
-- Post-migration note: the "Special" category (12-piece box tier) will now
-- be empty — its products were folded into their flavor's single category
-- (Baked Treats) as a variant instead. Repurpose or delete it from
-- admin > Settings > Categories if you don't plan to use it elsewhere.
-- ----------------------------------------------------------------------
