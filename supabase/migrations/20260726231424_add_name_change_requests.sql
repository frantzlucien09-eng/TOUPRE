/*
# Name change request workflow

## Overview
Vendors cannot change their business_name freely. Changes require:
1) OTP verification (sent to the vendor's verified phone) to confirm identity
2) Admin approval (quality/security control)

The vendor's current name stays active until the request is approved.

## New table: `name_change_requests`
- `id` (uuid PK)
- `vendor_id` (uuid FK -> vendors)
- `old_name` (text) — name at time of request
- `requested_name` (text) — desired new name
- `status` (text) — 'pending' | 'approved' | 'rejected' (default 'pending')
- `otp_code` (text) — 6-digit code sent to vendor phone
- `otp_verified` (boolean, default false) — true once vendor enters correct OTP
- `otp_expires_at` (timestamptz) — OTP validity window (10 min)
- `rejection_reason` (text, nullable) — reason if rejected by admin
- `created_at` (timestamptz)
- `reviewed_at` (timestamptz, nullable) — when admin approved/rejected
- `reviewer_note` (text, nullable) — admin note

## Security
- RLS enabled. Vendors can SELECT/INSERT their own rows.
- UPDATE restricted to service role (admin) for approval/rejection —
  except the vendor may flip `otp_verified` to true via a security-definer function.
*/

CREATE TABLE IF NOT EXISTS name_change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  old_name text NOT NULL,
  requested_name text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  otp_code text NOT NULL,
  otp_verified boolean NOT NULL DEFAULT false,
  otp_expires_at timestamptz NOT NULL,
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewer_note text
);

ALTER TABLE name_change_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_name_requests" ON name_change_requests;
CREATE POLICY "select_own_name_requests" ON name_change_requests FOR SELECT
  TO authenticated USING (auth.uid() = vendor_id);

DROP POLICY IF EXISTS "insert_own_name_requests" ON name_change_requests;
CREATE POLICY "insert_own_name_requests" ON name_change_requests FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = vendor_id);

-- Vendors cannot UPDATE rows directly; admin uses service role.
-- A security-definer function lets the vendor verify their own OTP without
-- gaining general UPDATE access on the table.
CREATE OR REPLACE FUNCTION verify_name_change_otp(p_request_id uuid, p_code text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  req name_change_requests%ROWTYPE;
BEGIN
  SELECT * INTO req FROM name_change_requests WHERE id = p_request_id;
  IF req.id IS NULL THEN
    RETURN false;
  END IF;
  IF req.vendor_id <> auth.uid() THEN
    RETURN false;
  END IF;
  IF req.otp_verified THEN
    RETURN true;
  END IF;
  IF req.otp_code = p_code AND req.otp_expires_at > now() THEN
    UPDATE name_change_requests SET otp_verified = true WHERE id = p_request_id;
    RETURN true;
  END IF;
  RETURN false;
END;
$$;

-- Admin approval applies the name change to vendors.business_name
CREATE OR REPLACE FUNCTION approve_name_change(p_request_id uuid, p_note text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  req name_change_requests%ROWTYPE;
BEGIN
  SELECT * INTO req FROM name_change_requests WHERE id = p_request_id;
  IF req.id IS NULL OR req.status <> 'pending' OR NOT req.otp_verified THEN
    RETURN;
  END IF;
  UPDATE vendors
    SET business_name = req.requested_name, updated_at = now()
    WHERE id = req.vendor_id;
  UPDATE name_change_requests
    SET status = 'approved', reviewed_at = now(), reviewer_note = p_note
    WHERE id = p_request_id;
  INSERT INTO notifications (user_id, type, title, body)
    VALUES (req.vendor_id, 'name_change', 'Non ou chanje',
      coalesce('Admin apwove demand chanjman non ou. Nouvo non ou: ' || req.requested_name, 'Demand chanjman non ou apwouve.'));
END;
$$;

CREATE OR REPLACE FUNCTION reject_name_change(p_request_id uuid, p_reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  req name_change_requests%ROWTYPE;
BEGIN
  SELECT * INTO req FROM name_change_requests WHERE id = p_request_id;
  IF req.id IS NULL OR req.status <> 'pending' THEN
    RETURN;
  END IF;
  UPDATE name_change_requests
    SET status = 'rejected', reviewed_at = now(), rejection_reason = p_reason
    WHERE id = p_request_id;
  INSERT INTO notifications (user_id, type, title, body)
    VALUES (req.vendor_id, 'name_change', 'Demann chanjman non rejte',
      coalesce('Admin rejte demand chanjman non ou.' || CASE WHEN p_reason IS NULL THEN '' ELSE ' Rezon: ' || p_reason END,
               'Demand chanjman non ou rejte.'));
END;
$$;
