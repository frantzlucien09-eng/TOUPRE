/*
# Admin write access for social_platforms

Apps read from social_platforms; admin dashboard needs INSERT/UPDATE/DELETE.
Uses the same admin_profiles ownership check already used for products/messages.
*/

DROP POLICY IF EXISTS "admin_select_social_platforms" ON public.social_platforms;
DROP POLICY IF EXISTS "admin_insert_social_platforms" ON public.social_platforms;
DROP POLICY IF EXISTS "admin_update_social_platforms" ON public.social_platforms;
DROP POLICY IF EXISTS "admin_delete_social_platforms" ON public.social_platforms;

CREATE POLICY "admin_select_social_platforms" ON public.social_platforms
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_profiles
      WHERE (user_id = auth.uid() OR id = auth.uid())
        AND COALESCE(is_active, true) = true
        AND deleted_at IS NULL
    )
  );

CREATE POLICY "admin_insert_social_platforms" ON public.social_platforms
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.admin_profiles
      WHERE (user_id = auth.uid() OR id = auth.uid())
        AND COALESCE(is_active, true) = true
        AND deleted_at IS NULL
    )
  );

CREATE POLICY "admin_update_social_platforms" ON public.social_platforms
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_profiles
      WHERE (user_id = auth.uid() OR id = auth.uid())
        AND COALESCE(is_active, true) = true
        AND deleted_at IS NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.admin_profiles
      WHERE (user_id = auth.uid() OR id = auth.uid())
        AND COALESCE(is_active, true) = true
        AND deleted_at IS NULL
    )
  );

CREATE POLICY "admin_delete_social_platforms" ON public.social_platforms
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_profiles
      WHERE (user_id = auth.uid() OR id = auth.uid())
        AND COALESCE(is_active, true) = true
        AND deleted_at IS NULL
    )
  );
