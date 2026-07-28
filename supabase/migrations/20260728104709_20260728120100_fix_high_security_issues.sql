/*
# Fix High Security Issues — Phase 2

## Summary
Resolves High-severity issues from the security audit:

1. **Storage policies without ownership checks (6 High + 2 Medium)**:
   Storage policies for avatars, delivery-proofs, kyc-documents, and product-media
   buckets allowed any authenticated user to INSERT/UPDATE/DELETE any file in any
   bucket. Added ownership checks using auth.uid() matched against the file path
   prefix (e.g., `{user_id}/` or `{vendor_id}/`).

2. **Duplicate function grants (2 Performance/Low)**:
   get_vendor_dashboard and log_automation_error had duplicate EXECUTE grants
   (4x and 9x per role respectively). Cleaned up by revoking all and re-granting
   once.

## Security Changes
- Drop and recreate storage INSERT/UPDATE/DELETE policies with ownership checks
- Revoke all EXECUTE grants on get_vendor_dashboard and log_automation_error,
  then re-grant cleanly

## Important Notes
1. Storage ownership is enforced by matching the file path prefix to auth.uid().
   Avatars use `{user_id}/...` paths. Product-media, kyc-documents, and
   delivery-proofs use `{vendor_id}/...` paths. The policies check that the
   first path segment equals auth.uid() or the vendor's user_id.
2. For vendor-scoped buckets (product-media, kyc-documents, delivery-proofs),
   ownership is verified by checking that a vendor record exists where
   vendors.user_id = auth.uid() AND the file path starts with that vendor's id.
   This is done via a EXISTS subquery.
3. SELECT policies for public buckets (avatars, product-media) remain public
   read — these are product images and avatars that need to be visible to all
   users. kyc-documents and delivery-proofs SELECT is restricted to
   authenticated only (already done in Phase 1 by setting bucket public=false).
*/

-- ============================================================
-- 1. STORAGE POLICIES WITH OWNERSHIP CHECKS
-- ============================================================

-- ---- AVATARS bucket ----
-- Public read (avatars are visible to everyone)
DROP POLICY IF EXISTS "avatars_public_read" ON storage.objects;
CREATE POLICY "avatars_public_read"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'avatars');

-- Authenticated insert with ownership check (path must start with user_id)
DROP POLICY IF EXISTS "avatars_authed_insert" ON storage.objects;
CREATE POLICY "avatars_authed_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Authenticated update with ownership check
DROP POLICY IF EXISTS "avatars_authed_update" ON storage.objects;
CREATE POLICY "avatars_authed_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Authenticated delete with ownership check
DROP POLICY IF EXISTS "avatars_authed_delete" ON storage.objects;
CREATE POLICY "avatars_authed_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ---- PRODUCT-MEDIA bucket ----
-- Public read (product images visible to everyone)
DROP POLICY IF EXISTS "product_media_public_read" ON storage.objects;
CREATE POLICY "product_media_public_read"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'product-media');

-- Authenticated insert with vendor ownership check
DROP POLICY IF EXISTS "product_media_authed_insert" ON storage.objects;
CREATE POLICY "product_media_authed_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'product-media'
    AND EXISTS (
      SELECT 1 FROM public.vendors v
      WHERE v.user_id = auth.uid()
        AND v.deleted_at IS NULL
        AND (storage.foldername(name))[1] = v.id::text
    )
  );

-- Authenticated update with vendor ownership check
DROP POLICY IF EXISTS "product_media_authed_update" ON storage.objects;
CREATE POLICY "product_media_authed_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'product-media'
    AND EXISTS (
      SELECT 1 FROM public.vendors v
      WHERE v.user_id = auth.uid()
        AND v.deleted_at IS NULL
        AND (storage.foldername(name))[1] = v.id::text
    )
  )
  WITH CHECK (
    bucket_id = 'product-media'
    AND EXISTS (
      SELECT 1 FROM public.vendors v
      WHERE v.user_id = auth.uid()
        AND v.deleted_at IS NULL
        AND (storage.foldername(name))[1] = v.id::text
    )
  );

-- Authenticated delete with vendor ownership check
DROP POLICY IF EXISTS "product_media_authed_delete" ON storage.objects;
CREATE POLICY "product_media_authed_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'product-media'
    AND EXISTS (
      SELECT 1 FROM public.vendors v
      WHERE v.user_id = auth.uid()
        AND v.deleted_at IS NULL
        AND (storage.foldername(name))[1] = v.id::text
    )
  );

-- ---- KYC-DOCUMENTS bucket ----
-- Authenticated read with vendor ownership check
DROP POLICY IF EXISTS "kyc_docs_authed_read" ON storage.objects;
CREATE POLICY "kyc_docs_authed_read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'kyc-documents'
    AND EXISTS (
      SELECT 1 FROM public.vendors v
      WHERE v.user_id = auth.uid()
        AND v.deleted_at IS NULL
        AND (storage.foldername(name))[1] = v.id::text
    )
  );

