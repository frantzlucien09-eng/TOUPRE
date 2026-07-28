-- Create the three storage buckets referenced in the app code.
-- None existed, causing "Bucket not found" on every upload.

INSERT INTO storage.buckets (id, name, public, created_at, updated_at)
VALUES
  ('product-media', 'product-media', true, now(), now()),
  ('avatars', 'avatars', true, now(), now()),
  ('kyc-documents', 'kyc-documents', true, now(), now())
ON CONFLICT (id) DO NOTHING;

-- ---- product-media policies ----
-- Anyone (including anon) can read product photos/videos
DROP POLICY IF EXISTS "product_media_public_read" ON storage.objects;
CREATE POLICY "product_media_public_read" ON storage.objects FOR SELECT
  TO public USING (bucket_id = 'product-media');

-- Authenticated vendors can upload to product-media
DROP POLICY IF EXISTS "product_media_authed_insert" ON storage.objects;
CREATE POLICY "product_media_authed_insert" ON storage.objects FOR INSERT
  TO authenticated WITH CHECK (bucket_id = 'product-media');

-- Authenticated vendors can update/delete their own product media
DROP POLICY IF EXISTS "product_media_authed_update" ON storage.objects;
CREATE POLICY "product_media_authed_update" ON storage.objects FOR UPDATE
  TO authenticated USING (bucket_id = 'product-media') WITH CHECK (bucket_id = 'product-media');

DROP POLICY IF EXISTS "product_media_authed_delete" ON storage.objects;
CREATE POLICY "product_media_authed_delete" ON storage.objects FOR DELETE
  TO authenticated USING (bucket_id = 'product-media');

-- ---- avatars policies ----
DROP POLICY IF EXISTS "avatars_public_read" ON storage.objects;
CREATE POLICY "avatars_public_read" ON storage.objects FOR SELECT
  TO public USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "avatars_authed_insert" ON storage.objects;
CREATE POLICY "avatars_authed_insert" ON storage.objects FOR INSERT
  TO authenticated WITH CHECK (bucket_id = 'avatars');

DROP POLICY IF EXISTS "avatars_authed_update" ON storage.objects;
CREATE POLICY "avatars_authed_update" ON storage.objects FOR UPDATE
  TO authenticated USING (bucket_id = 'avatars') WITH CHECK (bucket_id = 'avatars');

DROP POLICY IF EXISTS "avatars_authed_delete" ON storage.objects;
CREATE POLICY "avatars_authed_delete" ON storage.objects FOR DELETE
  TO authenticated USING (bucket_id = 'avatars');

-- ---- kyc-documents policies ----
-- Public read so admins can view via getPublicUrl; uploads restricted to authenticated
DROP POLICY IF EXISTS "kyc_docs_public_read" ON storage.objects;
CREATE POLICY "kyc_docs_public_read" ON storage.objects FOR SELECT
  TO public USING (bucket_id = 'kyc-documents');

DROP POLICY IF EXISTS "kyc_docs_authed_insert" ON storage.objects;
CREATE POLICY "kyc_docs_authed_insert" ON storage.objects FOR INSERT
  TO authenticated WITH CHECK (bucket_id = 'kyc-documents');

DROP POLICY IF EXISTS "kyc_docs_authed_update" ON storage.objects;
CREATE POLICY "kyc_docs_authed_update" ON storage.objects FOR UPDATE
  TO authenticated USING (bucket_id = 'kyc-documents') WITH CHECK (bucket_id = 'kyc-documents');

DROP POLICY IF EXISTS "kyc_docs_authed_delete" ON storage.objects;
CREATE POLICY "kyc_docs_authed_delete" ON storage.objects FOR DELETE
  TO authenticated USING (bucket_id = 'kyc-documents');
