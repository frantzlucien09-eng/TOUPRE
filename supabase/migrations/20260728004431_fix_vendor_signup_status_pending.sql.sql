-- Fix: new vendors must start as 'pending' so they go through KYC onboarding.
-- The trigger was creating them as 'active', which skipped KYC entirely.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_role text;
BEGIN
  v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'customer');

  INSERT INTO profiles (user_id, email, phone, full_name, role, email_verified, phone_verified)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'phone',
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    v_role,
    COALESCE((NEW.raw_user_meta_data->>'email_verified')::boolean, false),
    COALESCE((NEW.raw_user_meta_data->>'phone_verified')::boolean, false)
  )
  ON CONFLICT (user_id) DO NOTHING;

  IF v_role = 'vendor' THEN
    INSERT INTO vendors (user_id, business_name, email, status)
    VALUES (NEW.id, 'Vandè TOUPRE', NEW.email, 'pending')
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;

-- Backfill: set any 'active' vendors with no KYC to 'pending' so they complete onboarding
UPDATE vendors v
SET status = 'pending', updated_at = now()
WHERE v.status = 'active'
  AND NOT EXISTS (
    SELECT 1 FROM vendor_kyc k WHERE k.vendor_id = v.id AND k.status = 'approved'
  );
