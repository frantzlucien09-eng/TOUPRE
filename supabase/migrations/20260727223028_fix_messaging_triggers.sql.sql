-- Add a trigger to auto-sync conversation last_message and log creation
-- Also add a notification trigger for new messages

-- Function to update conversation's last_message when a new message is inserted
CREATE OR REPLACE FUNCTION public.update_conversation_on_message()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  conv_id uuid;
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

  -- Create a notification for the receiver
  -- Use receiver_id (auth uid) if available, otherwise recipient_id
  DECLARE
    notif_user_id uuid;
  BEGIN
    notif_user_id := COALESCE(NEW.receiver_id, NEW.recipient_id);
    -- Try to find the user_id if recipient_id is a vendor row ID
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
  END;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_update_conversation_on_message ON public.messages;
CREATE TRIGGER trg_update_conversation_on_message
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.update_conversation_on_message();

-- Add a log trigger for conversation creation (using RAISE NOTICE for server-side logging)
CREATE OR REPLACE FUNCTION public.log_conversation_created()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  RAISE NOTICE 'conversation created: id=%, p1=%, p2=%, customer_id=%, vendor_id=%',
    NEW.id, NEW.participant_1_id, NEW.participant_2_id, NEW.customer_id, NEW.vendor_id;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_log_conversation_created ON public.conversations;
CREATE TRIGGER trg_log_conversation_created
  AFTER INSERT ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.log_conversation_created();
