/*
# Google OAuth Auto-Profile Creation

1. Purpose
   - When a user signs in via Google OAuth, there is no `signUp` call with
     `raw_user_meta_data.role`, so the existing trigger defaults the role to
     'customer' and only creates a `profiles` row — no `customers` row.
   - Without a `customers` row the user cannot place orders (orders reference
     `customers.id` which is `auth.users.id`).

2. Changes
   - Update `handle_new_user()` trigger function:
     - Create a `customers` row when role is 'customer' (covers Google sign-in).
     - Use Google-provided `full_name` from `raw_user_meta_data` or fallback
     to the user's email for `customers.full_name`.
     - Keep existing vendor logic unchanged.

3. Security
   - No RLS policy changes. Existing `owner_insert_customer` policy allows
     `auth.uid() = id` which the SECURITY DEFINER trigger satisfies.
*/

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_role text;
  v_full_name text;
BEGIN
  v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'customer');
  v_full_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    NEW.raw_user_meta_data->>'full_name',
    split_part(NEW.email, '@', 1)
  );

  INSERT INTO profiles (user_id, email, phone, full_name, role, email_verified, phone_verified)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'phone',
    v_full_name,
    v_role,
    COALESCE((NEW.raw_user_meta_data->>'email_verified')::boolean, NEW.email_confirmed_at IS NOT NULL),
    COALESCE((NEW.raw_user_meta_data->>'phone_verified')::boolean, false)
  )
  ON CONFLICT (user_id) DO NOTHING;

  IF v_role = 'vendor' THEN
    INSERT INTO vendors (user_id, business_name, email, status)
    VALUES (NEW.id, 'Vandè TOUPRE', NEW.email, 'pending')
    ON CONFLICT DO NOTHING;
  ELSIF v_role = 'customer' THEN
    INSERT INTO customers (id, full_name, phone, email)
    VALUES (NEW.id, v_full_name, NEW.raw_user_meta_data->>'phone', NEW.email)
    ON CONFLICT (id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;

-- Backfill: create customers rows for existing auth.users with role='customer' who don't have one
INSERT INTO customers (id, full_name, email)
SELECT p.user_id, COALESCE(p.full_name, split_part(p.email, '@', 1)), p.email
FROM profiles p
WHERE p.role = 'customer'
  AND NOT EXISTS (SELECT 1 FROM customers c WHERE c.id = p.user_id)
ON CONFLICT (id) DO NOTHING;
