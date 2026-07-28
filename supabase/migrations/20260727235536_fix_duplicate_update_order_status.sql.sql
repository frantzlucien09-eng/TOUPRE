-- Drop all existing versions of update_order_status, then recreate cleanly
DROP FUNCTION IF EXISTS public.update_order_status(uuid, text, text, text);
DROP FUNCTION IF EXISTS public.update_order_status(uuid, text, text);
DROP FUNCTION IF EXISTS public.update_order_status(uuid, text);

CREATE OR REPLACE FUNCTION public.update_order_status(
  p_order_id uuid,
  p_new_status text,
  p_note text DEFAULT NULL,
  p_delivery_proof_url text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_order record;
  v_customer_user_id uuid;
  v_notif_title text;
  v_notif_body text;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Kòmand pa egziste');
  END IF;

  UPDATE public.orders
  SET status = p_new_status,
      updated_at = now(),
      completed_at = CASE WHEN p_new_status IN ('delivered', 'picked_up', 'cancelled') THEN now() ELSE completed_at END,
      delivery_proof_url = COALESCE(p_delivery_proof_url, delivery_proof_url)
  WHERE id = p_order_id;

  v_notif_title := CASE p_new_status
    WHEN 'accepted' THEN 'Kòmand Konfime!'
    WHEN 'preparing' THEN 'Kòmand Ap Prepare'
    WHEN 'delivering' THEN 'Vandè a Ap Vini!'
    WHEN 'ready_pickup' THEN 'Kòmand Pare pou Retire!'
    WHEN 'delivered' THEN 'Kòmand ou LIVRE!'
    WHEN 'picked_up' THEN 'Kòmand Retire!'
    WHEN 'cancelled' THEN 'Kòmand Anile'
    ELSE 'Kòmand Mete ajou'
  END;

  v_notif_body := CASE p_new_status
    WHEN 'accepted' THEN 'Vandè a aksepte kòmand ou!'
    WHEN 'preparing' THEN 'Kòmand ou ap prepare kounye a!'
    WHEN 'delivering' THEN 'Vandè a nan wout pou livre w!'
    WHEN 'ready_pickup' THEN 'Kòmand ou pare pou w retire l!'
    WHEN 'delivered' THEN 'Kòmand ou LIVRE! Tanpri evalye esperyans ou.'
    WHEN 'picked_up' THEN 'Kliyan retire kòmand ou. Mèsi!'
    WHEN 'cancelled' THEN COALESCE(p_note, 'Vandè a refize/kansile kòmand sa a.')
    ELSE 'Estati kòmand ou mete ajou.'
  END;

  IF v_order.customer_id IS NOT NULL THEN
    SELECT user_id INTO v_customer_user_id FROM public.customers WHERE id = v_order.customer_id AND deleted_at IS NULL;
    IF v_customer_user_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, type, title, body, data, is_read, read)
      VALUES (
        v_customer_user_id, 'order', v_notif_title, v_notif_body,
        jsonb_build_object('order_id', p_order_id, 'status', p_new_status, 'delivery_proof_url', COALESCE(p_delivery_proof_url, v_order.delivery_proof_url)),
        false, false
      ) ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  RETURN jsonb_build_object('success', true, 'order_id', p_order_id, 'status', p_new_status);
END;
$function$;