-- Allow admins to read all KYC documents
DROP POLICY IF EXISTS "kyc_docs_admin_read" ON storage.objects;
CREATE POLICY "kyc_docs_admin_read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'kyc-documents'
    AND public.has_role('admin')
  );

-- Authenticated insert with vendor ownership check
DROP POLICY IF EXISTS "kyc_docs_authed_insert" ON storage.objects;
CREATE POLICY "kyc_docs_authed_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'kyc-documents'
    AND EXISTS (
      SELECT 1 FROM public.vendors v
      WHERE v.user_id = auth.uid()
        AND v.deleted_at IS NULL
        AND (storage.foldername(name))[1] = v.id::text
    )
  );

-- Authenticated update with vendor ownership check
DROP POLICY IF EXISTS "kyc_docs_authed_update" ON storage.objects;
CREATE POLICY "kyc_docs_authed_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'kyc-documents'
    AND EXISTS (
      SELECT 1 FROM public.vendors v
      WHERE v.user_id = auth.uid()
        AND v.deleted_at IS NULL
        AND (storage.foldername(name))[1] = v.id::text
    )
  )
  WITH CHECK (
    bucket_id = 'kyc-documents'
    AND EXISTS (
      SELECT 1 FROM public.vendors v
      WHERE v.user_id = auth.uid()
        AND v.deleted_at IS NULL
        AND (storage.foldername(name))[1] = v.id::text
    )
  );

-- Authenticated delete with vendor ownership check
DROP POLICY IF EXISTS "kyc_docs_authed_delete" ON storage.objects;
CREATE POLICY "kyc_docs_authed_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'kyc-documents'
    AND EXISTS (
      SELECT 1 FROM public.vendors v
      WHERE v.user_id = auth.uid()
        AND v.deleted_at IS NULL
        AND (storage.foldername(name))[1] = v.id::text
    )
  );

-- ---- DELIVERY-PROOFS bucket ----
-- Authenticated read with vendor ownership check
DROP POLICY IF EXISTS "delivery_proofs_authed_read" ON storage.objects;
CREATE POLICY "delivery_proofs_authed_read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'delivery-proofs'
    AND EXISTS (
      SELECT 1 FROM public.vendors v
      WHERE v.user_id = auth.uid()
        AND v.deleted_at IS NULL
        AND (storage.foldername(name))[1] = v.id::text
    )
  );

-- Allow admins to read all delivery proofs
DROP POLICY IF EXISTS "delivery_proofs_admin_read" ON storage.objects;
CREATE POLICY "delivery_proofs_admin_read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'delivery-proofs'
    AND public.has_role('admin')
  );

-- Authenticated insert with vendor ownership check
DROP POLICY IF EXISTS "authed_upload_delivery_proofs_fix" ON storage.objects;
DROP POLICY IF EXISTS "delivery_proofs_authed_insert" ON storage.objects;
CREATE POLICY "delivery_proofs_authed_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'delivery-proofs'
    AND EXISTS (
      SELECT 1 FROM public.vendors v
      WHERE v.user_id = auth.uid()
        AND v.deleted_at IS NULL
        AND (storage.foldername(name))[1] = v.id::text
    )
  );

-- ============================================================
-- 2. CLEAN UP DUPLICATE FUNCTION GRANTS
-- ============================================================

-- get_vendor_dashboard: revoke all and re-grant once
REVOKE EXECUTE ON FUNCTION public.get_vendor_dashboard(uuid) FROM anon, authenticated, PUBLIC, postgres, service_role;
REVOKE EXECUTE ON FUNCTION public.get_vendor_dashboard(uuid, timestamp with time zone) FROM anon, authenticated, PUBLIC, postgres, service_role;
GRANT EXECUTE ON FUNCTION public.get_vendor_dashboard(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_vendor_dashboard(uuid, timestamp with time zone) TO authenticated;

-- log_automation_error: revoke all and re-grant once (trigger-only: postgres + service_role)
REVOKE EXECUTE ON FUNCTION public.log_automation_error(text, text, text) FROM anon, authenticated, PUBLIC, postgres, service_role;
REVOKE EXECUTE ON FUNCTION public.log_automation_error(text, text, uuid) FROM anon, authenticated, PUBLIC, postgres, service_role;
REVOKE EXECUTE ON FUNCTION public.log_automation_error(text, text, text, text, text, jsonb) FROM anon, authenticated, PUBLIC, postgres, service_role;
GRANT EXECUTE ON FUNCTION public.log_automation_error(text, text, text) TO postgres, service_role;
GRANT EXECUTE ON FUNCTION public.log_automation_error(text, text, uuid) TO postgres, service_role;
GRANT EXECUTE ON FUNCTION public.log_automation_error(text, text, text, text, text, jsonb) TO postgres, service_role;
