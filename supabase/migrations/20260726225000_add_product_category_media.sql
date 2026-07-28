/*
# Add category, details, photos, and video to products

## Overview
Extends the `products` table so a vendor can post items in different categories
(Kay, Machin, Manje, Rad, Soulye, Lòt) with category-specific metadata, a
gallery of 4-7 photos, and an optional video.

## Changes to `products`
1. `category` (text, nullable) — one of: kay, machin, manje, rad, soulye, lot.
2. `details` (jsonb, default '{}') — flexible category-specific fields
   (e.g. { rooms: 3, bathrooms: 2, has_electricity: true } for kay).
   Stored as JSON so new categories can be added later without schema changes.
3. `photos` (jsonb, default '[]') — array of up to 7 public URLs for product
   photos. Order matters; `cover_index` points to the cover image.
4. `cover_index` (int, default 0) — index into `photos` for the cover image.
5. `video_url` (text, nullable) — optional short product video URL.
6. `price_on_request` (boolean, default false) — for Kay/Machin when the vendor
   prefers "Pri sou Demand" instead of a fixed price.

## Security
- No new tables. Existing product RLS policies already cover these columns
  (owner-scoped insert/update/delete, public read). No policy changes needed.

## Notes
- All new columns are nullable / have defaults so existing products remain valid.
- The frontend enforces the 4-7 photo minimum at publish time.
*/

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS details jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS photos jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS cover_index int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS video_url text,
  ADD COLUMN IF NOT EXISTS price_on_request boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
