/*
# Rewrite get_vendor_dashboard RPC to Return Complete JSON

## Context
The previous get_vendor_dashboard() returned a flat TABLE with only vendor_stats
columns. The VendorDashboardPage expects a JSON object with period breakdowns
(today/week/month) and pending_payout. The mismatch would cause a blank page.

## Changes:
1. Drops the old TABLE-returning function
2. Creates a new RETURNS jsonb function returning:
   - All vendor_stats fields (total_sales, total_orders, completed_orders, etc.)
   - today/week/month period summaries (sales + orders)
   - pending_payout (sum of pending withdrawals)
   - average_rating, rating_count, ranking, seller_badge
3. Returns empty defaults when vendor has no stats row yet (prevents null crash)

## Security
- SECURITY DEFINER (bypasses RLS so it can read vendor_stats for the given vendor)
- Execute permission granted to authenticated
*/
DROP FUNCTION IF EXISTS public.get_vendor_dashboard(uuid);

CREATE FUNCTION public.get_vendor_dashboard(p_vendor_id uuid)
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
  -- Get vendor stats (may not exist yet for new vendors)
  SELECT
    vs.total_sales, vs.total_orders, vs.completed_orders, vs.cancelled_orders,
    vs.refunded_orders, vs.total_commission, vs.vendor_revenue,
    vs.available_balance, vs.pending_balance, vs.average_rating,
    vs.rating_count, vs.ranking, vs.seller_badge
  INTO
    v_total_sales, v_total_orders, v_completed_orders, v_cancelled_orders,
    v_refunded_orders, v_total_commission, v_vendor_revenue,
    v_available_balance, v_pending_balance, v_average_rating,
    v_rating_count, v_ranking, v_seller_badge
  FROM public.vendor_stats vs
  WHERE vs.vendor_id = p_vendor_id;

  -- Period summaries from orders
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

  -- Pending withdrawal requests
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

GRANT EXECUTE ON FUNCTION public.get_vendor_dashboard(uuid) TO authenticated;
