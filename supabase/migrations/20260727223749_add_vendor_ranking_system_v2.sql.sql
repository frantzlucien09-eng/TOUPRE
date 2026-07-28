/*
# Vendor Ranking System + Product Stats (v2 - deadlock fix)

Adds real-time vendor ranking (zone + national) and product statistics.
Uses a session guard to prevent recursive trigger deadlocks.

## New Tables
- `vendor_rankings` — real-time vendor ranking snapshot with zone_rank, national_rank, score

## Modified Tables
- `products` — added search_count, view_count, sold_count, first_sold_at, last_sold_at

## Functions
- `recalculate_vendor_rankings()` — recomputes all vendor scores and ranks
- `increment_product_search(p_product_id)` — increments search_count
- `increment_product_view(p_product_id)` — increments view_count
- `get_vendor_rank(p_vendor_id)` — returns vendor's current rank

## Triggers
- After INSERT/UPDATE on orders (status=delivered) → recalc rankings + update product sold_count
- After INSERT/UPDATE on products → recalc rankings (with recursion guard)
- After UPDATE on vendors (rating/trust/department changes) → recalc rankings (with recursion guard)
*/

-- 1. Product stats columns
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS search_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS view_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sold_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS first_sold_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_sold_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_products_search_count ON public.products (search_count DESC);
CREATE INDEX IF NOT EXISTS idx_products_sold_count ON public.products (sold_count DESC);

-- 2. vendor_rankings table
CREATE TABLE IF NOT EXISTS public.vendor_rankings (
  vendor_id uuid PRIMARY KEY REFERENCES public.vendors(id) ON DELETE CASCADE,
  zone_rank integer,
  national_rank integer,
  score numeric NOT NULL DEFAULT 0,
  total_sales_count integer NOT NULL DEFAULT 0,
  total_revenue numeric NOT NULL DEFAULT 0,
  avg_rating numeric NOT NULL DEFAULT 0,
  complaints_count integer NOT NULL DEFAULT 0,
  department text,
  city text,
  business_name text,
  avatar_url text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.vendor_rankings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vendor_read_all_rankings" ON public.vendor_rankings;
CREATE POLICY "vendor_read_all_rankings" ON public.vendor_rankings FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "admin_manage_rankings" ON public.vendor_rankings;
CREATE POLICY "admin_manage_rankings" ON public.vendor_rankings FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_profiles WHERE user_id = auth.uid() AND is_active = true AND deleted_at IS NULL))
  WITH CHECK (EXISTS (SELECT 1 FROM public.admin_profiles WHERE user_id = auth.uid() AND is_active = true AND deleted_at IS NULL));

ALTER TABLE public.vendor_rankings REPLICA IDENTITY FULL;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='vendor_rankings') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.vendor_rankings;
  END IF;
END $$;

-- 3. Ranking calculation function (with recursion guard)
CREATE OR REPLACE FUNCTION public.recalculate_vendor_rankings()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_row record;
  v_score numeric;
  v_old_zone_rank integer;
  v_old_national_rank integer;
  v_new_zone_rank integer;
  v_new_national_rank integer;
