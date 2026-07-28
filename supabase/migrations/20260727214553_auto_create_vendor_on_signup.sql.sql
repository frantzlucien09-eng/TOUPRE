-- Auto-create a vendors row when a new vendor signs up.
-- The original trigger only created a profiles row, so vendors had no
-- vendors record and the app could never load their profile.

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
    VALUES (NEW.id, 'Vandè TOUPRE', NEW.email, 'active')
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;

-- Backfill vendors rows for existing vendor users who don't have one
INSERT INTO vendors (user_id, business_name, email, status)
SELECT p.user_id, 'Vandè TOUPRE', p.email, 'active'
FROM profiles p
WHERE p.role = 'vendor'
  AND NOT EXISTS (SELECT 1 FROM vendors v WHERE v.user_id = p.user_id)
ON CONFLICT DO NOTHING;
