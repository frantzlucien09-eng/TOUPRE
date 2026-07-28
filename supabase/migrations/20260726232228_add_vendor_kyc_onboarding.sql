/*
# Vendor KYC (identity verification) onboarding

## Overview
Vendors must complete a strict KYC onboarding before they can use the app.
The vendor's profile is created with status 'pending_review' until an admin
approves the KYC submission. This reduces fraud and fake accounts.

## New table: `vendor_kyc`
Holds all 20 fields from the onboarding form (Sections A-F) plus review state.
One row per vendor (unique vendor_id).

## New storage bucket: `kyc-documents`
Stores ID front/back photos and selfie-with-ID photos. Private bucket —
only the owning vendor and admin (service role) can read.

## vendor.status changes
- 'pending_review' — vendor just signed up, KYC not yet submitted or under review
- 'active' — KYC approved, vendor can use the app
- 'suspended' — admin suspended the account

## Admin functions (service role / SECURITY DEFINER)
- approve_vendor_kyc(request_id) -> sets vendor.status='active', kyc status='approved'
- reject_vendor_kyc(request_id, reason) -> sets kyc status='rejected', keeps vendor
  as 'pending_review' so the vendor can re-submit
*/

CREATE TABLE IF NOT EXISTS vendor_kyc (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL UNIQUE REFERENCES vendors(id) ON DELETE CASCADE,

  -- Section A: Personal identity
  last_name text NOT NULL,
  first_names text NOT NULL,
  birth_date date NOT NULL,
  sex text NOT NULL CHECK (sex IN ('male','female','other')),
  id_number text NOT NULL,
  id_front_url text NOT NULL,
  id_back_url text NOT NULL,
  selfie_with_id_url text NOT NULL,

  -- Section B: Contact (phone/email come from auth + vendors table)
  department text,
  city text,
  address text,
  business_description text,

  -- Section C: Business info
  business_name text NOT NULL,
  business_category text,
  business_short_desc text,
  business_registration text,

  -- Section D: Referral
  referral_source text,
  referral_detail text,

  -- Section E: Payment
  moncash_phone text NOT NULL,
  moncash_name text NOT NULL,

  -- Section F: Consent
  consent_accepted boolean NOT NULL DEFAULT false,
  signature text,

  -- Review state
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','resubmit')),
  admin_name_match boolean,
  admin_selfie_match boolean,
  rejection_reason text,
  reviewer_note text,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz
);

ALTER TABLE vendor_kyc ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner_read_kyc" ON vendor_kyc;
CREATE POLICY "owner_read_kyc" ON vendor_kyc FOR SELECT
  TO authenticated USING (auth.uid() = vendor_id);

DROP POLICY IF EXISTS "owner_insert_kyc" ON vendor_kyc;
CREATE POLICY "owner_insert_kyc" ON vendor_kyc FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = vendor_id);

DROP POLICY IF EXISTS "owner_update_kyc" ON vendor_kyc;
CREATE POLICY "owner_update_kyc" ON vendor_kyc FOR UPDATE
  TO authenticated USING (auth.uid() = vendor_id) WITH CHECK (auth.uid() = vendor_id);

-- Storage bucket for KYC documents (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('kyc-documents', 'kyc-documents', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "kyc_upload_own" ON storage.objects;
CREATE POLICY "kyc_upload_own" ON storage.objects FOR INSERT
  TO authenticated WITH CHECK (bucket_id = 'kyc-documents');

DROP POLICY IF EXISTS "kyc_read_own" ON storage.objects;
CREATE POLICY "kyc_read_own" ON storage.objects FOR SELECT
  TO authenticated USING (bucket_id = 'kyc-documents');

-- Admin approval / rejection (SECURITY DEFINER — called with service role)
CREATE OR REPLACE FUNCTION approve_vendor_kyc(p_kyc_id uuid, p_note text DEFAULT NULL)
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
  IF NOT COALESCE(k.admin_name_match, false) THEN
    RETURN; -- cannot approve without name match confirmation
  END IF;
  UPDATE vendor_kyc
    SET status = 'approved', reviewed_at = now(), reviewer_note = p_note
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
END;
$$;

CREATE OR REPLACE FUNCTION reject_vendor_kyc(p_kyc_id uuid, p_reason text, p_resubmit boolean DEFAULT true)
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
END;
$$;
