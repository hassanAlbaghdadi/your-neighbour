-- ======================================================================
-- MIGRATION 010: OUR STORY PAGE SLOTS UPDATE
-- Run this ONCE in the Supabase SQL Editor against the live project.
--
-- The "day in the kitchen" timeline and the closing photo filmstrip were
-- removed from /our-story, and a third narrative beat (the "no wholesale
-- supplier, no walk-in freezer" section) was added. Drops any photos an
-- admin had curated for the two removed sections, then updates
-- homepage_photos' section allowlist to match: story_timeline and
-- story_gallery are gone, story_beat_3 is new.
-- ======================================================================

DELETE FROM homepage_photos WHERE section IN ('story_timeline', 'story_gallery');

ALTER TABLE homepage_photos DROP CONSTRAINT IF EXISTS homepage_photos_section_check;
ALTER TABLE homepage_photos ADD CONSTRAINT homepage_photos_section_check
  CHECK (section IN (
    'hero', 'gallery',
    'story_hero', 'story_beat_1', 'story_beat_2', 'story_beat_3'
  ));
