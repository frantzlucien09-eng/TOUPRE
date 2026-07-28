-- Add missing columns to messages table that the vendor app uses
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS product_id uuid,
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS order_id uuid;

-- Add index for faster queries by recipient/sender
CREATE INDEX IF NOT EXISTS idx_messages_recipient_id ON public.messages (recipient_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON public.messages (sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver_id ON public.messages (receiver_id);

-- Ensure messages is in realtime publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;
END $$;
