/*
# Add delivery note and payment status to orders

1. Modified Tables
- `orders`
  - `delivery_note` (text, nullable) — free-text description the customer writes to help the vendor find the location (e.g. "Kay gri ak baryè nwa..."). Used on the preparing/delivering pages.
  - `payment_status` (text, nullable, default 'pending') — tracks whether the customer has paid via MonCash. Values: 'pending' | 'paid'.
2. Security
- No RLS policy changes. Existing vendor/customer ownership policies on `orders` already cover SELECT/UPDATE for these new columns.
3. Notes
- Both columns are nullable and additive, so existing rows and code keep working unchanged.
- `payment_status` defaults to 'pending' so new orders start unpaid until MonCash confirms.
*/

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS delivery_note text,
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'pending';