BEGIN
  -- Recursion guard: skip if already recalculating
  IF current_setting('app.recalc_rankings', true) = 'on' THEN
    RETURN;
  END IF;
  PERFORM set_config('app.recalc_rankings', 'on', true);

  -- Gather stats and upsert
  FOR v_row IN
    SELECT
      v.id as vendor_id, v.department, v.city, v.business_name, v.avatar_url,
      COALESCE(v.rating_average, 0) as rating_average,
      COALESCE(v.trust_score, 100) as trust_score,
      COALESCE(v.total_products, 0) as total_products,
      (SELECT COUNT(*) FROM public.orders o WHERE o.vendor_id = v.id AND o.status = 'delivered' AND o.deleted_at IS NULL) as sales_count,
      (SELECT COALESCE(SUM(o.total), 0) FROM public.orders o WHERE o.vendor_id = v.id AND o.status = 'delivered' AND o.deleted_at IS NULL) as revenue,
      (SELECT COUNT(*) FROM public.trust_history th WHERE th.vendor_id = v.id AND th.delta < 0) as complaints_count
    FROM public.vendors v WHERE v.deleted_at IS NULL
  LOOP
    v_score := (
      v_row.sales_count * 10 +
      v_row.revenue * 0.01 +
      v_row.rating_average * 5 +
      v_row.trust_score * 0.5 +
      v_row.total_products * 2 -
      v_row.complaints_count * 15
    );

    SELECT zone_rank, national_rank INTO v_old_zone_rank, v_old_national_rank
      FROM public.vendor_rankings WHERE vendor_id = v_row.vendor_id;

    INSERT INTO public.vendor_rankings (
      vendor_id, score, total_sales_count, total_revenue, avg_rating,
      complaints_count, department, city, business_name, avatar_url, updated_at
    ) VALUES (
      v_row.vendor_id, v_score, v_row.sales_count, v_row.revenue, v_row.rating_average,
      v_row.complaints_count, v_row.department, v_row.city, v_row.business_name, v_row.avatar_url, now()
    )
    ON CONFLICT (vendor_id) DO UPDATE SET
      score = EXCLUDED.score,
      total_sales_count = EXCLUDED.total_sales_count,
      total_revenue = EXCLUDED.total_revenue,
      avg_rating = EXCLUDED.avg_rating,
      complaints_count = EXCLUDED.complaints_count,
      department = EXCLUDED.department,
      city = EXCLUDED.city,
      business_name = EXCLUDED.business_name,
      avatar_url = EXCLUDED.avatar_url,
      updated_at = now();

    SELECT zone_rank, national_rank INTO v_new_zone_rank, v_new_national_rank
      FROM public.vendor_rankings WHERE vendor_id = v_row.vendor_id;

    -- Notify on zone rank change
    IF v_old_zone_rank IS NOT NULL AND v_new_zone_rank IS NOT NULL AND v_new_zone_rank <> v_old_zone_rank THEN
      INSERT INTO public.notifications (user_id, type, title, body, data, is_read, read)
      VALUES (
        v_row.vendor_id, 'ranking',
        CASE WHEN v_new_zone_rank < v_old_zone_rank THEN 'Ou monte nan Top Zòn!' ELSE 'Pozisyon ou chanje nan Zòn' END,
        CASE WHEN v_new_zone_rank < v_old_zone_rank
          THEN format('Ou monte nan pozisyon #%s nan Top Zòn ou!', v_new_zone_rank)
          ELSE format('Ou desann nan pozisyon #%s nan Top Zòn ou.', v_new_zone_rank) END,
        jsonb_build_object('rank_type', 'zone', 'new_rank', v_new_zone_rank, 'old_rank', v_old_zone_rank),
        false, false
      ) ON CONFLICT DO NOTHING;
    END IF;

    -- Notify on national rank change
    IF v_old_national_rank IS NOT NULL AND v_new_national_rank IS NOT NULL AND v_new_national_rank <> v_old_national_rank THEN
      INSERT INTO public.notifications (user_id, type, title, body, data, is_read, read)
      VALUES (
        v_row.vendor_id, 'ranking',
        CASE WHEN v_new_national_rank < v_old_national_rank THEN 'Ou monte nan Top Nasyonal!' ELSE 'Pozisyon ou chanje nan Nasyonal' END,
        CASE WHEN v_new_national_rank < v_old_national_rank
          THEN format('Ou monte nan pozisyon #%s nan Top Nasyonal!', v_new_national_rank)
          ELSE format('Ou desann nan pozisyon #%s nan Top Nasyonal.', v_new_national_rank) END,
        jsonb_build_object('rank_type', 'national', 'new_rank', v_new_national_rank, 'old_rank', v_old_national_rank),
        false, false
      ) ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;

  -- Compute national ranks
  WITH ranked AS (
    SELECT vendor_id, ROW_NUMBER() OVER (ORDER BY score DESC, total_sales_count DESC, avg_rating DESC) as nat_rank
    FROM public.vendor_rankings
  )
  UPDATE public.vendor_rankings vr SET national_rank = ranked.nat_rank
    FROM ranked WHERE vr.vendor_id = ranked.vendor_id;

  -- Compute zone ranks
  WITH zone_ranked AS (
    SELECT vendor_id, ROW_NUMBER() OVER (PARTITION BY department ORDER BY score DESC, total_sales_count DESC, avg_rating DESC) as z_rank
    FROM public.vendor_rankings WHERE department IS NOT NULL
  )
  UPDATE public.vendor_rankings vr SET zone_rank = zone_ranked.z_rank
    FROM zone_ranked WHERE vr.vendor_id = zone_ranked.vendor_id;

  PERFORM set_config('app.recalc_rankings', 'off', true);
