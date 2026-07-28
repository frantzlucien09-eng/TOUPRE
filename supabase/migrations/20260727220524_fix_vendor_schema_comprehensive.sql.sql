-- Comprehensive schema fix: add all vendor columns and missing tables
-- that the app code expects but were never created.

-- ============ vendors: add missing columns ============
ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS balance numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS points integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS trust_score integer NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS orders_sent integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS joined_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS department text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS pickup_address text,
  ADD COLUMN IF NOT EXISTS moncash_phone text,
  ADD COLUMN IF NOT EXISTS moncash_name text;

-- joined_at should mirror created_at for existing rows
UPDATE public.vendors SET joined_at = created_at WHERE joined_at IS NULL OR joined_at = created_at;

-- ============ trust_history ============
CREATE TABLE IF NOT EXISTS public.trust_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  delta integer NOT NULL,
  reason text,
  new_score integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.trust_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "trust_history_select_own" ON public.trust_history FOR SELECT
  TO authenticated USING (vendor_id IN (SELECT id FROM public.vendors WHERE user_id = auth.uid()));
CREATE POLICY "trust_history_insert_own" ON public.trust_history FOR INSERT
  TO authenticated WITH CHECK (vendor_id IN (SELECT id FROM public.vendors WHERE user_id = auth.uid()));

-- ============ vendor_monthly_stats ============
CREATE TABLE IF NOT EXISTS public.vendor_monthly_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  year integer NOT NULL,
  month integer NOT NULL,
  orders_count integer NOT NULL DEFAULT 0,
  revenue numeric NOT NULL DEFAULT 0,
  zone_rank integer,
  national_rank integer,
  computed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (vendor_id, year, month)
);
ALTER TABLE public.vendor_monthly_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vms_select_own" ON public.vendor_monthly_stats FOR SELECT
  TO authenticated USING (vendor_id IN (SELECT id FROM public.vendors WHERE user_id = auth.uid()));
CREATE POLICY "vms_insert_own" ON public.vendor_monthly_stats FOR INSERT
  TO authenticated WITH CHECK (vendor_id IN (SELECT id FROM public.vendors WHERE user_id = auth.uid()));
CREATE POLICY "vms_update_own" ON public.vendor_monthly_stats FOR UPDATE
  TO authenticated USING (vendor_id IN (SELECT id FROM public.vendors WHERE user_id = auth.uid()));

-- ============ name_change_requests ============
CREATE TABLE IF NOT EXISTS public.name_change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  old_name text NOT NULL,
  requested_name text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  otp_code text NOT NULL,
  otp_verified boolean NOT NULL DEFAULT false,
  otp_expires_at timestamptz NOT NULL,
  rejection_reason text,
  reviewer_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz
);
ALTER TABLE public.name_change_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ncr_select_own" ON public.name_change_requests FOR SELECT
  TO authenticated USING (vendor_id IN (SELECT id FROM public.vendors WHERE user_id = auth.uid()));
CREATE POLICY "ncr_insert_own" ON public.name_change_requests FOR INSERT
  TO authenticated WITH CHECK (vendor_id IN (SELECT id FROM public.vendors WHERE user_id = auth.uid()));
CREATE POLICY "ncr_update_own" ON public.name_change_requests FOR UPDATE
  TO authenticated USING (vendor_id IN (SELECT id FROM public.vendors WHERE user_id = auth.uid()));

-- ============ avatar_review_requests ============
CREATE TABLE IF NOT EXISTS public.avatar_review_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  new_avatar_url text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz
);
ALTER TABLE public.avatar_review_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "arr_select_own" ON public.avatar_review_requests FOR SELECT
  TO authenticated USING (vendor_id IN (SELECT id FROM public.vendors WHERE user_id = auth.uid()));
CREATE POLICY "arr_insert_own" ON public.avatar_review_requests FOR INSERT
  TO authenticated WITH CHECK (vendor_id IN (SELECT id FROM public.vendors WHERE user_id = auth.uid()));
CREATE POLICY "arr_update_own" ON public.avatar_review_requests FOR UPDATE
  TO authenticated USING (vendor_id IN (SELECT id FROM public.vendors WHERE user_id = auth.uid()));

-- ============ zones (for SettingsPage) ============
CREATE TABLE IF NOT EXISTS public.zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department text NOT NULL,
  city text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.zones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "zones_read_all" ON public.zones FOR SELECT TO authenticated USING (true);

