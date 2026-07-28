-- Allow a vendor to insert their own row in `vendors` at signup.
-- The shared backend only had admin-insert; without this, vendor self-signup
-- can never create the vendor record that the app gates the dashboard on.
CREATE POLICY "insert_own_vendor"
  ON public.vendors FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
