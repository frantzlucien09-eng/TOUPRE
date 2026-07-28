-- Fix admin products RLS: admin_profiles.id is NOT the auth uid; user_id is.
-- Also fix admin_profiles RLS policies that use has_role('admin').
DROP POLICY IF EXISTS admin_manage_products ON public.products;
CREATE POLICY admin_manage_products ON public.products FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.admin_profiles
            WHERE user_id = auth.uid() AND is_active = true AND deleted_at IS NULL)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.admin_profiles
            WHERE user_id = auth.uid() AND is_active = true AND deleted_at IS NULL)
  );

-- Fix admin_profiles own RLS so admins can read their own profile
DROP POLICY IF EXISTS admin_manage_admin_profiles ON public.admin_profiles;
CREATE POLICY admin_manage_admin_profiles ON public.admin_profiles FOR ALL
  TO authenticated
  USING (user_id = auth.uid() AND deleted_at IS NULL)
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS admin_select_own_profile ON public.admin_profiles;
CREATE POLICY admin_select_own_profile ON public.admin_profiles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() AND deleted_at IS NULL);

DROP POLICY IF EXISTS admin_update_own_profile ON public.admin_profiles;
CREATE POLICY admin_update_own_profile ON public.admin_profiles FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
