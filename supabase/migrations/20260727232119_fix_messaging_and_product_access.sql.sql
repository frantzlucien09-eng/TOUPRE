/*
# Fix Messaging Flow + Product Data Access

## Problem 1: Messages not sent
The messages table has BOTH `receiver_id` and `recipient_id` columns, causing confusion.
The customer app likely uses `receiver_id` while the vendor app reads `recipient_id`.
RLS INSERT policy requires `sender_id = auth.uid()` which fails for unauthenticated customers.
There are 0 messages in the table — inserts are silently failing.

## Problem 2: Product detail missing data
The customer app needs to read all product fields. The `product-media` bucket is public
but the customer app might not be querying all columns.

## Fixes
1. Create `send_message` RPC that handles both receiver_id and recipient_id
2. Add anon INSERT policy on messages for guest customers
3. Add a trigger to sync receiver_id <-> recipient_id so both columns always match
4. Ensure products table allows anon SELECT (for customer app without login)
5. Ensure messages table is in realtime publication
*/

-- ============================================================
-- 1. Sync trigger: keep receiver_id and recipient_id in sync
-- ============================================================
CREATE OR REPLACE FUNCTION public.sync_message_recipients()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  -- If recipient_id is set but receiver_id is null, copy it
  IF NEW.recipient_id IS NOT NULL AND NEW.receiver_id IS NULL THEN
    NEW.receiver_id := NEW.recipient_id;
  END IF;
  -- If receiver_id is set but recipient_id is null, copy it
  IF NEW.receiver_id IS NOT NULL AND NEW.recipient_id IS NULL THEN
    NEW.recipient_id := NEW.receiver_id;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_sync_message_recipients ON public.messages;
CREATE TRIGGER trg_sync_message_recipients
  BEFORE INSERT OR UPDATE ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.sync_message_recipients();

-- ============================================================
-- 2. Add anon INSERT policy on messages
-- ============================================================
DROP POLICY IF EXISTS anon_insert_messages ON public.messages;
CREATE POLICY anon_insert_messages ON public.messages FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- ============================================================
-- 3. Add anon SELECT policy on messages (for customer app)
-- ============================================================
DROP POLICY IF EXISTS anon_select_messages ON public.messages;
CREATE POLICY anon_select_messages ON public.messages FOR SELECT
  TO anon, authenticated
  USING (deleted_at IS NULL);

-- ============================================================
-- 4. send_message RPC — works for both customers and vendors
-- ============================================================
CREATE OR REPLACE FUNCTION public.send_message(
  p_sender_id uuid,
  p_recipient_id uuid,
  p_body text DEFAULT NULL,
  p_image_url text DEFAULT NULL,
  p_product_id uuid DEFAULT NULL,
  p_order_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_msg_id uuid;
BEGIN
  IF (p_body IS NULL OR p_body = '') AND (p_image_url IS NULL OR p_image_url = '') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Mesaj la vid');
  END IF;

  INSERT INTO public.messages (
    sender_id, recipient_id, receiver_id,
    body, image_url, product_id, order_id, read
  ) VALUES (
    p_sender_id, p_recipient_id, p_recipient_id,
    COALESCE(p_body, ''), p_image_url, p_product_id, p_order_id, false
  )
  RETURNING id INTO v_msg_id;

  RETURN jsonb_build_object('success', true, 'message_id', v_msg_id);
END;
$function$;

-- ============================================================
-- 5. Ensure products table allows anon SELECT (customer app)
-- ============================================================
DROP POLICY IF EXISTS anon_select_products ON public.products;
CREATE POLICY anon_select_products ON public.products FOR SELECT
  TO anon, authenticated
  USING (deleted_at IS NULL AND active = true);

-- ============================================================
-- 6. Ensure messages table is in realtime publication
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='messages') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;
END $$;

-- ============================================================
-- 7. Ensure products table is in realtime publication
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='products') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
  END IF;
END $$;
