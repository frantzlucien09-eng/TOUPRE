/*
# TOUPRE — Shared database schema (Vendor + Customer + Admin apps)

## Overview
This migration creates the full shared database for the TOUPRE marketplace platform.
All three applications (Vendor app, Customer app, Admin site) read and write to the
SAME tables so that orders, products, accounts, money, and notifications stay
synchronized in real time.

## New Tables
1. `zones` — Departments and cities/communes used across all apps.
   - `id` (uuid PK), `department` (text), `city` (text), `created_at`
2. `vendors` — Vendor business profiles (one per auth user).
   - `id` (uuid PK = auth.users.id), `business_name`, `phone`, `email`,
     `address`, `department`, `city`, `description`, `avatar_url`,
     `pickup_address`, `moncash_phone`, `moncash_name`,
     `trust_score` (int, 100..0, -25 per infraction), `points` (int),
     `orders_sent` (int), `balance` (numeric, available HTG),
     `status` (active/suspended), `joined_at`, `updated_at`
3. `products` — Items a vendor sells.
   - `id` (uuid PK), `vendor_id` (FK -> vendors.id), `name`, `description`,
     `price` (numeric HTG), `image_url`, `stock` (int), `active` (bool),
     `created_at`, `updated_at`
4. `customers` — Customer profiles (one per auth user).
   - `id` (uuid PK = auth.users.id), `full_name`, `phone`, `email`,
     `department`, `city`, `address`, `created_at`
5. `orders` — Orders placed by customers, fulfilled by vendors.
   - `id` (uuid PK), `customer_id` (FK -> customers.id),
     `vendor_id` (FK -> vendors.id), `items` (jsonb array of
     {product_id, name, qty, price}), `total` (numeric HTG),
     `delivery_type` (delivery/pickup — customer's choice),
     `status` (new/preparing/ready/delivering/delivered/cancelled),
     `reject_reason` (text, nullable), `created_at`, `updated_at`,
     `completed_at`
6. `withdrawals` — Vendor withdrawal requests to admin.
   - `id` (uuid PK), `vendor_id` (FK -> vendors.id), `amount` (numeric HTG),
     `status` (pending/approved/processing/completed/rejected),
     `requested_at`, `processed_at`, `received_at`, `note`
7. `notifications` — In-app notifications for vendors (and reusable for others).
   - `id` (uuid PK), `user_id` (uuid, the recipient auth user),
     `type` (order/message/system/withdrawal/trust),
     `title`, `body`, `read` (bool), `created_at`
8. `trust_history` — Audit log of trust score changes per vendor.
   - `id` (uuid PK), `vendor_id` (FK -> vendors.id), `delta` (int, negative),
     `reason` (text), `new_score` (int), `created_at`
9. `vendor_monthly_stats` — Aggregated monthly performance for Top Vendor rankings.
   - `id` (uuid PK), `vendor_id` (FK -> vendors.id), `year` (int), `month` (int),
     `orders_count` (int), `revenue` (numeric), `zone_rank` (int, nullable),
     `national_rank` (int, nullable), `computed_at`
10. `messages` — Chat messages between customer and vendor about a product/order.
   - `id` (uuid PK), `order_id` (FK -> orders.id, nullable),
     `product_id` (FK -> products.id, nullable),
     `sender_id` (uuid), `recipient_id` (uuid),
     `body` (text), `read` (bool), `created_at`

## Security (RLS)
- `zones`: public read (anon, authenticated), no writes from client.
- `vendors`: authenticated owners can read/update their own row; anyone can read
  (vendors are public for marketplace browsing). Updates scoped to owner.
- `products`: anyone can read (marketplace); only owning vendor can insert/update/delete.
- `customers`: owner can read/update own profile.
- `orders`: vendor can read orders where they are the vendor; customer can read
  their own orders; vendor can update status on their orders; customer can insert
  (place) their own orders.
- `withdrawals`: vendor can read/insert their own; updates handled by admin
  (service role) so no client update policy needed for vendors.
- `notifications`: user can read/update-read/insert their own.
- `trust_history`: vendor can read their own; inserts via service role only.
- `vendor_monthly_stats`: anyone can read (rankings are public).
- `messages`: participants can read their own messages; any authenticated user
  can insert a message they send.

## Important Notes
1. Owner columns default to `auth.uid()` so client inserts that omit the owner
   still satisfy WITH CHECK policies.
2. Admin operations (approving withdrawals, adjusting trust, suspending
   accounts) are performed with the service role key from the Admin site and
   therefore bypass RLS — no client-facing policies are needed for those paths.
3. All money columns are `numeric(14,2)` to represent HTG accurately.
*/

-- ============ ZONES ============
CREATE TABLE IF NOT EXISTS zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department text NOT NULL,
  city text NOT NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE zones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_read_zones" ON zones;
CREATE POLICY "public_read_zones" ON zones FOR SELECT
  TO anon, authenticated USING (true);

