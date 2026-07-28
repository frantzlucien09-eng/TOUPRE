/*
# Phase 3: Notification Automation

## Context
Currently:
- Customer gets notified on status change (via update_order_status RPC)
- Vendor gets notified on new order (via trg_notify_vendor_on_order)
- Admin gets NO notifications

This migration:
1. Rewrites update_order_status RPC to send notifications to customer, vendor, AND admin
2. Adds admin notification helper function
3. Adds payout/refund/cancellation notifications
4. Ensures all order events notify all relevant parties

## Notification matrix:
| Event          | Customer | Vendor | Admin |
|----------------|----------|--------|-------|
| Order Created  |          | X      | X     |
| Order Accepted | X        |        | X     |
| Order Shipped  | X        |        | X     |
| Order Delivered| X        | X      | X     |
| Cancelled      | X        | X      | X     |
| Refund         | X        | X      | X     |
| Payout         |          | X      | X     |
*/

-- ============================================================
-- 1. Helper: notify all admins
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_admins(
  p_type text,
  p_title text,
  p_body text,
  p_data jsonb DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_admin record;
BEGIN
  BEGIN
    FOR v_admin IN
      SELECT user_id FROM public.admin_profiles WHERE deleted_at IS NULL
    LOOP
      INSERT INTO public.notifications (user_id, type, title, body, data, is_read, read)
      VALUES (v_admin.user_id, p_type, p_title, p_body, p_data, false, false)
      ON CONFLICT DO NOTHING;
    END LOOP;
  EXCEPTION WHEN OTHERS THEN
    PERFORM public.log_automation_error(
      'notify_admins', 'notify_admins',
      SQLERRM, NULL, NULL,
      jsonb_build_object('type', p_type, 'title', p_title)
    );
  END;
END;
$function$;

-- ============================================================
-- 2. Helper: notify a specific user
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_user(
  p_user_id uuid,
  p_type text,
  p_title text,
  p_body text,
  p_data jsonb DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  BEGIN
    IF p_user_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, type, title, body, data, is_read, read)
      VALUES (p_user_id, p_type, p_title, p_body, p_data, false, false)
      ON CONFLICT DO NOTHING;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    PERFORM public.log_automation_error(
      'notify_user', 'notify_user',
      SQLERRM, NULL, NULL,
      jsonb_build_object('user_id', p_user_id, 'type', p_type, 'title', p_title)
    );
  END;
END;
$function$;

-- ============================================================
-- 3. Rewrite update_order_status to notify all parties
-- ============================================================
DROP FUNCTION IF EXISTS public.update_order_status(uuid, text, text, text) CASCADE;
CREATE OR REPLACE FUNCTION public.update_order_status(
  p_order_id uuid,
  p_new_status text,
  p_note text DEFAULT NULL,
  p_delivery_proof_url text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_order record;
  v_customer_user_id uuid;
  v_vendor_user_id uuid;
  v_notif_title text;
  v_notif_body text;
  v_vendor_notif_title text;
  v_vendor_notif_body text;
  v_admin_notif_title text;
  v_admin_notif_body text;
  v_notif_data jsonb;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Kòmand pa egziste');
  END IF;

  -- Authorization
  IF NOT is_admin() THEN
    IF NOT EXISTS (
      SELECT 1 FROM vendors
      WHERE id = v_order.vendor_id AND user_id = auth.uid() AND deleted_at IS NULL
    ) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Ou pa otorize pou w modifye kòmand sa a');
    END IF;
  END IF;

  -- Delivery proof enforcement
  IF p_new_status = 'delivered' AND COALESCE(p_delivery_proof_url, v_order.delivery_proof_url) IS NULL AND v_order.delivery_type = 'delivery' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ou dwe pran yon foto kòm prèv anvan w ka make kòmand lan livre.');
  END IF;

  -- Update the order
  UPDATE public.orders
  SET status = p_new_status,
      updated_at = now(),
      completed_at = CASE WHEN p_new_status IN ('delivered', 'picked_up', 'completed', 'cancelled', 'refunded') THEN now() ELSE completed_at END,
      delivery_proof_url = COALESCE(p_delivery_proof_url, delivery_proof_url),
      payment_status = CASE WHEN p_new_status = 'refunded' THEN 'refunded' ELSE payment_status END
  WHERE id = p_order_id;

  -- Resolve user IDs
  IF v_order.customer_id IS NOT NULL THEN
    SELECT user_id INTO v_customer_user_id FROM public.customers WHERE id = v_order.customer_id AND deleted_at IS NULL;
  END IF;
  IF v_order.vendor_id IS NOT NULL THEN
    SELECT user_id INTO v_vendor_user_id FROM public.vendors WHERE id = v_order.vendor_id AND deleted_at IS NULL;
  END IF;

  v_notif_data := jsonb_build_object(
    'order_id', p_order_id,
    'status', p_new_status,
    'order_number', v_order.order_number,
    'delivery_proof_url', COALESCE(p_delivery_proof_url, v_order.delivery_proof_url)
  );

  -- Build notification text based on new status
  v_notif_title := CASE p_new_status
    WHEN 'accepted' THEN 'Kòmand Konfime!'
    WHEN 'preparing' THEN 'Kòmand Ap Prepare'
    WHEN 'processing' THEN 'Kòmand Ap Trete'
    WHEN 'ready_pickup' THEN 'Kòmand Pare pou Retire!'
    WHEN 'delivering' THEN 'Vandè a Ap Vini!'
    WHEN 'shipped' THEN 'Kòmand Ekspedye!'
    WHEN 'delivered' THEN 'Kòmand ou LIVRE!'
    WHEN 'picked_up' THEN 'Kòmand Retire!'
    WHEN 'completed' THEN 'Kòmand Konplè!'
    WHEN 'cancelled' THEN 'Kòmand Anile'
    WHEN 'refunded' THEN 'Rembousman Fèt'
    ELSE 'Kòmand Mete ajou'
  END;

  v_notif_body := CASE p_new_status
    WHEN 'accepted' THEN 'Vandè a aksepte kòmand ou!'
    WHEN 'preparing' THEN 'Kòmand ou ap prepare kounye a!'
    WHEN 'processing' THEN 'Kòmand ou ap trete kounye a!'
    WHEN 'ready_pickup' THEN 'Kòmand ou pare pou w retire l!'
    WHEN 'delivering' THEN 'Vandè a nan wout pou livre w!'
    WHEN 'shipped' THEN 'Kòmand ou an wout!'
    WHEN 'delivered' THEN 'Kòmand ou LIVRE! Tanpri evalye esperyans ou.'
    WHEN 'picked_up' THEN 'Kliyan retire kòmand ou. Mèsi!'
    WHEN 'completed' THEN 'Kòmand ou konplè. Mèsi!'
    WHEN 'cancelled' THEN COALESCE(p_note, 'Kòmand sa a anile.')
    WHEN 'refunded' THEN COALESCE(p_note, 'Rembousman fèt pou kòmand sa a.')
    ELSE 'Estati kòmand ou mete ajou.'
  END;

  -- Vendor-specific notification text
  v_vendor_notif_title := CASE p_new_status
    WHEN 'delivered' THEN 'Kòmand LIVRE!'
    WHEN 'picked_up' THEN 'Kòmand Retire!'
    WHEN 'completed' THEN 'Kòmand Konplè!'
    WHEN 'cancelled' THEN 'Kòmand Anile'
    WHEN 'refunded' THEN 'Rembousman Rejwenn'
    ELSE v_notif_title
  END;

  v_vendor_notif_body := CASE p_new_status
    WHEN 'delivered' THEN 'Yon kòmand make livre. Balans ou mete ajou.'
    WHEN 'picked_up' THEN 'Kliyan retire kòmand la. Balans ou mete ajou.'
    WHEN 'completed' THEN 'Kòmand konplè. Revni ou mete ajou.'
    WHEN 'cancelled' THEN 'Kòmand anile. Pa gen okenn revni pou kòmand sa a.'
    WHEN 'refunded' THEN 'Rembousman fèt. Balans ou mete ajou.'
    ELSE v_notif_body
  END;

  -- Admin notification text
  v_admin_notif_title := CASE p_new_status
    WHEN 'cancelled' THEN 'Kòmand Anile'
    WHEN 'refunded' THEN 'Rembousman Fèt'
    ELSE v_notif_title
  END;

  v_admin_notif_body := CASE p_new_status
    WHEN 'cancelled' THEN 'Kòmand #' || COALESCE(v_order.order_number, p_order_id::text) || ' anile.'
    WHEN 'refunded' THEN 'Rembousman fèt pou kòmand #' || COALESCE(v_order.order_number, p_order_id::text) || '.'
    ELSE 'Kòmand #' || COALESCE(v_order.order_number, p_order_id::text) || ' — ' || p_new_status
  END;

  -- Send notifications
  -- Customer
  PERFORM public.notify_user(v_customer_user_id, 'order', v_notif_title, v_notif_body, v_notif_data);

  -- Vendor (for delivered/picked_up/completed/cancelled/refunded)
  IF p_new_status IN ('delivered', 'picked_up', 'completed', 'cancelled', 'refunded') THEN
    PERFORM public.notify_user(v_vendor_user_id, 'order', v_vendor_notif_title, v_vendor_notif_body, v_notif_data);
  END IF;

  -- Admin (for all status changes)
  PERFORM public.notify_admins('order', v_admin_notif_title, v_admin_notif_body, v_notif_data);

  RETURN jsonb_build_object('success', true, 'order_id', p_order_id, 'status', p_new_status);
END;
$function$;

-- ============================================================
-- 4. Rewrite notify_vendor_on_order to also notify admin
-- ============================================================
DROP FUNCTION IF EXISTS public.notify_vendor_on_order() CASCADE;
CREATE OR REPLACE FUNCTION public.notify_vendor_on_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_vendor_user_id uuid;
  v_notif_data jsonb;
BEGIN
  BEGIN
    -- Get vendor's user_id
    SELECT user_id INTO v_vendor_user_id
    FROM public.vendors WHERE id = NEW.vendor_id AND deleted_at IS NULL;

    v_notif_data := jsonb_build_object(
      'order_id', NEW.id,
      'order_number', NEW.order_number,
      'status', 'pending',
      'total', NEW.total
    );

    -- Notify vendor
    PERFORM public.notify_user(
      v_vendor_user_id, 'order', 'Nouvo Kòmand',
      'Ou gen yon nouvo kòmand!', v_notif_data
    );

    -- Notify admins
    PERFORM public.notify_admins(
      'order', 'Nouvo Kòmand',
      'Yon nouvo kòmand #' || COALESCE(NEW.order_number, NEW.id::text) || ' kreye.',
      v_notif_data
    );
  EXCEPTION WHEN OTHERS THEN
    PERFORM public.log_automation_error(
      'trg_notify_vendor_on_order', 'notify_vendor_on_order',
      SQLERRM, NULL, NULL,
      jsonb_build_object('order_id', NEW.id, 'vendor_id', NEW.vendor_id)
    );
  END;

  RETURN NEW;
END;
$function$;

-- Recreate the trigger
DROP TRIGGER IF EXISTS trg_notify_vendor_on_order ON public.orders;
CREATE TRIGGER trg_notify_vendor_on_order
  AFTER INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.notify_vendor_on_order();

-- ============================================================
-- 5. Withdrawal notification trigger
-- ============================================================
DROP FUNCTION IF EXISTS public.notify_withdrawal_update() CASCADE;
CREATE OR REPLACE FUNCTION public.notify_withdrawal_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_vendor_user_id uuid;
  v_notif_title text;
  v_notif_body text;
  v_notif_data jsonb;
BEGIN
  BEGIN
    IF (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status) OR TG_OP = 'INSERT' THEN
      SELECT user_id INTO v_vendor_user_id
      FROM public.vendors WHERE id = COALESCE(NEW.vendor_id, OLD.vendor_id) AND deleted_at IS NULL;

      v_notif_data := jsonb_build_object(
        'withdrawal_id', COALESCE(NEW.id, OLD.id),
        'amount', COALESCE(NEW.amount, OLD.amount),
        'status', COALESCE(NEW.status, OLD.status)
      );

      v_notif_title := CASE COALESCE(NEW.status, 'pending')
        WHEN 'pending' THEN 'Demann Retire Soumis'
        WHEN 'approved' THEN 'Demann Retire Aprove'
        WHEN 'processing' THEN 'Demann Retire Ap Trete'
        WHEN 'paid' THEN 'Peman Fèt!'
        WHEN 'rejected' THEN 'Demann Retire Refize'
        ELSE 'Estati Demann Retire'
      END;

      v_notif_body := CASE COALESCE(NEW.status, 'pending')
        WHEN 'pending' THEN 'Demann retre ou soumisi. Nou ap trete l.'
        WHEN 'approved' THEN 'Demann retre ou a aprobe!'
        WHEN 'processing' THEN 'Demann retre ou ap trete kounye a.'
        WHEN 'paid' THEN 'Peman ou fèt! Lajan nan nan kont ou.'
        WHEN 'rejected' THEN 'Demann retre ou refize. ' || COALESCE(NEW.rejection_reason, '')
        ELSE 'Estati demann retre ou mete ajou.'
      END;

      -- Notify vendor
      PERFORM public.notify_user(v_vendor_user_id, 'withdrawal', v_notif_title, v_notif_body, v_notif_data);

      -- Notify admins (for new and status changes)
      PERFORM public.notify_admins('withdrawal', v_notif_title,
        'Demann retre ' || COALESCE(NEW.amount, OLD.amount) || ' G — ' || COALESCE(NEW.status, 'pending'),
        v_notif_data);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    PERFORM public.log_automation_error(
      'trg_notify_withdrawal', 'notify_withdrawal_update',
      SQLERRM, NULL, NULL,
      jsonb_build_object('withdrawal_id', COALESCE(NEW.id, OLD.id))
    );
  END;

  RETURN COALESCE(NEW, OLD);
END;
$function$;

DROP TRIGGER IF EXISTS trg_notify_withdrawal ON public.withdrawals;
CREATE TRIGGER trg_notify_withdrawal
  AFTER INSERT OR UPDATE ON public.withdrawals
  FOR EACH ROW EXECUTE FUNCTION public.notify_withdrawal_update();

-- ============================================================
-- 6. Grant access
-- ============================================================
GRANT EXECUTE ON FUNCTION public.notify_admins(text, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.notify_user(uuid, text, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_order_status(uuid, text, text, text) TO authenticated;
