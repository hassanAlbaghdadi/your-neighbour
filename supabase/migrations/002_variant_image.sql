-- ======================================================================
-- MIGRATION 002: PER-VARIANT PHOTO OVERRIDE
-- Run this ONCE in the Supabase SQL Editor against the live project.
--
-- Adds an optional image_url to product_variants. The storefront falls
-- back to the parent product's photo when a variant has none set, so this
-- is additive/safe — nothing breaks or changes for existing variants until
-- an admin explicitly uploads a variant-specific photo (e.g. the "With
-- Fresh Flowers" cake variant).
-- ======================================================================

ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS image_url TEXT;
