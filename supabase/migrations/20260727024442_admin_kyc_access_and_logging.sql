/*
# Admin access to vendor_kyc + activity logging in KYC functions

1. Purpose
- Allow admin-role users to READ vendor_kyc rows so they can review
  identity submissions (name, ID, selfie-with-ID).
- Keep vendor self-access intact (owner can read/update their own KYC).
- Log every KYC approval and rejection to activity_log so the admin
  dashboard's real-time feed shows these actions.

2. RLS changes
- vendor_kyc: add a SELECT policy for admin-role users (via is_admin()).
  Existing owner policies remain unchanged. No new INSERT/UPDATE policy
  for admins — approve/reject still go through the SECURITY DEFINER
  functions (which run with elevated privileges and bypass RLS).

3. Function changes
- approve_vendor_kyc: now accepts p_reviewer_id (the admin's auth uid)
  and inserts an activity_log row ('kyc.approved'). Also sets
  admin_name_match / admin_selfie_match if provided.
- reject_vendor_kyc: now accepts p_reviewer_id and inserts an
  activity_log row ('kyc.rejected').
- Both functions remain idempotent and safe to re-run.

4. Notes
- is_admin() was created in the previous migration and is reused here.
- No data is lost; only policies and function bodies change.
*/

-- Admin SELECT policy on vendor_kyc
DROP POLICY IF EXISTS "admin_read_kyc" ON vendor_kyc;
CREATE POLICY "admin_read_kyc"
ON vendor_kyc FOR SELECT
TO authenticated USING (is_admin());

-- Replace approve function to add reviewer + activity logging
CREATE OR REPLACE FUNCTION approve_vendor_kyc(
  p_kyc_id uuid,
  p_reviewer_id uuid DEFAULT NULL,
  p_name_match boolean DEFAULT NULL,
  p_selfie_match boolean DEFAULT NULL,
  p_note text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  k vendor_kyc%ROWTYPE;
BEGIN
  SELECT * INTO k FROM vendor_kyc WHERE id = p_kyc_id;
  IF k.id IS NULL OR k.status NOT IN ('pending','resubmit') THEN
    RETURN;
  END IF;
  IF NOT COALESCE(k.admin_name_match, false) AND COALESCE(p_name_match, false) = false THEN
    RETURN; -- cannot approve without name match confirmation
  END IF;
  UPDATE vendor_kyc
    SET status = 'approved',
        reviewed_at = now(),
        reviewer_note = p_note,
        admin_name_match = COALESCE(p_name_match, admin_name_match),
        admin_selfie_match = COALESCE(p_selfie_match, admin_selfie_match)
    WHERE id = p_kyc_id;
  UPDATE vendors
    SET status = 'active', updated_at = now(),
        business_name = k.business_name,
        department = k.department,
        city = k.city,
        address = k.address,
        description = k.business_description,
        moncash_phone = k.moncash_phone,
        moncash_name = k.moncash_name
    WHERE id = k.vendor_id;
  INSERT INTO notifications (user_id, type, title, body)
    VALUES (k.vendor_id, 'kyc', 'Ensripsyon ou apwouve',
      'Dosye enskripsyon vandè ou a apwouve pa Admin. Ou ka kòmanse itilize app la kounye a.');
  INSERT INTO activity_log (actor_id, actor_type, actor_name, action, entity_type, entity_id, metadata)
    VALUES (
      p_reviewer_id,
      'admin',
      (SELECT email FROM admin_profiles WHERE id = p_reviewer_id),
      'kyc.approved',
      'vendor_kyc',
      k.id,
      jsonb_build_object('vendor_id', k.vendor_id, 'business_name', k.business_name)
    );
END;
$$;

-- Replace reject function to add reviewer + activity logging
CREATE OR REPLACE FUNCTION reject_vendor_kyc(
  p_kyc_id uuid,
  p_reason text,
  p_resubmit boolean DEFAULT true,
  p_reviewer_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  k vendor_kyc%ROWTYPE;
BEGIN
  SELECT * INTO k FROM vendor_kyc WHERE id = p_kyc_id;
  IF k.id IS NULL THEN
    RETURN;
  END IF;
  UPDATE vendor_kyc
    SET status = CASE WHEN p_resubmit THEN 'resubmit' ELSE 'rejected' END,
        reviewed_at = now(),
        rejection_reason = p_reason
    WHERE id = p_kyc_id;
  INSERT INTO notifications (user_id, type, title, body)
    VALUES (k.vendor_id, 'kyc', 'Ensripsyon ou rejte',
      coalesce('Admin rejte dosye enskripsyon ou.' || CASE WHEN p_reason IS NULL THEN '' ELSE ' Rezon: ' || p_reason END,
               'Admin rejte dosye enskripsyon ou.'));
  INSERT INTO activity_log (actor_id, actor_type, actor_name, action, entity_type, entity_id, metadata)
    VALUES (
      p_reviewer_id,
      'admin',
      (SELECT email FROM admin_profiles WHERE id = p_reviewer_id),
      'kyc.rejected',
      'vendor_kyc',
      k.id,
      jsonb_build_object('vendor_id', k.vendor_id, 'reason', p_reason, 'resubmit', p_resubmit)
    );
END;
$$;
