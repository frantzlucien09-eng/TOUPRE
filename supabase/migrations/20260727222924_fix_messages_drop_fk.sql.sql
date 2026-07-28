-- Drop FK constraints on messages so both auth UIDs and vendor/customer row IDs work.
-- The vendor app uses vendor.id (row UUID) as sender_id/recipient_id, but the FK
-- references auth.users(id) which only contains auth UIDs.

ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_sender_id_fkey;
ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_receiver_id_fkey;

-- Also drop FK on recipient_id if it exists
DO $$
DECLARE
  c record;
BEGIN
  FOR c IN SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.messages'::regclass AND contype = 'f'
    AND conname LIKE '%recipient%'
  LOOP
    EXECUTE format('ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS %I', c.conname);
  END LOOP;
END $$;

-- Make sender_id and receiver_id nullable (they already are, but confirm)
-- No action needed - they're already nullable.

-- Ensure messages table is in realtime publication
ALTER TABLE public.messages REPLICA IDENTITY FULL;
