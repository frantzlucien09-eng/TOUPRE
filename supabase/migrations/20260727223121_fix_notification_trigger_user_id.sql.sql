-- Fix notification trigger to use vendor's auth UID (user_id) not their row ID
-- Also fix notifications admin RLS policy (uses has_role)

CREATE OR REPLACE FUNCTION public.update_conversation_on_message()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  conv_id uuid;
  notif_user_id uuid;
BEGIN
  conv_id := NEW.conversation_id;
  IF conv_id IS NOT NULL THEN
    UPDATE public.conversations
      SET last_message = NEW.body,
          last_message_at = NEW.created_at,
          message_count = message_count + 1,
          updated_at = now()
      WHERE id = conv_id;
  END IF;

  -- Determine the receiver's auth UID for the notification
  -- If receiver_id/recipient_id is a vendor row ID, look up their user_id
  notif_user_id := COALESCE(NEW.receiver_id, NEW.recipient_id);
  -- Try to resolve vendor row ID → user_id
  IF notif_user_id IS NOT NULL THEN
    SELECT user_id INTO notif_user_id FROM public.vendors WHERE id = notif_user_id AND deleted_at IS NULL LIMIT 1;
  END IF;
  -- If not found as vendor, try resolving as customer row ID → user_id
  IF notif_user_id IS NULL THEN
    notif_user_id := COALESCE(NEW.receiver_id, NEW.recipient_id);
    SELECT user_id INTO notif_user_id FROM public.customers WHERE id = notif_user_id AND deleted_at IS NULL LIMIT 1;
  END IF;

  IF notif_user_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, title, body, data, is_read)
    VALUES (
      notif_user_id,
      'message',
      'Nouvo mesaj',
      LEFT(COALESCE(NEW.body, 'Nouvo foto mesaj'), 100),
      jsonb_build_object('message_id', NEW.id, 'sender_id', NEW.sender_id, 'product_id', NEW.product_id),
      false
    )
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;

-- Fix notifications admin RLS policy
DROP POLICY IF EXISTS admin_manage_notifications ON public.notifications;
CREATE POLICY notif_admin_manage ON public.notifications FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_profiles WHERE user_id = auth.uid() AND is_active = true AND deleted_at IS NULL))
  WITH CHECK (EXISTS (SELECT 1 FROM public.admin_profiles WHERE user_id = auth.uid() AND is_active = true AND deleted_at IS NULL));

-- Also add a `read` boolean column to notifications if the app uses it
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS read boolean NOT NULL DEFAULT false;
UPDATE public.notifications SET read = is_read WHERE is_read = true;
