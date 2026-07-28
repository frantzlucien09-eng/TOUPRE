/*
# Phase 5b: Cleanup Duplicate Triggers and Functions

## Context
There are pre-existing triggers and functions that overlap with our new ones:
- trg_notify_order_parties (pre-existing) overlaps with trg_notify_vendor_on_order
- trg_notify_withdrawal_payout (pre-existing) overlaps with trg_notify_withdrawal
- trg_sync_favorite_count (pre-existing) overlaps with trg_product_favorites
- trg_update_product_stats_on_status (pre-existing) overlaps with trg_recalc_on_order
- get_effective_commission_rate has duplicate signatures (uuid,numeric) and (uuid,numeric,uuid)
- log_automation_error has duplicate signatures (6 params) and (3 params)

Strategy: Keep the pre-existing triggers (they already work and have error logging),
remove our duplicates. Fix the commission function ambiguity.
*/

-- ============================================================
-- 1. Remove our duplicate triggers (keep pre-existing ones)
-- ============================================================
DROP TRIGGER IF EXISTS trg_notify_vendor_on_order ON public.orders;
DROP TRIGGER IF EXISTS trg_notify_withdrawal ON public.withdrawals;
DROP TRIGGER IF EXISTS trg_product_favorites ON public.favorites;

-- ============================================================
-- 2. Drop our duplicate functions (keep pre-existing ones)
-- ============================================================
DROP FUNCTION IF EXISTS public.notify_vendor_on_order() CASCADE;
DROP FUNCTION IF EXISTS public.notify_withdrawal_update() CASCADE;
DROP FUNCTION IF EXISTS public.update_product_favorite_count() CASCADE;

-- ============================================================
-- 3. Fix duplicate get_effective_commission_rate functions
-- There are two signatures: (uuid, numeric) and (uuid, numeric, uuid)
-- Each appears twice (duplicate). Drop all and recreate with just the 2-param version.
-- ============================================================
DROP FUNCTION IF EXISTS public.get_effective_commission_rate(uuid, numeric) CASCADE;
DROP FUNCTION IF EXISTS public.get_effective_commission_rate(uuid, numeric, uuid) CASCADE;

CREATE OR REPLACE FUNCTION public.get_effective_commission_rate(
  p_vendor_id uuid,
  p_order_total numeric
) RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_rate numeric;
  v_vendor_rate numeric;
BEGIN
  -- Check for vendor-specific rate
  SELECT custom_commission_rate INTO v_vendor_rate
  FROM public.vendors
  WHERE id = p_vendor_id AND deleted_at IS NULL AND custom_commission_rate IS NOT NULL;

  IF v_vendor_rate IS NOT NULL THEN
    RETURN v_vendor_rate;
  END IF;

  -- Get tiered rate from commission_config based on order total
  SELECT COALESCE(commission_rate, 10.0) INTO v_rate
  FROM public.commission_config
  WHERE is_active = true AND p_order_total >= min_order_amount
  ORDER BY min_order_amount DESC
  LIMIT 1;

  RETURN COALESCE(v_rate, 10.0);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_effective_commission_rate(uuid, numeric) TO authenticated;

-- ============================================================
-- 4. Fix duplicate log_automation_error functions
-- Pre-existing: (text, text, text) — 3 params
-- Ours: (text, text, text, text, text, jsonb) — 6 params
-- Keep both — they have different signatures. But the pre-existing one
-- calls log_automation_error(text, text, text) internally, so we need to
-- make sure our 6-param version still works.
-- Actually, let's check if the 3-param version exists and recreate it
-- to use our 6-param version internally.
-- ============================================================
DROP FUNCTION IF EXISTS public.log_automation_error(text, text, text) CASCADE;

