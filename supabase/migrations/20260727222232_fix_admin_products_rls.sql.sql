-- Fix admin RLS policy on products: has_role('admin') doesn't work because
-- admin role is stored in admin_profiles table, not in JWT app_metadata.
-- Replace with an existence check against admin_profiles.

DROP POLICY IF EXISTS admin_manage_products ON public.products;
CREATE POLICY admin_manage_products ON public.products FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.admin_profiles
            WHERE id = auth.uid() AND is_active = true AND deleted_at IS NULL)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.admin_profiles
            WHERE id = auth.uid() AND is_active = true AND deleted_at IS NULL)
  );
