======================================================================
PRODUCT REQUIREMENTS DOCUMENT (PRD) & BLUEPRINT
PROJECT: Your Neighbour (Bakery MVP)
======================================================================

1. EXECUTIVE SUMMARY & GOALS
----------------------------------------------------------------------
Your Neighbour is a warm, community-focused online ordering platform 
designed to help local customers pre-order fresh baked goods for 
pickup while giving the business owner total control over daily 
baking capacity and orders.

- Customer Goal: Browse available treats, add items to a cart, and 
  place a local pickup order in under 2 minutes.
- Owner Goal: Know exactly what items to bake each morning without 
  overbooking capacity or managing chaotic DMs/text messages.


2. TECHNICAL STACK ARCHITECTURE
----------------------------------------------------------------------
- Frontend: Next.js (App Router), React, Tailwind CSS, shadcn/ui
- Backend & Database: Supabase (PostgreSQL, Supabase Auth, Storage)
- SDK / API Layer: Direct @supabase/supabase-js (No external ORM)
- Form & Validation: React Hook Form, Zod, date-fns
- Design Pattern: Server Actions as light transport endpoints + Domain Service Modules
- Email Service: Resend API (resend package)
- Hosting: Vercel (Hobby Tier - $0/month)


3. DATABASE SCHEMA (POSTGRESQL / SUPABASE)
----------------------------------------------------------------------

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
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  price NUMERIC(10, 2) NOT NULL,
  image_url TEXT,
  is_available BOOLEAN DEFAULT TRUE,
  preparation_notice TEXT,
  allergens TEXT,
  display_order INT DEFAULT 0,
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

-- INDEXES FOR QUERY OPTIMIZATION
CREATE INDEX idx_products_available ON products(is_available);
CREATE INDEX idx_orders_pickup ON orders(pickup_date, pickup_time);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_order_items_order_id ON order_items(order_id);


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
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_order_items_updated_at BEFORE UPDATE ON order_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_settings_updated_at BEFORE UPDATE ON settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


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
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ======================================================================
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Public Read Only (Catalog and Store Settings)
CREATE POLICY "Public Read Categories" ON categories FOR SELECT USING (true);
CREATE POLICY "Public Read Products" ON products FOR SELECT USING (true);
CREATE POLICY "Public Read Settings" ON settings FOR SELECT USING (true);

-- Direct Public Writes Disallowed (Orders inserted strictly via Server Actions / Service Role)

-- Authenticated Owner Full Access
CREATE POLICY "Admin Full Categories" ON categories FOR ALL TO authenticated USING (true);
CREATE POLICY "Admin Full Products" ON products FOR ALL TO authenticated USING (true);
CREATE POLICY "Admin Full Orders" ON orders FOR ALL TO authenticated USING (true);
CREATE POLICY "Admin Full Order Items" ON order_items FOR ALL TO authenticated USING (true);
CREATE POLICY "Admin Full Settings" ON settings FOR ALL TO authenticated USING (true);


4. CORE BUSINESS LOGIC & RULES
----------------------------------------------------------------------
1. Daily Capacity Validation:
   Before allowing a customer to select a pickup date, calculate:
   Total Daily Orders = COUNT(orders where pickup_date = D AND status != 'Cancelled')
   If Total Daily Orders >= max_orders_per_day, disable date D on the calendar ("SOLD OUT").

2. 24-Hour Advance Notice Rule:
   The pickup date picker defaults to (Current Date + 1 Day).
   Same-day ordering is disabled to allow time for baking prep.

3. Dual Notification Rule:
   Every submitted order triggers 2 asynchronous emails via Resend:
   - Customer: Receipt + Order Summary + Pickup Details.
   - Owner: Alert email with customer contact info & item baking list.

4. Server-Side Price Verification:
   The server ignores subtotal/total sent from the client. `createOrder()` fetches active unit_price values directly from the `products` table and calculates subtotal & total on the server before database insertion.

5. Real-Time Product Availability Check:
   Before inserting an order, verify that every `product_id` in the cart exists and has `is_available = true`. If any item is unavailable, throw a user-facing error: "Some items in your cart are no longer available."

6. Non-Blocking Email Delivery:
   Email sending via Resend is asynchronous and wrapped in a try/catch block. If Resend fails or times out, the database order insertion still succeeds, and the failure is logged to prevent blocking customer checkout.

7. Dynamic Time Slot Verification:
   The selected pickup time must exist in the active `pickup_time_slots` array fetched from store settings at the moment of order creation.

8. Idempotency & Duplicate Order Recovery:
   The client generates a UUID (`id = crypto.randomUUID()`) before submitting checkout. `processNewOrder()` first queries Supabase for `orders.id`:
   - If `id` exists: Returns existing order record gracefully without throwing an error or duplicating emails.
   - If `id` does not exist: Validates capacity, calculates totals, inserts records using the client-provided `id`, and fires Resend alerts.

9. Server Actions vs. Service Layer Separation:
   Server Actions in `app/actions/` act purely as thin transport wrappers. Complex business rules, database mutations, price calculations, and Resend API calls are isolated inside `lib/services/`.


5. DEVELOPMENT CHECKLIST
----------------------------------------------------------------------
Phase 1: Environment Setup & Foundation
[ ] Initialize Next.js project:
    npx create-next-app@latest your-neighbour --typescript --tailwind --app --eslint --src-dir --import-alias "@/*"