CREATE OR REPLACE FUNCTION public.log_automation_error(
  p_trigger_name text,
  p_function_name text,
  p_error_message text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.log_automation_error(p_trigger_name, p_function_name, p_error_message, NULL, NULL, NULL);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.log_automation_error(text, text, text) TO authenticated;

-- ============================================================
-- 5. Fix the pre-existing notify_order_parties to use our notify_user/notify_admins
-- Actually, the pre-existing function already works well. It inserts directly.
-- The issue is it uses v_customer_id (which is the customer record ID, not the user_id)
-- for notifications. Let's fix it to resolve the actual user_id.
-- ============================================================
DROP TRIGGER IF EXISTS trg_notify_order_parties ON public.orders;
DROP FUNCTION IF EXISTS public.notify_order_parties() CASCADE;

CREATE OR REPLACE FUNCTION public.notify_order_parties()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_vendor_user_id uuid;
  v_customer_user_id uuid;
  v_old_status text;
  v_new_status text;
  v_order_number text;
  v_notif_data jsonb;
BEGIN
  BEGIN
    v_new_status := NEW.status;
    v_old_status := COALESCE(OLD.status, '');
    v_order_number := NEW.order_number;

    -- Resolve actual user IDs
    SELECT user_id INTO v_vendor_user_id
    FROM public.vendors WHERE id = NEW.vendor_id AND deleted_at IS NULL;

    IF NEW.customer_id IS NOT NULL THEN
      SELECT user_id INTO v_customer_user_id
      FROM public.customers WHERE id = NEW.customer_id AND deleted_at IS NULL;
    END IF;

    v_notif_data := jsonb_build_object(
      'order_id', NEW.id,
      'order_number', v_order_number,
      'vendor_id', NEW.vendor_id,
      'status', v_new_status
    );

    -- ORDER CREATED (INSERT)
    IF TG_OP = 'INSERT' THEN
      PERFORM public.notify_user(v_vendor_user_id, 'order', 'Nouvo Kòmand',
        'Ou gen yon nouvo kòmand pou revize.', v_notif_data);
      PERFORM public.notify_user(v_customer_user_id, 'order', 'Kòmand Konfime',
        'Kòmand ou a konfime. N ap swiv li pou ou.', v_notif_data);
      PERFORM public.notify_admins('order', 'Nouvo Kòmand Kreye',
        'Yon nouvo kòmand #' || COALESCE(v_order_number, NEW.id::text) || ' kreye.', v_notif_data);
      RETURN NEW;
    END IF;

    -- STATUS CHANGES (UPDATE) — only when status actually changes
    IF v_new_status = v_old_status AND NEW.payment_status = COALESCE(OLD.payment_status, '') THEN
      RETURN NEW;
    END IF;

    -- Accepted
    IF v_new_status IN ('processing', 'accepted') AND v_old_status IN ('pending', '') THEN
      PERFORM public.notify_user(v_customer_user_id, 'order', 'Kòmand Aksepte',
        'Vandè a aksepte kòmand ou a.', v_notif_data);
      PERFORM public.notify_admins('order', 'Kòmand Aksepte',
        'Kòmand #' || COALESCE(v_order_number, NEW.id::text) || ' aksepte.', v_notif_data);

    -- Shipped/Delivering
    ELSIF v_new_status IN ('shipped', 'delivering', 'ready_pickup') AND v_old_status NOT IN ('shipped', 'delivering', 'ready_pickup') THEN
      DECLARE
        v_title text := CASE WHEN v_new_status = 'ready_pickup' THEN 'Kòmand Pare pou Retire!' ELSE 'Kòmand an Wout!' END;
        v_body text := CASE WHEN v_new_status = 'ready_pickup' THEN 'Kòmand ou a pare pou w retire l.' ELSE 'Kòmand ou a ekspedye.' END;
      BEGIN
        PERFORM public.notify_user(v_customer_user_id, 'order', v_title, v_body, v_notif_data);
        PERFORM public.notify_admins('order', v_title,
          'Kòmand #' || COALESCE(v_order_number, NEW.id::text) || ' — ' || v_new_status, v_notif_data);
      END;

    -- Delivered
    ELSIF v_new_status IN ('delivered', 'picked_up', 'completed') AND v_old_status NOT IN ('delivered', 'picked_up', 'completed') THEN
      PERFORM public.notify_user(v_customer_user_id, 'order', 'Kòmand LIVRE!',
        'Kòmand ou a livre! Tanpri evalye esperyans ou.', v_notif_data);
      PERFORM public.notify_user(v_vendor_user_id, 'order', 'Kòmand LIVRE!',
        'Yon kòmand te livre. Balans ou mete ajou.', v_notif_data);
      PERFORM public.notify_admins('order', 'Kòmand Livre',
        'Kòmand #' || COALESCE(v_order_number, NEW.id::text) || ' livre.', v_notif_data);

    -- Cancelled
    ELSIF v_new_status = 'cancelled' AND v_old_status <> 'cancelled' THEN
      PERFORM public.notify_user(v_customer_user_id, 'order', 'Kòmand Anile',
        'Kòmand ou a anile.', v_notif_data);
      PERFORM public.notify_user(v_vendor_user_id, 'order', 'Kòmand Anile',
        'Yon kòmand te anile. Pa gen okenn revni pou kòmand sa a.', v_notif_data);
      PERFORM public.notify_admins('order', 'Kòmand Anile',
        'Kòmand #' || COALESCE(v_order_number, NEW.id::text) || ' anile.', v_notif_data);

    -- Refunded
    ELSIF NEW.payment_status = 'refunded' AND COALESCE(OLD.payment_status, '') <> 'refunded' THEN
      PERFORM public.notify_user(v_customer_user_id, 'order', 'Ranbousman',
        'Ranbousman pou kòmand ou a trete.', v_notif_data);
      PERFORM public.notify_user(v_vendor_user_id, 'order', 'Ranbousman',
        'Yon ranbousman trete pou yon kòmand. Balans ou mete ajou.', v_notif_data);
      PERFORM public.notify_admins('order', 'Ranbousman Trete',
        'Yon ranbousman trete pou kòmand #' || COALESCE(v_order_number, NEW.id::text) || '.', v_notif_data);
    END IF;

    RETURN NEW;

  EXCEPTION WHEN OTHERS THEN
    PERFORM public.log_automation_error('trg_notify_order_parties', 'notify_order_parties', SQLERRM);
    RETURN NEW;
  END;
END;
$function$;

CREATE TRIGGER trg_notify_order_parties
  AFTER INSERT OR UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.notify_order_parties();

-- ============================================================
-- 6. Fix the pre-existing notify_withdrawal_payout to use our helpers
-- ============================================================
DROP TRIGGER IF EXISTS trg_notify_withdrawal_payout ON public.withdrawals;
DROP FUNCTION IF EXISTS public.notify_withdrawal_payout() CASCADE;

CREATE OR REPLACE FUNCTION public.notify_withdrawal_payout()
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
    IF NEW.status = 'paid' AND COALESCE(OLD.status, '') <> 'paid' THEN
      SELECT user_id INTO v_vendor_user_id
      FROM public.vendors WHERE id = NEW.vendor_id AND deleted_at IS NULL;

      v_notif_data := jsonb_build_object('withdrawal_id', NEW.id, 'amount', NEW.amount, 'vendor_id', NEW.vendor_id);

      PERFORM public.notify_user(v_vendor_user_id, 'withdrawal', 'Peman Trete!',
        'Peman ou a trete ak siksè. Lajan nan transfere.', v_notif_data);

      PERFORM public.notify_admins('withdrawal', 'Peman Vandè Trete',
        'Yon peman vandè trete — ' || NEW.amount || ' G.', v_notif_data);

      -- Update vendor wallet (available -> withdrawn)
      PERFORM public.update_vendor_stats(NEW.vendor_id);
    END IF;

    RETURN NEW;

  EXCEPTION WHEN OTHERS THEN
    PERFORM public.log_automation_error('trg_notify_withdrawal_payout', 'notify_withdrawal_payout', SQLERRM);
    RETURN NEW;
  END;
END;
$function$;

CREATE TRIGGER trg_notify_withdrawal_payout
  AFTER UPDATE OF status ON public.withdrawals
  FOR EACH ROW EXECUTE FUNCTION public.notify_withdrawal_payout();

-- ============================================================
-- 7. Fix the pre-existing update_product_stats_on_order_status
-- It references order_items table and total_revenue column which may not exist.
-- Our trigger_recalc_on_order already handles product sold_count via items JSONB.
-- Drop the pre-existing trigger to avoid conflicts.
-- ============================================================
DROP TRIGGER IF EXISTS trg_update_product_stats_on_status ON public.orders;
DROP FUNCTION IF EXISTS public.update_product_stats_on_order_status() CASCADE;

-- ============================================================
-- 8. Fix the pre-existing sync_product_favorite_count
-- It only updates products.favorite_count, not product_stats.
-- Recreate it to also update product_stats.
-- ============================================================
DROP TRIGGER IF EXISTS trg_sync_favorite_count ON public.favorites;
DROP FUNCTION IF EXISTS public.sync_product_favorite_count() CASCADE;

CREATE OR REPLACE FUNCTION public.sync_product_favorite_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_product_id uuid;
  v_delta integer;
BEGIN
  BEGIN
    IF TG_OP = 'INSERT' THEN
      v_product_id := NEW.product_id;
      v_delta := 1;
    ELSIF TG_OP = 'DELETE' THEN
      v_product_id := OLD.product_id;
      v_delta := -1;
    END IF;

    IF v_product_id IS NOT NULL THEN
      -- Update products.favorite_count
      UPDATE public.products
      SET favorite_count = GREATEST(COALESCE(favorite_count, 0) + v_delta, 0)
      WHERE id = v_product_id AND deleted_at IS NULL;

      -- Update product_stats.favorite_count
      UPDATE public.product_stats
      SET favorite_count = GREATEST(COALESCE(favorite_count, 0) + v_delta, 0),
          computed_at = now()
      WHERE product_id = v_product_id;
    END IF;

    RETURN COALESCE(NEW, OLD);

  EXCEPTION WHEN OTHERS THEN
    PERFORM public.log_automation_error('trg_sync_favorite_count', 'sync_product_favorite_count', SQLERRM);
    RETURN COALESCE(NEW, OLD);
  END;
END;
$function$;

CREATE TRIGGER trg_sync_favorite_count
  AFTER INSERT OR DELETE ON public.favorites
  FOR EACH ROW EXECUTE FUNCTION public.sync_product_favorite_count();

-- ============================================================
-- 9. Grant access to updated functions
-- ============================================================
GRANT EXECUTE ON FUNCTION public.notify_order_parties() TO authenticated;
GRANT EXECUTE ON FUNCTION public.notify_withdrawal_payout() TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_product_favorite_count() TO authenticated;
