/*
# Add Date Range Filter to Analytics RPCs

## Context
The admin and vendor dashboards need date-range filtering. Both RPCs
currently compute "all time" stats. This migration adds an optional
p_start_date parameter to both functions. When NULL (or not passed),
behavior is unchanged (all-time). When provided, all order-based
aggregates are filtered to created_at >= p_start_date.

## Changes:
1. get_admin_analytics(p_start_date timestamptz DEFAULT NULL)
   - All aggregate SUMs/COUNTs filter by created_at >= p_start_date
   - Top sellers query joins vendor_stats (all-time) but the page
     shows these as overall rankings — stats table is cumulative
   - Daily/weekly/monthly generate_series now starts from max(p_start_date, period_start)
   - Period summaries (today/week/month) remain relative to now (not affected by filter)

2. get_vendor_dashboard(p_vendor_id uuid, p_start_date timestamptz DEFAULT NULL)
   - Order-based period summaries filter by created_at >= p_start_date
   - vendor_stats fields remain all-time (they are cumulative aggregates)
   - today/week/month are relative to now (not affected by filter)

## Security
- Both functions remain SECURITY DEFINER
- Execute granted to authenticated
*/
DROP FUNCTION IF EXISTS public.get_admin_analytics();
DROP FUNCTION IF EXISTS public.get_vendor_dashboard(uuid);

