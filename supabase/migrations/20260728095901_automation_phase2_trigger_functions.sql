/*
# Phase 2: Update Trigger Functions (retry with CASCADE)
*/

-- Helper: log automation errors safely
CREATE OR REPLACE FUNCTION public.log_automation_error(
  p_trigger_name text,
  p_function_name text,
  p_error_message text,
  p_error_detail text DEFAULT NULL,
  p_error_hint text DEFAULT NULL,
  p_record_data jsonb DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  BEGIN
    INSERT INTO public.automation_error_log
      (trigger_name, function_name, error_message, error_detail, error_hint, record_data)
    VALUES
      (p_trigger_name, p_function_name, p_error_message, p_error_detail, p_error_hint, p_record_data);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
END;
$function$;

-- Drop and recreate trigger_recalc_on_order
DROP TRIGGER IF EXISTS trg_recalc_on_order ON public.orders;
DROP FUNCTION IF EXISTS public.trigger_recalc_on_order() CASCADE;

CREATE OR REPLACE FUNCTION public.trigger_recalc_on_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_vendor_id uuid;
  v_old_status text;
  v_new_status text;
  v_was_completed boolean;
  v_is_completed boolean;
  v_item record;
BEGIN
  v_vendor_id := COALESCE(NEW.vendor_id, OLD.vendor_id);
  v_new_status := CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE NEW.status END;
  v_old_status := CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.status END;
  v_was_completed := v_old_status IN ('delivered', 'picked_up', 'completed');
  v_is_completed := v_new_status IN ('delivered', 'picked_up', 'completed');

  -- Update vendor stats and badges
  IF v_vendor_id IS NOT NULL THEN
    BEGIN
      PERFORM public.update_vendor_stats(v_vendor_id);
      PERFORM public.assign_seller_badges(v_vendor_id);
    EXCEPTION WHEN OTHERS THEN
      PERFORM public.log_automation_error(
        'trg_recalc_on_order', 'update_vendor_stats',
        SQLERRM, NULL, NULL,
        jsonb_build_object('vendor_id', v_vendor_id, 'order_id', COALESCE(NEW.id, OLD.id), 'op', TG_OP)
      );
    END;
  END IF;

  -- Update product sold_count when order transitions to/from completed
  IF v_vendor_id IS NOT NULL THEN
    BEGIN
      IF v_is_completed AND NOT v_was_completed THEN
        FOR v_item IN
          SELECT (value->>'product_id')::uuid AS pid,
                 COALESCE((value->>'quantity')::int, 1) AS qty
          FROM jsonb_array_elements(COALESCE(NEW.items, '[]'::jsonb))
        LOOP
          IF v_item.pid IS NOT NULL THEN
            UPDATE public.products
            SET sold_count = sold_count + v_item.qty,
                last_sold_at = now(),
                first_sold_at = COALESCE(first_sold_at, now())
            WHERE id = v_item.pid AND deleted_at IS NULL;

            UPDATE public.product_stats
            SET sales_count = sales_count + v_item.qty,
                revenue = revenue + (v_item.qty * COALESCE((SELECT price FROM public.products WHERE id = v_item.pid), 0)),
                last_sale_at = now(),
                first_sale_at = COALESCE(first_sale_at, now()),
                computed_at = now()
            WHERE product_id = v_item.pid;
          END IF;
        END LOOP;
      ELSIF v_was_completed AND NOT v_is_completed THEN
        FOR v_item IN
          SELECT (value->>'product_id')::uuid AS pid,
                 COALESCE((value->>'quantity')::int, 1) AS qty
          FROM jsonb_array_elements(COALESCE(OLD.items, '[]'::jsonb))
        LOOP
          IF v_item.pid IS NOT NULL THEN
            UPDATE public.products
            SET sold_count = GREATEST(sold_count - v_item.qty, 0)
            WHERE id = v_item.pid AND deleted_at IS NULL;

            UPDATE public.product_stats
            SET sales_count = GREATEST(sales_count - v_item.qty, 0),
                revenue = GREATEST(revenue - (v_item.qty * COALESCE((SELECT price FROM public.products WHERE id = v_item.pid), 0)), 0),
                computed_at = now()
            WHERE product_id = v_item.pid;
          END IF;
        END LOOP;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      PERFORM public.log_automation_error(
        'trg_recalc_on_order', 'product_sold_count_update',
        SQLERRM, NULL, NULL,
        jsonb_build_object('order_id', COALESCE(NEW.id, OLD.id), 'op', TG_OP, 'new_status', v_new_status)
      );
    END;
  END IF;

  -- Recalculate rankings on completed status transitions
  BEGIN
    IF TG_OP = 'DELETE' THEN
      IF v_was_completed THEN
        PERFORM public.recalculate_vendor_rankings();
      END IF;
    ELSIF v_is_completed AND NOT v_was_completed THEN
      PERFORM public.recalculate_vendor_rankings();
    ELSIF v_was_completed AND NOT v_is_completed THEN
      PERFORM public.recalculate_vendor_rankings();
    END IF;
  EXCEPTION WHEN OTHERS THEN
    PERFORM public.log_automation_error(
      'trg_recalc_on_order', 'recalculate_vendor_rankings',
      SQLERRM, NULL, NULL,
      jsonb_build_object('vendor_id', v_vendor_id, 'order_id', COALESCE(NEW.id, OLD.id))
    );
  END;

  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- Recreate the trigger
CREATE TRIGGER trg_recalc_on_order
  AFTER INSERT OR DELETE OR UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.trigger_recalc_on_order();

-- Drop and recreate update_vendor_stats_on_order
DROP TRIGGER IF EXISTS trg_update_vendor_stats ON public.orders;
DROP FUNCTION IF EXISTS public.update_vendor_stats_on_order() CASCADE;

CREATE OR REPLACE FUNCTION public.update_vendor_stats_on_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_vendor_id uuid;
BEGIN
  v_vendor_id := COALESCE(NEW.vendor_id, OLD.vendor_id);

  IF v_vendor_id IS NOT NULL THEN
    BEGIN
      PERFORM public.recalculate_vendor_stats(v_vendor_id);
      PERFORM public.assign_seller_badges(v_vendor_id);
    EXCEPTION WHEN OTHERS THEN
      PERFORM public.log_automation_error(
        'trg_update_vendor_stats', 'recalculate_vendor_stats',
        SQLERRM, NULL, NULL,
        jsonb_build_object('vendor_id', v_vendor_id, 'order_id', COALESCE(NEW.id, OLD.id), 'op', TG_OP)
      );
    END;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- Note: we do NOT recreate trg_update_vendor_stats trigger because
-- trg_recalc_on_order already calls update_vendor_stats + assign_seller_badges.
-- Having both would cause double execution.

-- ============================================================
-- Rewrite update_vendor_stats(uuid) with full wallet tracking
-- ============================================================
DROP FUNCTION IF EXISTS public.update_vendor_stats(uuid) CASCADE;
CREATE OR REPLACE FUNCTION public.update_vendor_stats(p_vendor_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_total_sales numeric;
  v_total_orders integer;
  v_completed integer;
  v_cancelled integer;
  v_refunded integer;
  v_commission numeric;
  v_revenue numeric;
  v_available numeric;
  v_pending numeric;
  v_withdrawn numeric;
  v_total_earnings numeric;
  v_avg_rating numeric;
  v_rating_count integer;
  v_rank integer;
  v_badge text;
BEGIN
  SELECT
    COALESCE(SUM(total) FILTER (WHERE status IN ('delivered', 'picked_up', 'completed')), 0),
    COUNT(*),
    COUNT(*) FILTER (WHERE status IN ('delivered', 'picked_up', 'completed')),
    COUNT(*) FILTER (WHERE status = 'cancelled'),
    COUNT(*) FILTER (WHERE status = 'refunded' OR payment_status = 'refunded'),
    COALESCE(SUM(commission) FILTER (WHERE status IN ('delivered', 'picked_up', 'completed')), 0),
    COALESCE(SUM(vendor_amount) FILTER (WHERE status IN ('delivered', 'picked_up', 'completed')), 0)
  INTO v_total_sales, v_total_orders, v_completed, v_cancelled, v_refunded,
       v_commission, v_revenue
  FROM public.orders
  WHERE vendor_id = p_vendor_id AND deleted_at IS NULL;

  SELECT COALESCE(SUM(amount), 0) INTO v_withdrawn
  FROM public.withdrawals
  WHERE vendor_id = p_vendor_id AND deleted_at IS NULL AND status = 'paid';

  v_available := v_revenue - v_withdrawn;

  SELECT COALESCE(SUM(vendor_amount), 0) INTO v_pending
  FROM public.orders
  WHERE vendor_id = p_vendor_id
    AND deleted_at IS NULL
    AND status NOT IN ('delivered', 'picked_up', 'completed', 'cancelled', 'refunded')
    AND payment_status IN ('paid', 'partially_paid');

  v_total_earnings := v_revenue;

  SELECT COALESCE(AVG(rating), 0), COUNT(*)
  INTO v_avg_rating, v_rating_count
  FROM public.reviews
  WHERE vendor_id = p_vendor_id AND deleted_at IS NULL;

  SELECT national_rank INTO v_rank
  FROM public.vendor_rankings
  WHERE vendor_id = p_vendor_id;

  v_badge := public.compute_seller_badge(p_vendor_id);

  INSERT INTO public.vendor_stats (
    vendor_id, total_sales, total_orders, completed_orders, cancelled_orders,
    refunded_orders, total_commission, vendor_revenue, available_balance,
    pending_balance, withdrawn_balance, total_earnings,
    average_rating, rating_count, ranking, seller_badge, last_updated
  ) VALUES (
    p_vendor_id, v_total_sales, v_total_orders, v_completed, v_cancelled,
    v_refunded, v_commission, v_revenue, v_available,
    v_pending, v_withdrawn, v_total_earnings,
    ROUND(v_avg_rating, 2), v_rating_count, v_rank, v_badge, now()
  )
  ON CONFLICT (vendor_id) DO UPDATE SET
    total_sales = EXCLUDED.total_sales,
    total_orders = EXCLUDED.total_orders,
    completed_orders = EXCLUDED.completed_orders,
    cancelled_orders = EXCLUDED.cancelled_orders,
    refunded_orders = EXCLUDED.refunded_orders,
    total_commission = EXCLUDED.total_commission,
    vendor_revenue = EXCLUDED.vendor_revenue,
    available_balance = EXCLUDED.available_balance,
    pending_balance = EXCLUDED.pending_balance,
    withdrawn_balance = EXCLUDED.withdrawn_balance,
    total_earnings = EXCLUDED.total_earnings,
    average_rating = EXCLUDED.average_rating,
    rating_count = EXCLUDED.rating_count,
    ranking = EXCLUDED.ranking,
    seller_badge = EXCLUDED.seller_badge,
    last_updated = now();
END;
$function$;

-- ============================================================
-- Rewrite recalculate_vendor_stats(uuid) with full wallet tracking
-- ============================================================
DROP FUNCTION IF EXISTS public.recalculate_vendor_stats(uuid) CASCADE;
CREATE OR REPLACE FUNCTION public.recalculate_vendor_stats(p_vendor_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_total_sales numeric := 0;
  v_total_orders integer := 0;
  v_total_commission numeric := 0;
  v_vendor_revenue numeric := 0;
  v_avg_rating numeric := 0;
  v_available numeric := 0;
  v_pending numeric := 0;
  v_withdrawn numeric := 0;
  v_total_earnings numeric := 0;
  v_national_rank integer;
  v_completed_orders integer := 0;
  v_cancelled_orders integer := 0;
  v_refunded_orders integer := 0;
  v_rating_count integer := 0;
  v_badge text;
BEGIN
  SELECT
    COALESCE(SUM(o.total), 0),
    COUNT(*),
    COALESCE(SUM(o.commission), 0),
    COALESCE(SUM(o.vendor_amount), 0)
  INTO v_total_sales, v_completed_orders, v_total_commission, v_vendor_revenue
  FROM public.orders o
  WHERE o.vendor_id = p_vendor_id
    AND o.deleted_at IS NULL
    AND o.status IN ('delivered', 'picked_up', 'completed');

  SELECT COUNT(*) INTO v_total_orders
  FROM public.orders o
  WHERE o.vendor_id = p_vendor_id AND o.deleted_at IS NULL;

  SELECT COUNT(*) INTO v_cancelled_orders
  FROM public.orders o
  WHERE o.vendor_id = p_vendor_id AND o.deleted_at IS NULL AND o.status = 'cancelled';

  SELECT COUNT(*) INTO v_refunded_orders
  FROM public.orders o
  WHERE o.vendor_id = p_vendor_id AND o.deleted_at IS NULL
    AND (o.status = 'refunded' OR o.payment_status = 'refunded');

  SELECT COALESCE(AVG(r.rating), 0), COUNT(*)
  INTO v_avg_rating, v_rating_count
  FROM public.reviews r
  WHERE r.vendor_id = p_vendor_id AND r.deleted_at IS NULL;

  SELECT COALESCE(SUM(w.amount), 0) INTO v_withdrawn
  FROM public.withdrawals w
  WHERE w.vendor_id = p_vendor_id AND w.deleted_at IS NULL AND w.status = 'paid';

  v_available := v_vendor_revenue - v_withdrawn;

  SELECT COALESCE(SUM(o.vendor_amount), 0) INTO v_pending
  FROM public.orders o
  WHERE o.vendor_id = p_vendor_id
    AND o.deleted_at IS NULL
    AND o.status NOT IN ('delivered', 'picked_up', 'completed', 'cancelled', 'refunded')
    AND o.payment_status IN ('paid', 'partially_paid');

  v_total_earnings := v_vendor_revenue;

  SELECT vr.national_rank INTO v_national_rank
  FROM public.vendor_rankings vr
  WHERE vr.vendor_id = p_vendor_id;

  v_badge := public.compute_seller_badge(p_vendor_id);

  INSERT INTO public.vendor_stats (
    vendor_id, total_sales, total_orders, completed_orders,
    cancelled_orders, refunded_orders,
    total_commission, vendor_revenue,
    available_balance, pending_balance, withdrawn_balance, total_earnings,
    average_rating, rating_count, ranking, seller_badge, last_updated
  ) VALUES (
    p_vendor_id, v_total_sales, v_total_orders, v_completed_orders,
    v_cancelled_orders, v_refunded_orders,
    v_total_commission, v_vendor_revenue,
    v_available, v_pending, v_withdrawn, v_total_earnings,
    ROUND(v_avg_rating, 2), v_rating_count, v_national_rank, v_badge, now()
  )
  ON CONFLICT (vendor_id) DO UPDATE SET
    total_sales = EXCLUDED.total_sales,
    total_orders = EXCLUDED.total_orders,
    completed_orders = EXCLUDED.completed_orders,
    cancelled_orders = EXCLUDED.cancelled_orders,
    refunded_orders = EXCLUDED.refunded_orders,
    total_commission = EXCLUDED.total_commission,
    vendor_revenue = EXCLUDED.vendor_revenue,
    available_balance = EXCLUDED.available_balance,
    pending_balance = EXCLUDED.pending_balance,
    withdrawn_balance = EXCLUDED.withdrawn_balance,
    total_earnings = EXCLUDED.total_earnings,
    average_rating = EXCLUDED.average_rating,
    rating_count = EXCLUDED.rating_count,
    ranking = EXCLUDED.ranking,
    seller_badge = EXCLUDED.seller_badge,
    last_updated = now();
END;
$function$;

-- Update get_vendor_dashboard to include new wallet columns
DROP FUNCTION IF EXISTS public.get_vendor_dashboard(uuid, timestamptz) CASCADE;
CREATE FUNCTION public.get_vendor_dashboard(p_vendor_id uuid, p_start_date timestamptz DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_total_sales numeric := 0;
  v_total_orders integer := 0;
  v_completed_orders integer := 0;
  v_cancelled_orders integer := 0;
  v_refunded_orders integer := 0;
  v_total_commission numeric := 0;
  v_vendor_revenue numeric := 0;
  v_available_balance numeric := 0;
  v_pending_balance numeric := 0;
  v_withdrawn_balance numeric := 0;
  v_total_earnings numeric := 0;
  v_average_rating numeric := 0;
  v_rating_count integer := 0;
  v_ranking integer;
  v_seller_badge text;
  v_today_sales numeric := 0;
  v_today_orders integer := 0;
  v_week_sales numeric := 0;
  v_week_orders integer := 0;
  v_month_sales numeric := 0;
  v_month_orders integer := 0;
  v_pending_payout numeric := 0;
BEGIN
  SELECT
    vs.total_sales, vs.total_orders, vs.completed_orders, vs.cancelled_orders,
    vs.refunded_orders, vs.total_commission, vs.vendor_revenue,
    vs.available_balance, vs.pending_balance, vs.withdrawn_balance, vs.total_earnings,
    vs.average_rating, vs.rating_count, vs.ranking, vs.seller_badge
  INTO
    v_total_sales, v_total_orders, v_completed_orders, v_cancelled_orders,
    v_refunded_orders, v_total_commission, v_vendor_revenue,
    v_available_balance, v_pending_balance, v_withdrawn_balance, v_total_earnings,
    v_average_rating, v_rating_count, v_ranking, v_seller_badge
  FROM public.vendor_stats vs
  WHERE vs.vendor_id = p_vendor_id;

  IF p_start_date IS NOT NULL THEN
    SELECT
      COALESCE(SUM(total), 0),
      COUNT(*),
      COUNT(*) FILTER (WHERE status IN ('delivered', 'picked_up', 'completed')),
      COUNT(*) FILTER (WHERE status = 'cancelled'),
      COALESCE(SUM(commission), 0),
      COALESCE(SUM(vendor_amount), 0)
    INTO
      v_total_sales, v_total_orders, v_completed_orders, v_cancelled_orders,
      v_total_commission, v_vendor_revenue
    FROM public.orders
    WHERE vendor_id = p_vendor_id AND deleted_at IS NULL AND created_at >= p_start_date;
  END IF;

  SELECT COALESCE(SUM(total), 0), COUNT(*)
  INTO v_today_sales, v_today_orders
  FROM public.orders
  WHERE vendor_id = p_vendor_id AND deleted_at IS NULL AND created_at >= date_trunc('day', now());

  SELECT COALESCE(SUM(total), 0), COUNT(*)
  INTO v_week_sales, v_week_orders
  FROM public.orders
  WHERE vendor_id = p_vendor_id AND deleted_at IS NULL AND created_at >= date_trunc('week', now());

  SELECT COALESCE(SUM(total), 0), COUNT(*)
  INTO v_month_sales, v_month_orders
  FROM public.orders
  WHERE vendor_id = p_vendor_id AND deleted_at IS NULL AND created_at >= date_trunc('month', now());

  SELECT COALESCE(SUM(amount), 0)
  INTO v_pending_payout
  FROM public.withdrawals
  WHERE vendor_id = p_vendor_id AND deleted_at IS NULL AND status = 'pending';

  RETURN jsonb_build_object(
    'total_sales', COALESCE(v_total_sales, 0),
    'total_orders', COALESCE(v_total_orders, 0),
    'completed_orders', COALESCE(v_completed_orders, 0),
    'cancelled_orders', COALESCE(v_cancelled_orders, 0),
    'refunded_orders', COALESCE(v_refunded_orders, 0),
    'total_commission', COALESCE(v_total_commission, 0),
    'vendor_revenue', COALESCE(v_vendor_revenue, 0),
    'available_balance', COALESCE(v_available_balance, 0),
    'pending_balance', COALESCE(v_pending_balance, 0),
    'withdrawn_balance', COALESCE(v_withdrawn_balance, 0),
    'total_earnings', COALESCE(v_total_earnings, 0),
    'average_rating', COALESCE(v_average_rating, 0),
    'rating_count', COALESCE(v_rating_count, 0),
    'ranking', v_ranking,
    'seller_badge', v_seller_badge,
    'today', jsonb_build_object('sales', v_today_sales, 'orders', v_today_orders),
    'week', jsonb_build_object('sales', v_week_sales, 'orders', v_week_orders),
    'month', jsonb_build_object('sales', v_month_sales, 'orders', v_month_orders),
    'pending_payout', v_pending_payout
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_vendor_dashboard(uuid, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_automation_error(text, text, text, text, text, jsonb) TO authenticated;
