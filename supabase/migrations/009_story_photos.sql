-- ======================================================================
-- MIGRATION 009: OUR STORY PAGE PHOTOS
-- Run this ONCE in the Supabase SQL Editor against the live project.
--
-- Extends homepage_photos' section allowlist with slots for the new
-- /our-story page (split hero, two narrative beats, a "day in the life"
-- timeline, and a closing filmstrip). Same table, same additive/safe
-- fallback pattern as 'hero'/'gallery' — an admin can leave any of these
-- unset and the storefront falls back to existing product/homepage
-- photos rather than rendering empty.
-- ======================================================================

ALTER TABLE homepage_photos DROP CONSTRAINT IF EXISTS homepage_photos_section_check;
ALTER TABLE homepage_photos ADD CONSTRAINT homepage_photos_section_check
  CHECK (section IN (
    'hero', 'gallery',
    'story_hero', 'story_beat_1', 'story_beat_2', 'story_timeline', 'story_gallery'
  ));
