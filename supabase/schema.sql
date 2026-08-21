-- ======================================================================
-- YOUR NEIGHBOUR — INITIAL SCHEMA
-- Run this once in the Supabase SQL Editor (or via `supabase db push`)
-- Source of truth: PRD.md section 3
-- ======================================================================

-- 1. CATEGORIES TABLE
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  display_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. PRODUCTS TABLE
-- `is_available` is a master switch for the whole flavor: turning it off hides
-- every variant regardless of each variant's own is_available flag.
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  image_url TEXT,
  is_available BOOLEAN DEFAULT TRUE,
  preparation_notice TEXT,
  allergens TEXT,
  display_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2b. PRODUCT VARIANTS TABLE (one product -> many purchasable sizes/styles)
-- `image_url` is an OPTIONAL override — the storefront falls back to the
-- parent product's photo when a variant has none set. Only worth setting
-- for variants that actually look different (e.g. a cake with vs without
-- decoration), not for pure size variants of the same item.
CREATE TABLE product_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  price NUMERIC(10, 2) NOT NULL,
  image_url TEXT,
  is_available BOOLEAN NOT NULL DEFAULT TRUE,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. ORDERS TABLE (Primary Key 'id' accepts client-generated UUID for idempotency)
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  pickup_date DATE NOT NULL,
  pickup_time TIME NOT NULL,
  notes TEXT,
  subtotal NUMERIC(10, 2) NOT NULL,
  total NUMERIC(10, 2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Confirmed', 'Preparing', 'Ready', 'Completed', 'Cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. ORDER ITEMS TABLE
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE RESTRICT,
  product_name TEXT NOT NULL,
  variant_id UUID REFERENCES product_variants(id) ON DELETE RESTRICT,
  variant_label TEXT,
  quantity INT NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(10, 2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. SETTINGS TABLE
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. HOMEPAGE PHOTOS TABLE
-- Optional admin-curated photos for the homepage hero/gallery sections.
-- When no row exists for a section, the homepage falls back to
-- auto-selecting from product photos — same additive/safe pattern as the
-- per-variant image override.
CREATE TABLE homepage_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section TEXT NOT NULL CHECK (section IN (
    'hero', 'gallery',
    'story_hero', 'story_beat_1', 'story_beat_2', 'story_beat_3'
  )),
  image_url TEXT NOT NULL,
  alt_text TEXT,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- INDEXES FOR QUERY OPTIMIZATION
CREATE INDEX idx_products_available ON products(is_available);
CREATE INDEX idx_product_variants_product_id ON product_variants(product_id);
CREATE INDEX idx_orders_pickup ON orders(pickup_date, pickup_time);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_homepage_photos_section ON homepage_photos(section, display_order);


-- ======================================================================
-- AUTOMATIC UPDATED_AT TRIGGER FUNCTION
-- ======================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON categories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_product_variants_updated_at BEFORE UPDATE ON product_variants FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_order_items_updated_at BEFORE UPDATE ON order_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_settings_updated_at BEFORE UPDATE ON settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_homepage_photos_updated_at BEFORE UPDATE ON homepage_photos FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ======================================================================
-- SEED DEFAULT STORE SETTINGS (EXPLICIT JSONB CASTING)
-- ======================================================================
INSERT INTO settings (key, value, description) VALUES
  ('business_name', '"Your Neighbour"'::jsonb, 'Official store display name'),
  ('contact_email', '"sarah@yourneighbourbakery.com"'::jsonb, 'Alert recipient for new orders'),
  ('max_orders_per_day', '15'::jsonb, 'Total allowed orders across an entire date'),
  ('min_advance_hours', '24'::jsonb, 'Minimum notice required before pickup'),
  ('pickup_time_slots', '["09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00"]'::jsonb, 'Available pickup time windows'),
  ('blackout_dates', '["2026-12-25", "2026-12-26"]'::jsonb, 'Dates closed for orders')
ON CONFLICT (key) DO NOTHING;


-- ======================================================================
-- BASE TABLE GRANTS
-- RLS policies control row visibility, but PostgREST also requires the
-- role to hold the underlying GRANT before RLS is ever evaluated.
-- ======================================================================
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;


-- ======================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ======================================================================
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE homepage_photos ENABLE ROW LEVEL SECURITY;

-- Public Read Only (Catalog and Store Settings)
CREATE POLICY "Public Read Categories" ON categories FOR SELECT USING (true);
CREATE POLICY "Public Read Products" ON products FOR SELECT USING (true);
CREATE POLICY "Public Read Product Variants" ON product_variants FOR SELECT USING (true);
CREATE POLICY "Public Read Settings" ON settings FOR SELECT USING (true);
CREATE POLICY "Public Read Homepage Photos" ON homepage_photos FOR SELECT USING (true);

-- Direct Public Writes Disallowed (Orders inserted strictly via Server Actions / Service Role)

-- Authenticated Owner Full Access
CREATE POLICY "Admin Full Categories" ON categories FOR ALL TO authenticated USING (true);
CREATE POLICY "Admin Full Products" ON products FOR ALL TO authenticated USING (true);
CREATE POLICY "Admin Full Product Variants" ON product_variants FOR ALL TO authenticated USING (true);
CREATE POLICY "Admin Full Orders" ON orders FOR ALL TO authenticated USING (true);
CREATE POLICY "Admin Full Order Items" ON order_items FOR ALL TO authenticated USING (true);
CREATE POLICY "Admin Full Settings" ON settings FOR ALL TO authenticated USING (true);
CREATE POLICY "Admin Full Homepage Photos" ON homepage_photos FOR ALL TO authenticated USING (true);


-- ======================================================================
-- STORAGE: product-images bucket
-- Bucket itself is created with public:true (public read via the direct
-- object URL bypasses RLS entirely), but uploads/deletes via the SDK
-- still go through storage.objects RLS and need explicit policies.
-- ======================================================================
CREATE POLICY "Public Read Product Images" ON storage.objects
  FOR SELECT USING (bucket_id = 'product-images');

CREATE POLICY "Admin Upload Product Images" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'product-images');

CREATE POLICY "Admin Update Product Images" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'product-images');

CREATE POLICY "Admin Delete Product Images" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'product-images');