[ ] Install dependencies:
    npm install @supabase/supabase-js resend lucide-react clsx tailwind-merge zod react-hook-form date-fns
[ ] Set up .env.local with credentials:
    - NEXT_PUBLIC_SUPABASE_URL
    - NEXT_PUBLIC_SUPABASE_ANON_KEY
    - SUPABASE_SERVICE_ROLE_KEY
    - RESEND_API_KEY
[ ] Create Supabase browser, server, and service-role clients in /lib/supabase/

Phase 2: Public Storefront
[ ] Build Navigation Header with "Your Neighbour" branding and active Cart Drawer/Badge.
[ ] Build Cart State Management (localStorage persistence hydrated into React Context).
[ ] Build Menu Grid with Product Cards, Category Filters, and "Sold Out" badges.
[ ] Build Checkout Page/Modal:
    - Calendar Date Picker (enforcing 24-hr advance notice & max_orders_per_day check).
    - Pickup Time Slot Selector (populating from settings).
    - Customer Info Form & Order Submission Action with Client UUID `id`.
[ ] Build Confirmation Page showing order receipt summary and clearing local cart state.

Phase 3: Owner Admin Portal (/admin)
[ ] Build Admin Login page using Supabase Auth (email/password).
[ ] Build Next.js Middleware to protect /admin routes from unauthenticated users.
[ ] Build Order Management Dashboard:
    - Daily Baking Summary (Total quantities required for selected pickup date).
    - Order list filtering (Today, Pending, Preparing, Ready, Completed).
[ ] Build Status Toggle buttons to update order states in real time.
[ ] Build Settings Management tab to adjust max_orders_per_day and pickup slots.

Phase 4: Email Notifications, Deployment & Maintenance
[ ] Integrate Resend in Order Service (Dual emails: Customer Receipt + Owner Alert).
[ ] Upload Product Images to Supabase Storage bucket (`product-images`).
[ ] Deploy project repository to Vercel and add environment variables.
[ ] Create /api/keep-alive endpoint & vercel.json cron job to prevent Supabase free-tier sleep.
[ ] Test full end-to-end flow from checkout to admin status update.


6. INPUT VALIDATION SPECS (ZOD SCHEMAS)
----------------------------------------------------------------------
- id:             Required, valid UUID string (client-generated primary key).
- customer_name:  Required, string, 2-100 characters.
- customer_email: Required, valid email format.
- customer_phone: Required, string, 10-20 characters.
- pickup_date:    Required, valid ISO date string (Min: Today + 1 day).
- pickup_time:    Required, string matching active setting slots (e.g., "09:30").
- notes:          Optional, string, max 500 characters.
- order_items:    Required, non-empty array (quantity >= 1 per item).


7. NEXT.JS APP ROUTER ARCHITECTURE & SERVICE LAYER
----------------------------------------------------------------------
Project Directory Layout:
  src/
    app/
      (storefront)/        --> Public menu, cart drawer, checkout modal, confirmation page
      admin/               --> Auth-protected order manager & setting updates
      actions/             --> Thin Server Actions (Validation & transport)
        orders.ts
        products.ts
        settings.ts
      api/keep-alive/      --> Vercel Cron endpoint to prevent Supabase sleep
    lib/
      services/            --> Use-case service handlers
        orders/
          create-order.ts   --> Idempotency lookup (by 'id'), pricing, capacity, DB write, email
          update-order-status.ts --> Admin order status updater
        products/
          get-products.ts        --> Catalog & availability query
          update-product.ts      --> Admin product modifier
        settings/
          get-settings.ts        --> Store config loader
      supabase/            --> client.ts (Browser), server.ts (Server), serviceRole.ts (Admin DB operations)
      email/               --> resend.ts (Order receipts & admin alert triggers)
    types/                 --> Generated DB types (`npx supabase gen types typescript`) & Cart types

Architecture Guidelines:
- Server Actions (`app/actions/`): Handle Zod validation of raw form inputs, call underlying service methods, and return standard `{ success: boolean, error?: string, data?: T }` responses to the UI.
- Service Layer (`lib/services/`): Pure TypeScript modules holding core domain logic (idempotent lookup by primary key `id`, capacity validation, price recalculation, DB writes using service-role client, Resend API calls).
- Cart Lifecycle: Stored in browser `localStorage`, hydrated into React Context on initial render, and cleared upon navigating to order confirmation.
- Image Storage: Public images hosted in Supabase Storage (`product-images`). Database stores CDN URLs in `products.image_url`.
- Admin Auth Security: Middleware redirects unauthenticated requests away from `/admin/*` routes to `/admin/login`.

Core Server Action & Service Flows:
- createOrderAction(payload):
    1. Validates payload input schema (including client-generated `id` UUID) via Zod in `actions/orders.ts`.
    2. Passes payload to `processNewOrder(payload)`.
    3. Service checks if `orders.id` exists in `orders` table. If found, returns existing order record immediately (idempotent success).
    4. Service verifies product availability (`is_available = true`).
    5. Service checks non-cancelled orders for pickup_date against max_orders_per_day.
    6. Service fetches unit prices directly from the database and recalculates subtotal and total.
    7. Service writes order and items via Supabase Service Role client using primary key `id`.
    8. Service triggers non-blocking dual Resend email notifications.
- updateOrderStatusAction(orderId, newStatus):
    1. Verifies authenticated admin session via Supabase Auth server client.
    2. Calls `updateOrderStatus(orderId, newStatus)` to record update in database.
======================================================================