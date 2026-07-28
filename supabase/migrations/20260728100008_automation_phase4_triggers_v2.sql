/*
# Phase 4: Withdrawal Balance Trigger + Product Favorites Trigger
*/

-- 1. Withdrawal status change → update vendor stats
DROP FUNCTION IF EXISTS public.update_vendor_stats_on_withdrawal() CASCADE;
CREATE OR REPLACE FUNCTION public.update_vendor_stats_on_withdrawal()
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
      IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
        PERFORM public.update_vendor_stats(v_vendor_id);
      ELSIF TG_OP = 'INSERT' THEN
        PERFORM public.update_vendor_stats(v_vendor_id);
      END IF;
    EXCEPTION WHEN OTHERS THEN
      PERFORM public.log_automation_error(
        'trg_withdrawal_stats', 'update_vendor_stats_on_withdrawal',
        SQLERRM, NULL, NULL,
        jsonb_build_object('vendor_id', v_vendor_id, 'withdrawal_id', COALESCE(NEW.id, OLD.id), 'op', TG_OP)
      );
    END;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$function$;

DROP TRIGGER IF EXISTS trg_withdrawal_stats ON public.withdrawals;
CREATE TRIGGER trg_withdrawal_stats
  AFTER INSERT OR UPDATE OF status ON public.withdrawals
  FOR EACH ROW EXECUTE FUNCTION public.update_vendor_stats_on_withdrawal();

-- 2. Favorites trigger → update product favorite_count
DROP FUNCTION IF EXISTS public.update_product_favorite_count() CASCADE;
CREATE OR REPLACE FUNCTION public.update_product_favorite_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_product_id uuid;
BEGIN
  v_product_id := COALESCE(NEW.product_id, OLD.product_id);
  IF v_product_id IS NOT NULL THEN
    BEGIN
      UPDATE public.products
      SET favorite_count = (
        SELECT COUNT(*) FROM public.favorites
        WHERE product_id = v_product_id AND deleted_at IS NULL
      )
      WHERE id = v_product_id;

      UPDATE public.product_stats
      SET favorite_count = (
        SELECT COUNT(*) FROM public.favorites
        WHERE product_id = v_product_id AND deleted_at IS NULL
      ),
      computed_at = now()
      WHERE product_id = v_product_id;
    EXCEPTION WHEN OTHERS THEN
      PERFORM public.log_automation_error(
        'trg_product_favorites', 'update_product_favorite_count',
        SQLERRM, NULL, NULL,
        jsonb_build_object('product_id', v_product_id, 'op', TG_OP)
      );
    END;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$function$;

DROP TRIGGER IF EXISTS trg_product_favorites ON public.favorites;
CREATE TRIGGER trg_product_favorites
  AFTER INSERT OR DELETE ON public.favorites
  FOR EACH ROW EXECUTE FUNCTION public.update_product_favorite_count();

-- 3. Update get_top_products to include favorite_count
DROP FUNCTION IF EXISTS public.get_top_products(integer) CASCADE;
CREATE OR REPLACE FUNCTION public.get_top_products(p_limit integer DEFAULT 10)
RETURNS TABLE(
  product_id uuid,
  product_name text,
  vendor_id uuid,
  vendor_name text,
  price numeric,
  sold_count integer,
  rating_average numeric,
  rating_count integer,
  view_count integer,
  search_count integer,
  favorite_count integer,
  image_url text,
  category text,
  estimated_revenue numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    p.id, p.name, p.vendor_id, v.business_name, p.price,
    p.sold_count, p.rating_average, p.rating_count,
    p.view_count, p.search_count, p.favorite_count,
    p.image_url, p.category, (p.sold_count * p.price)
  FROM public.products p
  LEFT JOIN public.vendors v ON v.id = p.vendor_id AND v.deleted_at IS NULL
  WHERE p.deleted_at IS NULL AND p.sold_count > 0
  ORDER BY p.sold_count DESC, (p.sold_count * p.price) DESC
  LIMIT p_limit;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_top_products(integer) TO authenticated;