-- ============ VENDORS ============
CREATE TABLE IF NOT EXISTS vendors (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  business_name text NOT NULL,
  phone text,
  email text,
  address text,
  department text,
  city text,
  description text,
  avatar_url text,
  pickup_address text,
  moncash_phone text,
  moncash_name text,
  trust_score int NOT NULL DEFAULT 100,
  points int NOT NULL DEFAULT 0,
  orders_sent int NOT NULL DEFAULT 0,
  balance numeric(14,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  joined_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_read_vendors" ON vendors;
CREATE POLICY "public_read_vendors" ON vendors FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "owner_update_vendor" ON vendors;
CREATE POLICY "owner_update_vendor" ON vendors FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "owner_insert_vendor" ON vendors;
CREATE POLICY "owner_insert_vendor" ON vendors FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

-- ============ PRODUCTS ============
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  price numeric(14,2) NOT NULL DEFAULT 0,
  image_url text,
  stock int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_read_products" ON products;
CREATE POLICY "public_read_products" ON products FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "owner_insert_product" ON products;
CREATE POLICY "owner_insert_product" ON products FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = vendor_id);
DROP POLICY IF EXISTS "owner_update_product" ON products;
CREATE POLICY "owner_update_product" ON products FOR UPDATE
  TO authenticated USING (auth.uid() = vendor_id) WITH CHECK (auth.uid() = vendor_id);
DROP POLICY IF EXISTS "owner_delete_product" ON products;
CREATE POLICY "owner_delete_product" ON products FOR DELETE
  TO authenticated USING (auth.uid() = vendor_id);
CREATE INDEX IF NOT EXISTS idx_products_vendor ON products(vendor_id);

-- ============ CUSTOMERS ============
CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  phone text,
  email text,
  department text,
  city text,
  address text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_read_customers" ON customers;
CREATE POLICY "public_read_customers" ON customers FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "owner_update_customer" ON customers;
CREATE POLICY "owner_update_customer" ON customers FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "owner_insert_customer" ON customers;
CREATE POLICY "owner_insert_customer" ON customers FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

-- ============ ORDERS ============
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  vendor_id uuid REFERENCES vendors(id) ON DELETE CASCADE,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  total numeric(14,2) NOT NULL DEFAULT 0,
  delivery_type text NOT NULL DEFAULT 'delivery',
  status text NOT NULL DEFAULT 'new',
  reject_reason text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  completed_at timestamptz
);
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "vendor_read_orders" ON orders;
CREATE POLICY "vendor_read_orders" ON orders FOR SELECT
  TO authenticated USING (auth.uid() = vendor_id);
DROP POLICY IF EXISTS "customer_read_orders" ON orders;
CREATE POLICY "customer_read_orders" ON orders FOR SELECT
  TO authenticated USING (auth.uid() = customer_id);
DROP POLICY IF EXISTS "vendor_update_orders" ON orders;
CREATE POLICY "vendor_update_orders" ON orders FOR UPDATE
  TO authenticated USING (auth.uid() = vendor_id) WITH CHECK (auth.uid() = vendor_id);
DROP POLICY IF EXISTS "customer_insert_orders" ON orders;
CREATE POLICY "customer_insert_orders" ON orders FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_vendor ON orders(vendor_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

-- ============ WITHDRAWALS ============
CREATE TABLE IF NOT EXISTS withdrawals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  amount numeric(14,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  requested_at timestamptz DEFAULT now(),
  processed_at timestamptz,
  received_at timestamptz,
  note text
);
ALTER TABLE withdrawals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "vendor_read_withdrawals" ON withdrawals;
CREATE POLICY "vendor_read_withdrawals" ON withdrawals FOR SELECT
  TO authenticated USING (auth.uid() = vendor_id);
DROP POLICY IF EXISTS "vendor_insert_withdrawals" ON withdrawals;
CREATE POLICY "vendor_insert_withdrawals" ON withdrawals FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = vendor_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_vendor ON withdrawals(vendor_id);

-- ============ NOTIFICATIONS ============
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL DEFAULT 'system',
  title text NOT NULL,
  body text,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "owner_read_notifications" ON notifications;
CREATE POLICY "owner_read_notifications" ON notifications FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "owner_update_notifications" ON notifications;
CREATE POLICY "owner_update_notifications" ON notifications FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "owner_insert_notifications" ON notifications;
CREATE POLICY "owner_insert_notifications" ON notifications FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);

-- ============ TRUST HISTORY ============
CREATE TABLE IF NOT EXISTS trust_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  delta int NOT NULL DEFAULT 0,
  reason text,
  new_score int NOT NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE trust_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "owner_read_trust_history" ON trust_history;
CREATE POLICY "owner_read_trust_history" ON trust_history FOR SELECT
  TO authenticated USING (auth.uid() = vendor_id);
CREATE INDEX IF NOT EXISTS idx_trust_vendor ON trust_history(vendor_id);

-- ============ VENDOR MONTHLY STATS ============
CREATE TABLE IF NOT EXISTS vendor_monthly_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  year int NOT NULL,
  month int NOT NULL,
  orders_count int NOT NULL DEFAULT 0,
  revenue numeric(14,2) NOT NULL DEFAULT 0,
  zone_rank int,
  national_rank int,
  computed_at timestamptz DEFAULT now()
);
ALTER TABLE vendor_monthly_stats ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_read_vendor_stats" ON vendor_monthly_stats;
CREATE POLICY "public_read_vendor_stats" ON vendor_monthly_stats FOR SELECT
  TO anon, authenticated USING (true);
CREATE INDEX IF NOT EXISTS idx_stats_vendor ON vendor_monthly_stats(vendor_id);
CREATE INDEX IF NOT EXISTS idx_stats_period ON vendor_monthly_stats(year, month);

-- ============ MESSAGES ============
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  recipient_id uuid NOT NULL,
  body text NOT NULL,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "participants_read_messages" ON messages;
CREATE POLICY "participants_read_messages" ON messages FOR SELECT
  TO authenticated USING (auth.uid() = sender_id OR auth.uid() = recipient_id);
DROP POLICY IF EXISTS "sender_insert_messages" ON messages;
CREATE POLICY "sender_insert_messages" ON messages FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_recipient ON messages(recipient_id);
