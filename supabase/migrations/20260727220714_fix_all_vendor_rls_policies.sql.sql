-- Fix all vendor RLS policies: drop has_role('vendor') checks.
-- has_role() reads from app metadata, but signup puts role in user metadata,
-- so has_role('vendor') is always false for vendors — blocking every query.
-- The ownership subquery (vendor_id IN vendors WHERE user_id = auth.uid()) is sufficient.

-- ============ products ============
DROP POLICY IF EXISTS vendor_select_own_products ON public.products;
CREATE POLICY vendor_select_own_products ON public.products FOR SELECT
  TO authenticated USING (vendor_id IN (SELECT id FROM public.vendors WHERE user_id = auth.uid()) AND deleted_at IS NULL);

DROP POLICY IF EXISTS vendor_insert_own_products ON public.products;
CREATE POLICY vendor_insert_own_products ON public.products FOR INSERT
  TO authenticated WITH CHECK (vendor_id IN (SELECT id FROM public.vendors WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS vendor_update_own_products ON public.products;
CREATE POLICY vendor_update_own_products ON public.products FOR UPDATE
  TO authenticated USING (vendor_id IN (SELECT id FROM public.vendors WHERE user_id = auth.uid()))
  WITH CHECK (vendor_id IN (SELECT id FROM public.vendors WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS vendor_delete_own_products ON public.products;
CREATE POLICY vendor_delete_own_products ON public.products FOR DELETE
  TO authenticated USING (vendor_id IN (SELECT id FROM public.vendors WHERE user_id = auth.uid()));

-- ============ orders ============
DROP POLICY IF EXISTS vendor_select_own_orders ON public.orders;
CREATE POLICY vendor_select_own_orders ON public.orders FOR SELECT
  TO authenticated USING (vendor_id IN (SELECT id FROM public.vendors WHERE user_id = auth.uid()) AND deleted_at IS NULL);

DROP POLICY IF EXISTS vendor_update_own_orders ON public.orders;
CREATE POLICY vendor_update_own_orders ON public.orders FOR UPDATE
  TO authenticated USING (vendor_id IN (SELECT id FROM public.vendors WHERE user_id = auth.uid()))
  WITH CHECK (vendor_id IN (SELECT id FROM public.vendors WHERE user_id = auth.uid()));

-- ============ withdrawals ============
DROP POLICY IF EXISTS vendor_select_own_withdrawals ON public.withdrawals;
CREATE POLICY vendor_select_own_withdrawals ON public.withdrawals FOR SELECT
  TO authenticated USING (vendor_id IN (SELECT id FROM public.vendors WHERE user_id = auth.uid()) AND deleted_at IS NULL);

DROP POLICY IF EXISTS vendor_insert_own_withdrawals ON public.withdrawals;
CREATE POLICY vendor_insert_own_withdrawals ON public.withdrawals FOR INSERT
  TO authenticated WITH CHECK (vendor_id IN (SELECT id FROM public.vendors WHERE user_id = auth.uid()));

-- ============ messages: vendor needs to read messages where they are recipient ============
-- Existing policy uses sender_id/receiver_id = auth.uid() which is correct (no has_role).
-- But app uses recipient_id column; ensure vendor can SELECT via recipient_id too.
-- The existing participant_select_messages policy already covers receiver_id = auth.uid(),
-- which works. No change needed for messages.

-- ============ notifications: user_manage_own_notifications uses auth.uid() = user_id, no has_role. OK.
