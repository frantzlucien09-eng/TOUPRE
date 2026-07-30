/*
  Classified listing rules alignment

  - Seed configurable listing fee / duration settings
  - ad_payments.waived for admin fee waiver
  - Never delete expired listings (app-enforced); columns already keep history
*/

ALTER TABLE public.ad_payments
  ADD COLUMN IF NOT EXISTS waived boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS verified_by uuid;

-- Ensure settings table exists for admin-configurable values
CREATE TABLE IF NOT EXISTS public.settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE,
  name text,
  value text,
  label text,
  description text,
  enabled boolean,
  is_active boolean,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_settings" ON public.settings;
CREATE POLICY "public_read_settings" ON public.settings
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "admin_insert_settings" ON public.settings;
CREATE POLICY "admin_insert_settings" ON public.settings
  FOR INSERT TO authenticated WITH CHECK (public.has_role('admin'));

DROP POLICY IF EXISTS "admin_update_settings" ON public.settings;
CREATE POLICY "admin_update_settings" ON public.settings
  FOR UPDATE TO authenticated
  USING (public.has_role('admin')) WITH CHECK (public.has_role('admin'));

DROP POLICY IF EXISTS "admin_delete_settings" ON public.settings;
CREATE POLICY "admin_delete_settings" ON public.settings
  FOR DELETE TO authenticated USING (public.has_role('admin'));

INSERT INTO public.settings (key, value, label, description, updated_at)
VALUES
  ('house_listing_fee', '2500', 'House Listing Fee (HTG)', 'Frè anons Kay', now()),
  ('vehicle_listing_fee', '2500', 'Vehicle Listing Fee (HTG)', 'Frè anons Machin', now()),
  ('listing_duration_days', '30', 'Listing Duration (days)', 'Dire anons Kay/Machin', now())
ON CONFLICT (key) DO NOTHING;
