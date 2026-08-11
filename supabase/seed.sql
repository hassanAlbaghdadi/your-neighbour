-- ======================================================================
-- YOUR NEIGHBOUR — PLACEHOLDER MENU DATA
-- Realistic sample categories/products so the storefront has something to
-- render during development. Replace via the admin Products screen once
-- real menu data is available. Safe to re-run (ON CONFLICT DO NOTHING).
-- ======================================================================

INSERT INTO categories (name, slug, display_order) VALUES
  ('Breads', 'breads', 1),
  ('Pastries', 'pastries', 2),
  ('Cakes & Cupcakes', 'cakes-cupcakes', 3),
  ('Cookies & Bars', 'cookies-bars', 4),
  ('Savory', 'savory', 5)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO products
  (category_id, name, slug, description, is_available, preparation_notice, allergens, display_order)
VALUES
  ((SELECT id FROM categories WHERE slug = 'breads'),
    'Classic Sourdough Loaf', 'classic-sourdough-loaf',
    'A tangy, chewy sourdough loaf with a crackling crust, baked fresh each morning.',
    true, 'Baked fresh the morning of your pickup.', 'Contains gluten', 1),
  ((SELECT id FROM categories WHERE slug = 'breads'),
    'Honey Whole Wheat Loaf', 'honey-whole-wheat-loaf',
    'A soft, subtly sweet whole wheat loaf, great for sandwiches or toast.',
    true, 'Baked fresh the morning of your pickup.', 'Contains gluten', 2),
  ((SELECT id FROM categories WHERE slug = 'breads'),
    'Rosemary Focaccia', 'rosemary-focaccia',
    'Olive oil focaccia topped with flaky sea salt and fresh rosemary.',
    true, null, 'Contains gluten', 3),
  ((SELECT id FROM categories WHERE slug = 'breads'),
    'Everything Bagels (6-pack)', 'everything-bagels-6-pack',
    'Hand-rolled bagels topped with our everything seasoning blend.',
    true, null, 'Contains gluten, sesame', 4),

  ((SELECT id FROM categories WHERE slug = 'pastries'),
    'Butter Croissant', 'butter-croissant',
    'Laminated, flaky, and golden — the classic French butter croissant.',
    true, null, 'Contains gluten, dairy, eggs', 1),
  ((SELECT id FROM categories WHERE slug = 'pastries'),
    'Chocolate Croissant', 'chocolate-croissant',
    'A butter croissant filled with rich dark chocolate.',
    true, null, 'Contains gluten, dairy, eggs', 2),
  ((SELECT id FROM categories WHERE slug = 'pastries'),
    'Cinnamon Roll', 'cinnamon-roll',
    'A soft, swirled roll with cinnamon-brown sugar filling and cream cheese icing.',
    true, 'Best enjoyed the day of pickup.', 'Contains gluten, dairy, eggs', 3),
  ((SELECT id FROM categories WHERE slug = 'pastries'),
    'Almond Danish', 'almond-danish',
    'Flaky pastry filled with almond cream and topped with sliced almonds.',
    true, null, 'Contains gluten, dairy, eggs, tree nuts', 4),

  ((SELECT id FROM categories WHERE slug = 'cakes-cupcakes'),
    'Classic Vanilla Cupcakes (4-pack)', 'classic-vanilla-cupcakes-4-pack',
    'Vanilla bean cupcakes topped with vanilla buttercream.',
    true, null, 'Contains gluten, dairy, eggs', 1),
  ((SELECT id FROM categories WHERE slug = 'cakes-cupcakes'),
    'Double Chocolate Cupcakes (4-pack)', 'double-chocolate-cupcakes-4-pack',
    'Rich chocolate cupcakes with chocolate ganache frosting.',
    true, null, 'Contains gluten, dairy, eggs', 2),
  ((SELECT id FROM categories WHERE slug = 'cakes-cupcakes'),
    'Carrot Cake Slice', 'carrot-cake-slice',
    'Spiced carrot cake with walnuts and cream cheese frosting.',
    true, null, 'Contains gluten, dairy, eggs, tree nuts', 3),
  ((SELECT id FROM categories WHERE slug = 'cakes-cupcakes'),
    'Lemon Drizzle Loaf Cake', 'lemon-drizzle-loaf-cake',
    'A moist lemon loaf cake finished with a tart lemon glaze.',
    true, '24-hour notice required for whole loaf cakes.', 'Contains gluten, dairy, eggs', 4),

  ((SELECT id FROM categories WHERE slug = 'cookies-bars'),
    'Chocolate Chip Cookies (6-pack)', 'chocolate-chip-cookies-6-pack',
    'Our classic chewy chocolate chip cookies.',
    true, null, 'Contains gluten, dairy, eggs', 1),
  ((SELECT id FROM categories WHERE slug = 'cookies-bars'),
    'Oatmeal Raisin Cookies (6-pack)', 'oatmeal-raisin-cookies-6-pack',
    'Soft oatmeal cookies studded with plump raisins.',
    true, null, 'Contains gluten, dairy, eggs', 2),
  ((SELECT id FROM categories WHERE slug = 'cookies-bars'),
    'Fudge Brownies (4-pack)', 'fudge-brownies-4-pack',
    'Dense, fudgy brownies with a crackly top.',
    false, null, 'Contains gluten, dairy, eggs', 3),

  ((SELECT id FROM categories WHERE slug = 'savory'),
    'Spinach & Feta Hand Pie', 'spinach-feta-hand-pie',
    'Flaky pastry filled with spinach, feta, and herbs.',
    true, null, 'Contains gluten, dairy, eggs', 1),
  ((SELECT id FROM categories WHERE slug = 'savory'),
    'Cheddar Herb Scone', 'cheddar-herb-scone',
    'A savory scone loaded with sharp cheddar and fresh herbs.',
    true, null, 'Contains gluten, dairy, eggs', 2)
ON CONFLICT (slug) DO NOTHING;

-- Every placeholder product gets exactly one "Regular" variant carrying the
-- price. NOT EXISTS guard keeps this safe to re-run (no unique constraint on
-- product_variants to key an ON CONFLICT off of).
WITH variant_prices (slug, price) AS (
  VALUES
    ('classic-sourdough-loaf', 8.50::numeric),
    ('honey-whole-wheat-loaf', 7.50::numeric),
    ('rosemary-focaccia', 9.00::numeric),
    ('everything-bagels-6-pack', 9.00::numeric),
    ('butter-croissant', 4.25::numeric),
    ('chocolate-croissant', 4.75::numeric),
    ('cinnamon-roll', 5.00::numeric),
    ('almond-danish', 5.25::numeric),
    ('classic-vanilla-cupcakes-4-pack', 12.00::numeric),
    ('double-chocolate-cupcakes-4-pack', 13.00::numeric),
    ('carrot-cake-slice', 6.50::numeric),
    ('lemon-drizzle-loaf-cake', 16.00::numeric),
    ('chocolate-chip-cookies-6-pack', 8.00::numeric),
    ('oatmeal-raisin-cookies-6-pack', 8.00::numeric),
    ('fudge-brownies-4-pack', 9.50::numeric),
    ('spinach-feta-hand-pie', 6.00::numeric),
    ('cheddar-herb-scone', 4.50::numeric)
)
INSERT INTO product_variants (product_id, label, price, is_available, display_order)
SELECT p.id, 'Regular', vp.price, p.is_available, 0
FROM variant_prices vp
JOIN products p ON p.slug = vp.slug
WHERE NOT EXISTS (
  SELECT 1 FROM product_variants v WHERE v.product_id = p.id
);
