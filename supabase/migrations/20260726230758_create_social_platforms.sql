/*
# Create social_platforms table

## Overview
Shared table for official TOUPRE social platform links, managed by Admin
and displayed in both the Customer app and Vendor app "Swiv Nou" pages.
A single source of truth — admin adds/edits links, both apps update
automatically without code changes.

## New table: `social_platforms`
- `id` (uuid PK)
- `name` (text, unique) — platform identifier: 'instagram', 'tiktok', 'facebook', 'whatsapp', etc.
- `label` (text) — display name shown to users, e.g. "Instagram"
- `url` (text) — full official profile URL
- `icon_key` (text) — key the frontend maps to an icon/color
- `active` (boolean, default true) — only active platforms appear in apps
- `sort_order` (int, default 0) — display ordering
- `created_at`, `updated_at` (timestamptz)

## Security
- RLS enabled. Public read (anon + authenticated) so both apps can fetch.
- Only service role (admin) can insert/update/delete — no client writes.

## Seed
- Instagram and TikTok seeded as active. Others left for admin to add.
*/

CREATE TABLE IF NOT EXISTS social_platforms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  label text NOT NULL,
  url text NOT NULL,
  icon_key text NOT NULL DEFAULT 'globe',
  active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE social_platforms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_social_platforms" ON social_platforms;
CREATE POLICY "public_read_social_platforms" ON social_platforms FOR SELECT
  TO anon, authenticated USING (true);

INSERT INTO social_platforms (name, label, url, icon_key, active, sort_order)
VALUES
  ('instagram', 'Instagram', 'https://www.instagram.com/toupreapp/', 'instagram', true, 1),
  ('tiktok', 'TikTok', 'https://www.tiktok.com/@toupreapp', 'tiktok', true, 2)
ON CONFLICT (name) DO NOTHING;