-- Seed common Haitian departments/cities if empty
INSERT INTO public.zones (department, city)
SELECT * FROM (VALUES
  ('Ouest', 'Port-au-Prince'),
  ('Ouest', 'Pétion-Ville'),
  ('Ouest', 'Delmas'),
  ('Ouest', 'Carrefour'),
  ('Ouest', 'Tabarre'),
  ('Artibonite', 'Gonaïves'),
  ('Artibonite', 'Saint-Marc'),
  ('Nord', 'Cap-Haïtien'),
  ('Nord', 'Acul-du-Nord'),
  ('Sud', 'Les Cayes'),
  ('Sud', 'Torbeck'),
  ('Sud-Est', 'Jacmel'),
  ('Nippes', 'Miragoâne'),
  ('Centre', 'Hinche'),
  ('Nord-Ouest', 'Port-de-Paix'),
  ('Nord-Est', 'Fort-Liberté'),
  ('Grand''Anse', 'Jérémie'),
  ('Sud', 'Camp-Perrin')
) AS t(department, city)
WHERE NOT EXISTS (SELECT 1 FROM public.zones LIMIT 1);

-- ============ verify_name_change_otp RPC ============
CREATE OR REPLACE FUNCTION public.verify_name_change_otp(p_request_id uuid, p_code text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  req public.name_change_requests;
BEGIN
  SELECT * INTO req FROM public.name_change_requests WHERE id = p_request_id;
  IF NOT FOUND THEN RETURN false; END IF;
  IF req.otp_verified THEN RETURN true; END IF;
  IF req.otp_code <> p_code THEN RETURN false; END IF;
  IF req.otp_expires_at < now() THEN RETURN false; END IF;
  UPDATE public.name_change_requests
    SET otp_verified = true, status = 'pending'
    WHERE id = p_request_id;
  RETURN true;
END;
$function$;
GRANT EXECUTE ON FUNCTION public.verify_name_change_otp TO authenticated;

-- ============ vendor_kyc (referenced by KycOnboardingPage) ============
CREATE TABLE IF NOT EXISTS public.vendor_kyc (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL UNIQUE REFERENCES public.vendors(id) ON DELETE CASCADE,
  last_name text NOT NULL DEFAULT '',
  first_names text NOT NULL DEFAULT '',
  birth_date text NOT NULL DEFAULT '',
  sex text NOT NULL DEFAULT 'other',
  id_number text NOT NULL DEFAULT '',
  id_front_url text NOT NULL DEFAULT '',
  id_back_url text NOT NULL DEFAULT '',
  selfie_with_id_url text NOT NULL DEFAULT '',
  department text,
  city text,
  address text,
  business_description text,
  business_name text NOT NULL DEFAULT '',
  business_category text,
  business_short_desc text,
  business_registration text,
  referral_source text,
  referral_detail text,
  moncash_phone text NOT NULL DEFAULT '',
  moncash_name text NOT NULL DEFAULT '',
  consent_accepted boolean NOT NULL DEFAULT false,
  signature text,
  status text NOT NULL DEFAULT 'pending',
  admin_name_match boolean,
  admin_selfie_match boolean,
  rejection_reason text,
  reviewer_note text,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz
);
ALTER TABLE public.vendor_kyc ENABLE ROW LEVEL SECURITY;
CREATE POLICY "kyc_select_own" ON public.vendor_kyc FOR SELECT
  TO authenticated USING (vendor_id IN (SELECT id FROM public.vendors WHERE user_id = auth.uid()));
CREATE POLICY "kyc_insert_own" ON public.vendor_kyc FOR INSERT
  TO authenticated WITH CHECK (vendor_id IN (SELECT id FROM public.vendors WHERE user_id = auth.uid()));
CREATE POLICY "kyc_update_own" ON public.vendor_kyc FOR UPDATE
  TO authenticated USING (vendor_id IN (SELECT id FROM public.vendors WHERE user_id = auth.uid()));

-- ============ social_platforms (FollowTouprePage) ============
CREATE TABLE IF NOT EXISTS public.social_platforms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  label text NOT NULL,
  url text NOT NULL,
  icon_key text NOT NULL DEFAULT 'globe',
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.social_platforms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "social_read_all" ON public.social_platforms FOR SELECT TO authenticated USING (active = true);
