-- Fix messaging: align columns, RLS, and triggers so customer→vendor messages work.

-- 1. Make conversation_id nullable (vendor app doesn't create conversations)
ALTER TABLE public.messages ALTER COLUMN conversation_id DROP NOT NULL;

-- 2. Backfill recipient_id from receiver_id and vice versa (so both apps can read)
UPDATE public.messages SET recipient_id = receiver_id WHERE recipient_id IS NULL AND receiver_id IS NOT NULL;
UPDATE public.messages SET receiver_id = recipient_id WHERE receiver_id IS NULL AND recipient_id IS NOT NULL;

-- 3. Add trigger to keep recipient_id and receiver_id in sync on insert/update
CREATE OR REPLACE FUNCTION public.sync_message_recipient()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  -- Keep both columns in sync: if one is set, copy to the other
  IF NEW.recipient_id IS NULL AND NEW.receiver_id IS NOT NULL THEN
    NEW.recipient_id := NEW.receiver_id;
  ELSIF NEW.receiver_id IS NULL AND NEW.recipient_id IS NOT NULL THEN
    NEW.receiver_id := NEW.recipient_id;
  END IF;
  -- Keep read and read_at in sync
  IF NEW.read = true AND NEW.read_at IS NULL THEN
    NEW.read_at := COALESCE(NEW.updated_at, now());
  ELSIF NEW.read_at IS NOT NULL THEN
    NEW.read := true;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_sync_message_recipient ON public.messages;
CREATE TRIGGER trg_sync_message_recipient
  BEFORE INSERT OR UPDATE ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.sync_message_recipient();

-- 4. Fix RLS policies on messages
-- Drop old policies
DROP POLICY IF EXISTS participant_select_messages ON public.messages;
DROP POLICY IF EXISTS receiver_update_messages ON public.messages;
DROP POLICY IF EXISTS user_insert_messages ON public.messages;
DROP POLICY IF EXISTS admin_manage_messages ON public.messages;

-- SELECT: allow sender, receiver, or vendor (via vendor row ID subquery)
CREATE POLICY msg_select_own ON public.messages FOR SELECT
  TO authenticated USING (
    sender_id = auth.uid()
    OR receiver_id = auth.uid()
    OR recipient_id = auth.uid()
    OR sender_id IN (SELECT id FROM public.vendors WHERE user_id = auth.uid())
    OR receiver_id IN (SELECT id FROM public.vendors WHERE user_id = auth.uid())
    OR recipient_id IN (SELECT id FROM public.vendors WHERE user_id = auth.uid())
  );

-- INSERT: allow sender = auth.uid() OR sender = vendor row ID
CREATE POLICY msg_insert_own ON public.messages FOR INSERT
  TO authenticated WITH CHECK (
    sender_id = auth.uid()
    OR sender_id IN (SELECT id FROM public.vendors WHERE user_id = auth.uid())
  );

-- UPDATE: allow receiver = auth.uid() OR receiver = vendor row ID (for marking read)
CREATE POLICY msg_update_own ON public.messages FOR UPDATE
  TO authenticated USING (
    receiver_id = auth.uid()
    OR recipient_id = auth.uid()
    OR receiver_id IN (SELECT id FROM public.vendors WHERE user_id = auth.uid())
    OR recipient_id IN (SELECT id FROM public.vendors WHERE user_id = auth.uid())
  )
  WITH CHECK (
    receiver_id = auth.uid()
    OR recipient_id = auth.uid()
    OR receiver_id IN (SELECT id FROM public.vendors WHERE user_id = auth.uid())
    OR recipient_id IN (SELECT id FROM public.vendors WHERE user_id = auth.uid())
  );

-- Admin: check admin_profiles instead of has_role
CREATE POLICY msg_admin_manage ON public.messages FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_profiles WHERE user_id = auth.uid() AND is_active = true AND deleted_at IS NULL))
  WITH CHECK (EXISTS (SELECT 1 FROM public.admin_profiles WHERE user_id = auth.uid() AND is_active = true AND deleted_at IS NULL));

-- 5. Fix conversations RLS (admin policy uses has_role)
DROP POLICY IF EXISTS admin_manage_conversations ON public.conversations;
CREATE POLICY conv_admin_manage ON public.conversations FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_profiles WHERE user_id = auth.uid() AND is_active = true AND deleted_at IS NULL))
  WITH CHECK (EXISTS (SELECT 1 FROM public.admin_profiles WHERE user_id = auth.uid() AND is_active = true AND deleted_at IS NULL));

-- 6. Add columns to conversations for vendor/customer ID mapping
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS customer_id uuid,
  ADD COLUMN IF NOT EXISTS vendor_id uuid,
  ADD COLUMN IF NOT EXISTS store_id uuid;

-- Backfill customer_id and vendor_id from participant IDs
UPDATE public.conversations
  SET customer_id = participant_1_id, vendor_id = participant_2_id
  WHERE customer_id IS NULL AND participant_1_id IS NOT NULL;
