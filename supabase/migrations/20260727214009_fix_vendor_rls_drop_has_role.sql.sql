-- Fix vendor RLS: drop has_role('vendor') checks that read from app metadata.
-- The signup flow puts role in user metadata, which has_role() doesn't see,
-- so the policy blocks the vendor's own SELECT/UPDATE and the app never
-- loads the vendor profile (stuck on login page).
-- The user_id = auth.uid() check is sufficient for ownership.

DROP POLICY IF EXISTS vendor_select_own ON public.vendors;
CREATE POLICY vendor_select_own ON public.vendors FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() AND deleted_at IS NULL);

DROP POLICY IF EXISTS vendor_update_own ON public.vendors;
CREATE POLICY vendor_update_own ON public.vendors FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