END;
$function$;

-- 4. Trigger on orders
CREATE OR REPLACE FUNCTION public.trigger_recalc_on_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  IF (NEW.status = 'delivered' OR (OLD.status = 'delivered' AND NEW.status <> 'delivered'))
     AND NEW.deleted_at IS NULL THEN
    PERFORM public.recalculate_vendor_rankings();

    IF NEW.status = 'delivered' AND (TG_OP = 'INSERT' OR OLD.status <> 'delivered') THEN
      UPDATE public.products
        SET sold_count = sold_count + 1, last_sold_at = now(),
            first_sold_at = COALESCE(first_sold_at, now()), updated_at = now()
        WHERE vendor_id = NEW.vendor_id AND deleted_at IS NULL
          AND id IN (SELECT (item->>'product_id')::uuid FROM jsonb_array_elements(COALESCE(NEW.items, '[]'::jsonb)) AS item WHERE item->>'product_id' IS NOT NULL);
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_recalc_on_order ON public.orders;
CREATE TRIGGER trg_recalc_on_order AFTER INSERT OR UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.trigger_recalc_on_order();

-- 5. Trigger on products (NO vendor update to avoid recursion)
CREATE OR REPLACE FUNCTION public.trigger_recalc_on_product()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.active <> OLD.active) THEN
    PERFORM public.recalculate_vendor_rankings();
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_recalc_on_product ON public.products;
CREATE TRIGGER trg_recalc_on_product AFTER INSERT OR UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.trigger_recalc_on_product();

-- 6. Trigger on vendors
CREATE OR REPLACE FUNCTION public.trigger_recalc_on_vendor()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  IF COALESCE(NEW.rating_average, 0) <> COALESCE(OLD.rating_average, 0)
     OR COALESCE(NEW.trust_score, 0) <> COALESCE(OLD.trust_score, 0)
     OR COALESCE(NEW.total_sales, 0) <> COALESCE(OLD.total_sales, 0)
     OR COALESCE(NEW.department, '') <> COALESCE(OLD.department, '') THEN
    PERFORM public.recalculate_vendor_rankings();
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_recalc_on_vendor ON public.vendors;
CREATE TRIGGER trg_recalc_on_vendor AFTER UPDATE ON public.vendors
  FOR EACH ROW EXECUTE FUNCTION public.trigger_recalc_on_vendor();

-- 7. RPCs
CREATE OR REPLACE FUNCTION public.increment_product_search(p_product_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $function$
BEGIN
  UPDATE public.products SET search_count = search_count + 1 WHERE id = p_product_id AND deleted_at IS NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.increment_product_view(p_product_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $function$
BEGIN
  UPDATE public.products SET view_count = view_count + 1 WHERE id = p_product_id AND deleted_at IS NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_vendor_rank(p_vendor_id uuid)
RETURNS TABLE(zone_rank integer, national_rank integer, score numeric, total_sales_count integer, total_revenue numeric, avg_rating numeric)
LANGUAGE plpgsql SECURITY DEFINER AS $function$
BEGIN
  SELECT zone_rank, national_rank, score, total_sales_count, total_revenue, avg_rating
  INTO zone_rank, national_rank, score, total_sales_count, total_revenue, avg_rating
  FROM public.vendor_rankings WHERE vendor_id = p_vendor_id;
  RETURN NEXT;
END;
$function$;

-- 8. Initial population (separate step to avoid deadlock)
SELECT public.recalculate_vendor_rankings();
