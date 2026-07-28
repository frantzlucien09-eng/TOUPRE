/*
# Add ad (paid publishing) system for Kay/Machin products

## Overview
Kay and Machin listings are paid ads (2,500 HTG each), not direct-sale products.
This migration adds ad status tracking to `products` and a new `ad_payments`
table for the admin financial report.

## Changes to `products`
1. `ad_status` (text, nullable) — applies only to kay/machin categories.
   Values: 'draft' (unpaid, not public), 'active' (paid & visible),
   'sold' (vendor marked sold/rented, removed from public), 'expired' (past
   30-day limit, vendor must repay to relist). NULL for non-ad categories.
2. `ad_paid_at` (timestamptz, nullable) — when the ad fee was paid.
3. `ad_expires_at` (timestamptz, nullable) — 30 days after payment; after
   this the ad is 'expired' and the vendor must repay 2,500 HTG to relist.

## New table: `ad_payments`
- Records every 2,500 HTG ad fee payment for the admin report.
- `id` (uuid PK), `vendor_id` (FK -> vendors), `product_id` (FK -> products),
  `amount` (numeric, 2500), `category` (kay/machin), `status` (pending/paid/failed),
  `moncash_phone`, `paid_at`, `created_at`.
- RLS: vendor can read/insert their own; admin uses service role.

## Security
- `ad_payments`: owner-scoped read + insert for authenticated vendors.
- `products` existing policies already cover the new columns.

## Notes
- The 2,500 HTG fee is a constant (AD_FEE) enforced in the app; it is not a
  DB constraint so the amount can be adjusted later.
- Ad expiry is checked at read time in the app (status='active' AND
  ad_expires_at < now → treat as expired). A scheduled admin job can also
  bulk-update; this migration keeps it simple.
*/

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS ad_status text,
  ADD COLUMN IF NOT EXISTS ad_paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS ad_expires_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_products_ad_status ON products(ad_status);

CREATE TABLE IF NOT EXISTS ad_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  amount numeric(14,2) NOT NULL DEFAULT 2500,
  category text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  moncash_phone text,
  paid_at timestamptz,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE ad_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vendor_read_ad_payments" ON ad_payments;
CREATE POLICY "vendor_read_ad_payments" ON ad_payments FOR SELECT
  TO authenticated USING (auth.uid() = vendor_id);

DROP POLICY IF EXISTS "vendor_insert_ad_payments" ON ad_payments;
CREATE POLICY "vendor_insert_ad_payments" ON ad_payments FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = vendor_id);

DROP POLICY IF EXISTS "vendor_update_ad_payments" ON ad_payments;
CREATE POLICY "vendor_update_ad_payments" ON ad_payments FOR UPDATE
  TO authenticated USING (auth.uid() = vendor_id) WITH CHECK (auth.uid() = vendor_id);

CREATE INDEX IF NOT EXISTS idx_ad_payments_vendor ON ad_payments(vendor_id);
CREATE INDEX IF NOT EXISTS idx_ad_payments_product ON ad_payments(product_id);
CREATE INDEX IF NOT EXISTS idx_ad_payments_status ON ad_payments(status);
