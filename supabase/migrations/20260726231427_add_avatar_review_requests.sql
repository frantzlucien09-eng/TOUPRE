/*
# Avatar review workflow

## Overview
Vendor (and customer) profile photos must show a real human face — not a logo,
product photo, or generic image. New/changed avatars are held for admin review
before going live. The previous approved avatar stays active until the new one
is approved.

## New table: `avatar_review_requests`
- `id` (uuid PK)
- `vendor_id` (uuid FK -> vendors)
- `new_avatar_url` (text) — uploaded image path in storage
- `status` (text) — 'pending' | 'approved' | 'rejected' (default 'pending')
- `rejection_reason` (text, nullable)
- `created_at` (timestamptz)
- `reviewed_at` (timestamptz, nullable)

## Storage
- Bucket `avatars` created for vendor/customer profile photos.
- Vendors can upload (INSERT) objects under their own id path.
- Public read so avatars can be displayed.

## Security
- RLS on table: vendors SELECT/INSERT their own rows.
- UPDATE restricted to service role (admin).
*/

CREATE TABLE IF NOT EXISTS avatar_review_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  new_avatar_url text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz
);

ALTER TABLE avatar_review_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_avatar_requests" ON avatar_review_requests;
CREATE POLICY "select_own_avatar_requests" ON avatar_review_requests FOR SELECT
  TO authenticated USING (auth.uid() = vendor_id);

DROP POLICY IF EXISTS "insert_own_avatar_requests" ON avatar_review_requests;
CREATE POLICY "insert_own_avatar_requests" ON avatar_review_requests FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = vendor_id);

-- Storage bucket for avatars
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "avatar_upload_own" ON storage.objects;
CREATE POLICY "avatar_upload_own" ON storage.objects FOR INSERT
  TO authenticated WITH CHECK (bucket_id = 'avatars');

DROP POLICY IF EXISTS "avatar_read_public" ON storage.objects;
CREATE POLICY "avatar_read_public" ON storage.objects FOR SELECT
  TO anon, authenticated USING (bucket_id = 'avatars');

-- Admin approval applies the new avatar to vendors.avatar_url
CREATE OR REPLACE FUNCTION approve_avatar(p_request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  req avatar_review_requests%ROWTYPE;
BEGIN
  SELECT * INTO req FROM avatar_review_requests WHERE id = p_request_id;
  IF req.id IS NULL OR req.status <> 'pending' THEN
    RETURN;
  END IF;
  UPDATE vendors SET avatar_url = req.new_avatar_url, updated_at = now()
    WHERE id = req.vendor_id;
  UPDATE avatar_review_requests
    SET status = 'approved', reviewed_at = now()
    WHERE id = p_request_id;
  INSERT INTO notifications (user_id, type, title, body)
    VALUES (req.vendor_id, 'avatar', 'Foto pwofil ou apwouve',
      'Foto pwofil ou apwouve pa Admin. Li parèt kounye a sou pwofil ou.');
END;
$$;

CREATE OR REPLACE FUNCTION reject_avatar(p_request_id uuid, p_reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  req avatar_review_requests%ROWTYPE;
BEGIN
  SELECT * INTO req FROM avatar_review_requests WHERE id = p_request_id;
  IF req.id IS NULL OR req.status <> 'pending' THEN
    RETURN;
  END IF;
  UPDATE avatar_review_requests
    SET status = 'rejected', reviewed_at = now(), rejection_reason = p_reason
    WHERE id = p_request_id;
  INSERT INTO notifications (user_id, type, title, body)
    VALUES (req.vendor_id, 'avatar', 'Foto pwofil ou rejte',
      coalesce('Foto pwofil ou rejte pa Admin.' || CASE WHEN p_reason IS NULL THEN '' ELSE ' Rezon: ' || p_reason END,
               'Foto pwofil ou rejte pa Admin. Tanpri chwazi yon foto kote figi w vizib.'));
END;
$$;
