-- ======================================================================
-- MIGRATION 003: HOMEPAGE PHOTOS
-- Run this ONCE in the Supabase SQL Editor against the live project.
--
-- Lets an admin pin specific photos for the homepage hero and photo
-- gallery, reusing the existing `product-images` storage bucket. When no
-- row exists for a section, the homepage falls back to auto-selecting
-- from product photos (today's behavior) — same additive/safe pattern as
-- the per-variant image override in migration 002.
-- ======================================================================

CREATE TABLE homepage_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section TEXT NOT NULL CHECK (section IN ('hero', 'gallery')),
  image_url TEXT NOT NULL,
  alt_text TEXT,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_homepage_photos_section ON homepage_photos(section, display_order);

CREATE TRIGGER update_homepage_photos_updated_at
  BEFORE UPDATE ON homepage_photos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

GRANT ALL ON homepage_photos TO anon, authenticated, service_role;

ALTER TABLE homepage_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public Read Homepage Photos" ON homepage_photos FOR SELECT USING (true);
CREATE POLICY "Admin Full Homepage Photos" ON homepage_photos FOR ALL TO authenticated USING (true);
