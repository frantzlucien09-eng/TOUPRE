/*
# Fix get_admin_analytics: Use Correct Column Names

## Context
The products table uses `sold_count` not `sales_count`. The previous migration
referenced the wrong column name, causing the RPC to error.

## Changes:
- Changed p.sales_count → p.sold_count in the top_products query
- The frontend type still uses sales_count as the JSON key, which is fine
*/

DROP FUNCTION IF EXISTS public.get_admin_analytics();

CREATE FUNCTION public.get_admin_analytics()
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
BEGIN
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
  WHERE o.deleted_at IS NULL;

  SELECT COUNT(*) INTO v_active_vendors
  FROM public.vendors
  WHERE deleted_at IS NULL AND status IN ('active', 'aktif');

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

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'vendor_id', vs.vendor_id,
    'business_name', v.business_name,
    'avatar_url', v.avatar_url,
    'total_sales', vs.total_sales,
    'completed_orders', vs.completed_orders,
    'vendor_revenue', vs.vendor_revenue,
    'total_commission', vs.total_commission,
    'average_rating', vs.average_rating,
    'ranking', vs.ranking,
    'seller_badge', vs.seller_badge
  ) ORDER BY vs.total_sales DESC), '[]'::jsonb)
  INTO v_top_sellers
  FROM public.vendor_stats vs
  JOIN public.vendors v ON v.id = vs.vendor_id AND v.deleted_at IS NULL
  LIMIT 20;

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

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'day', d::date::text,
    'orders', COALESCE(orders_cnt, 0),
    'revenue', COALESCE(rev, 0),
    'commission', COALESCE(comm, 0)
  ) ORDER BY d DESC), '[]'::jsonb)
  INTO v_daily
  FROM (
    SELECT
      gs.d,
      COUNT(o.id) AS orders_cnt,
      COALESCE(SUM(o.total), 0) AS rev,
      COALESCE(SUM(o.commission), 0) AS comm
    FROM generate_series(
      date_trunc('day', now()) - interval '29 days',
      date_trunc('day', now()),
      interval '1 day'
    ) AS gs(d)
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
    SELECT
      gs.w,
      COUNT(o.id) AS orders_cnt,
      COALESCE(SUM(o.total), 0) AS rev,
      COALESCE(SUM(o.commission), 0) AS comm
    FROM generate_series(
      date_trunc('week', now()) - interval '11 weeks',
      date_trunc('week', now()),
      interval '1 week'
    ) AS gs(w)
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
    SELECT
      gs.m,
      COUNT(o.id) AS orders_cnt,
      COALESCE(SUM(o.total), 0) AS rev,
      COALESCE(SUM(o.commission), 0) AS comm
    FROM generate_series(
      date_trunc('month', now()) - interval '11 months',
      date_trunc('month', now()),
      interval '1 month'
    ) AS gs(m)
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

GRANT EXECUTE ON FUNCTION public.get_admin_analytics TO authenticated;