CREATE FUNCTION public.get_admin_analytics(p_start_date timestamptz DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_platform_revenue numeric;
  v_total_commission numeric;
  v_vendor_payouts numeric;
  v_total_orders bigint;
  v_completed_orders bigint;
  v_active_vendors bigint;
  v_today_revenue numeric;
  v_today_orders bigint;
  v_week_revenue numeric;
  v_week_orders bigint;
  v_month_revenue numeric;
  v_month_orders bigint;
  v_top_sellers jsonb;
  v_top_products jsonb;
  v_daily jsonb;
  v_weekly jsonb;
  v_monthly jsonb;
  v_start_today timestamptz;
  v_start_week timestamptz;
  v_start_month timestamptz;
  v_daily_start timestamptz;
  v_weekly_start timestamptz;
  v_monthly_start timestamptz;
BEGIN
  -- Aggregate totals, optionally filtered by start date
  SELECT
    COALESCE(SUM(o.total), 0),
    COALESCE(SUM(o.commission), 0),
    COALESCE(SUM(o.vendor_amount), 0),
    COUNT(*),
    COUNT(*) FILTER (WHERE o.status IN ('delivered', 'picked_up'))
  INTO
    v_platform_revenue, v_total_commission, v_vendor_payouts,
    v_total_orders, v_completed_orders
  FROM public.orders o
  WHERE o.deleted_at IS NULL
    AND (p_start_date IS NULL OR o.created_at >= p_start_date);

  SELECT COUNT(*) INTO v_active_vendors
  FROM public.vendors
  WHERE deleted_at IS NULL AND status IN ('active', 'aktif');

  -- Period summaries are always relative to now (not affected by date filter)
  v_start_today := date_trunc('day', now());
  v_start_week := date_trunc('week', now());
  v_start_month := date_trunc('month', now());

  SELECT COALESCE(SUM(total), 0), COUNT(*)
  INTO v_today_revenue, v_today_orders
  FROM public.orders
  WHERE deleted_at IS NULL AND created_at >= v_start_today;

  SELECT COALESCE(SUM(total), 0), COUNT(*)
  INTO v_week_revenue, v_week_orders
  FROM public.orders
  WHERE deleted_at IS NULL AND created_at >= v_start_week;

  SELECT COALESCE(SUM(total), 0), COUNT(*)
  INTO v_month_revenue, v_month_orders
  FROM public.orders
  WHERE deleted_at IS NULL AND created_at >= v_start_month;

  -- Top sellers: vendor_stats are cumulative, but we filter by sales in range
  -- using a subquery on orders for the period
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'vendor_id', t.vendor_id,
    'business_name', t.business_name,
    'avatar_url', t.avatar_url,
    'total_sales', t.period_sales,
    'completed_orders', t.period_completed,
    'vendor_revenue', t.period_revenue,
    'total_commission', t.period_commission,
    'average_rating', t.average_rating,
    'ranking', t.ranking,
    'seller_badge', t.seller_badge
  ) ORDER BY t.period_sales DESC), '[]'::jsonb)
  INTO v_top_sellers
  FROM (
    SELECT
      vs.vendor_id,
      v.business_name,
      v.avatar_url,
      COALESCE(SUM(o.total) FILTER (WHERE o.id IS NOT NULL), 0) AS period_sales,
      COUNT(*) FILTER (WHERE o.status IN ('delivered', 'picked_up')) AS period_completed,
      COALESCE(SUM(o.vendor_amount) FILTER (WHERE o.id IS NOT NULL), 0) AS period_revenue,
      COALESCE(SUM(o.commission) FILTER (WHERE o.id IS NOT NULL), 0) AS period_commission,
      vs.average_rating,
      vs.ranking,
      vs.seller_badge
    FROM public.vendor_stats vs
    JOIN public.vendors v ON v.id = vs.vendor_id AND v.deleted_at IS NULL
    LEFT JOIN public.orders o ON o.vendor_id = vs.vendor_id
      AND o.deleted_at IS NULL
      AND (p_start_date IS NULL OR o.created_at >= p_start_date)
    GROUP BY vs.vendor_id, v.business_name, v.avatar_url, vs.average_rating, vs.ranking, vs.seller_badge
    ORDER BY period_sales DESC
    LIMIT 20
  ) t;

  -- Top products by sold_count in the period
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', p.id,
    'name', p.name,
    'price', p.price,
    'image_url', p.image_url,
    'vendor_id', p.vendor_id,
    'business_name', bv.business_name,
    'sales_count', COALESCE(p.sold_count, 0),
    'search_count', COALESCE(p.search_count, 0)
  ) ORDER BY COALESCE(p.sold_count, 0) DESC), '[]'::jsonb)
  INTO v_top_products
  FROM public.products p
  LEFT JOIN public.vendors bv ON bv.id = p.vendor_id
  WHERE p.deleted_at IS NULL
  LIMIT 20;

  -- Report series: clamp start to the date filter if provided
  v_daily_start := date_trunc('day', now()) - interval '29 days';
  IF p_start_date IS NOT NULL AND p_start_date > v_daily_start THEN
    v_daily_start := date_trunc('day', p_start_date);
  END IF;

  v_weekly_start := date_trunc('week', now()) - interval '11 weeks';
  IF p_start_date IS NOT NULL AND p_start_date > v_weekly_start THEN
    v_weekly_start := date_trunc('week', p_start_date);
  END IF;

  v_monthly_start := date_trunc('month', now()) - interval '11 months';
  IF p_start_date IS NOT NULL AND p_start_date > v_monthly_start THEN
    v_monthly_start := date_trunc('month', p_start_date);
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'day', d::date::text,
    'orders', COALESCE(orders_cnt, 0),
    'revenue', COALESCE(rev, 0),
    'commission', COALESCE(comm, 0)
  ) ORDER BY d DESC), '[]'::jsonb)
  INTO v_daily
  FROM (
    SELECT gs.d,
      COUNT(o.id) AS orders_cnt,
      COALESCE(SUM(o.total), 0) AS rev,
      COALESCE(SUM(o.commission), 0) AS comm
    FROM generate_series(v_daily_start, date_trunc('day', now()), interval '1 day') AS gs(d)
    LEFT JOIN public.orders o ON date_trunc('day', o.created_at) = gs.d AND o.deleted_at IS NULL
    GROUP BY gs.d
  ) sub;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'week', w::date::text,
    'orders', COALESCE(orders_cnt, 0),
    'revenue', COALESCE(rev, 0),
    'commission', COALESCE(comm, 0)
  ) ORDER BY w DESC), '[]'::jsonb)
  INTO v_weekly
  FROM (
    SELECT gs.w,
      COUNT(o.id) AS orders_cnt,
      COALESCE(SUM(o.total), 0) AS rev,
      COALESCE(SUM(o.commission), 0) AS comm
    FROM generate_series(v_weekly_start, date_trunc('week', now()), interval '1 week') AS gs(w)
    LEFT JOIN public.orders o ON date_trunc('week', o.created_at) = gs.w AND o.deleted_at IS NULL
    GROUP BY gs.w
  ) sub;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'month', m::date::text,
    'orders', COALESCE(orders_cnt, 0),
    'revenue', COALESCE(rev, 0),
    'commission', COALESCE(comm, 0)
  ) ORDER BY m DESC), '[]'::jsonb)
  INTO v_monthly
  FROM (
    SELECT gs.m,
      COUNT(o.id) AS orders_cnt,
      COALESCE(SUM(o.total), 0) AS rev,
      COALESCE(SUM(o.commission), 0) AS comm
    FROM generate_series(v_monthly_start, date_trunc('month', now()), interval '1 month') AS gs(m)
    LEFT JOIN public.orders o ON date_trunc('month', o.created_at) = gs.m AND o.deleted_at IS NULL
    GROUP BY gs.m
  ) sub;

  RETURN jsonb_build_object(
    'platform_revenue', v_platform_revenue,
    'total_commission', v_total_commission,
    'vendor_payouts', v_vendor_payouts,
    'total_orders', v_total_orders,
    'completed_orders', v_completed_orders,
    'active_vendors', v_active_vendors,
    'today', jsonb_build_object('revenue', v_today_revenue, 'orders', v_today_orders),
    'week', jsonb_build_object('revenue', v_week_revenue, 'orders', v_week_orders),
    'month', jsonb_build_object('revenue', v_month_revenue, 'orders', v_month_orders),
    'top_sellers', v_top_sellers,
    'top_products', v_top_products,
    'daily', v_daily,
    'weekly', v_weekly,
    'monthly', v_monthly
  );
END;
$function$;

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
  -- vendor_stats are cumulative (all-time), always shown alongside
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

  -- When a date filter is active, override the cumulative stats with
  -- period-filtered aggregates from the orders table
  IF p_start_date IS NOT NULL THEN
    SELECT
      COALESCE(SUM(total), 0),
      COUNT(*),
      COUNT(*) FILTER (WHERE status IN ('delivered', 'picked_up')),
      COUNT(*) FILTER (WHERE status = 'cancelled'),
      COALESCE(SUM(commission), 0),
      COALESCE(SUM(vendor_amount), 0)
    INTO
      v_total_sales, v_total_orders, v_completed_orders, v_cancelled_orders,
      v_total_commission, v_vendor_revenue
    FROM public.orders
    WHERE vendor_id = p_vendor_id AND deleted_at IS NULL AND created_at >= p_start_date;
  END IF;

  -- Period summaries are always relative to now
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

GRANT EXECUTE ON FUNCTION public.get_admin_analytics(timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_vendor_dashboard(uuid, timestamptz) TO authenticated;
