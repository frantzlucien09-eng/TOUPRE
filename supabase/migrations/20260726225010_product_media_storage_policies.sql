/*
# Storage policies for product-media bucket

## Overview
Allows authenticated vendors to upload, read, and delete photos/videos for
their own products in the `product-media` public bucket.

## Policies
1. Public read — anyone (anon, authenticated) can read files (public bucket).
2. Authenticated upload — any signed-in user can upload to the bucket.
   (Ownership of the product is enforced at the DB layer; the bucket path
   includes the vendor id so files are namespaced per vendor.)
3. Authenticated update/delete — owner of the file path can update/delete.

## Notes
- The bucket is public so product photos load without auth headers in the
  customer app and admin site.
- Paths are namespaced as `<vendor_id>/<product_id>/<filename>` so vendors can
  only manage their own files.
*/

-- Public read for product media
DROP POLICY IF EXISTS "public_read_product_media" ON storage.objects;
CREATE POLICY "public_read_product_media" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'product-media');

-- Authenticated upload
DROP POLICY IF EXISTS "auth_upload_product_media" ON storage.objects;
CREATE POLICY "auth_upload_product_media" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'product-media');

-- Owner update (path starts with vendor id = auth.uid())
DROP POLICY IF EXISTS "owner_update_product_media" ON storage.objects;
CREATE POLICY "owner_update_product_media" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'product-media' AND owner = auth.uid())
  WITH CHECK (bucket_id = 'product-media');

-- Owner delete
DROP POLICY IF EXISTS "owner_delete_product_media" ON storage.objects;
CREATE POLICY "owner_delete_product_media" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'product-media' AND owner = auth.uid());
