/*
# Cleanup Duplicate Infrastructure and Consolidate on Production Tables

## Context
A prior migration (add_vendor_stats_and_configurable_commission) created duplicate
tables, functions, policies, and triggers that conflict with pre-existing, more
advanced infrastructure. This migration removes the duplicates and consolidates
everything onto the production-quality tables that were already in place.

## What's being removed (duplicates of pre-existing infrastructure):
1. `badge_thresholds` table — duplicate of `seller_badge_thresholds`
2. `get_commission_rate()` function — redundant; `get_effective_commission_rate()` is superior
3. `assign_seller_badge(uuid)` function — duplicate of `assign_seller_badges(uuid)`
4. `update_vendor_stats(uuid)` function — duplicate of `recalculate_vendor_stats(uuid)`
5. `vendor_stats_select_own` + `vendor_stats_update_own` RLS policies — duplicate of
   `vendor_select_own_stats` + `admin_select_all_vendor_stats`
6. `trg_recalc_on_order` trigger — duplicate of `trg_update_vendor_stats`

## What's being kept (the production infrastructure):
- `commission_config` table + `get_effective_commission_rate(vendor_id, order_total)`
  — supports tiered, vendor-specific, and fallback commission rates
- `seller_badge_thresholds` table + `assign_seller_badges()` function
- `recalculate_vendor_stats(vendor_id)` — the canonical stats aggregation
- `update_vendor_stats_on_order()` + `trg_update_vendor_stats` trigger
- `vendor_rankings` table + `recalculate_vendor_rankings()` function
- `vendor_stats` table (kept, it's the right table)

## What's being fixed:
1. `trigger_recalc_on_order()` is rewritten to ONLY call `recalculate_vendor_rankings()`
   (the ranking recalc), NOT stats — stats are handled by `trg_update_vendor_stats`.
   This eliminates double computation.
2. `calculate_order_commission()` already uses `get_effective_commission_rate()` — no change needed.
3. `place_order()` RPC is updated to use `get_effective_commission_rate()` instead of
   the now-dropped `get_commission_rate()`.
4. RLS on `vendor_stats`: duplicate policies removed, keeping the pre-existing ones.

## Security
- No changes to RLS on commission_config or seller_badge_thresholds (already correct).
- Duplicate vendor_stats policies dropped; pre-existing ones remain.

## Important Notes
1. The `trg_recalc_on_order` trigger is NOT dropped — only its function is replaced
   with `CREATE OR REPLACE`. The trigger itself stays attached to the table.
2. The `trg_update_vendor_stats` trigger (AFTER INSERT OR DELETE OR UPDATE) is the
   single source of truth for vendor_stats synchronization.
3. `trg_recalc_on_order` (AFTER INSERT OR UPDATE) now only handles ranking recalculation.
4. Both triggers coexist: stats update on every order change, rankings recalc on
   status transitions to delivered.
*/

-- ============ 1. Drop duplicate badge_thresholds table ============
DROP TABLE IF EXISTS public.badge_thresholds CASCADE;

-- ============ 2. Drop duplicate get_commission_rate function ============
DROP FUNCTION IF EXISTS public.get_commission_rate();

-- ============ 3. Drop duplicate assign_seller_badge function ============
DROP FUNCTION IF EXISTS public.assign_seller_badge(uuid);

-- ============ 4. Drop duplicate update_vendor_stats function ============
-- This is the one that takes a uuid arg and returns void — same signature as
-- recalculate_vendor_stats. We keep recalculate_vendor_stats.
-- But first, we need to update trigger_recalc_on_order to NOT call this function.
CREATE OR REPLACE FUNCTION public.trigger_recalc_on_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Only recalculate rankings when an order transitions to delivered status.
  -- Vendor stats are handled by the separate trg_update_vendor_stats trigger
  -- which fires on INSERT, UPDATE, and DELETE.
  IF NEW.status IN ('livre', 'completed', 'delivered', 'picked_up')
     AND (TG_OP = 'INSERT' OR OLD.status NOT IN ('livre', 'completed', 'delivered', 'picked_up'))
  THEN
    PERFORM public.recalculate_vendor_rankings();
  END IF;

  RETURN NEW;
END;
$function$;

-- Now safe to drop the duplicate function
DROP FUNCTION IF EXISTS public.update_vendor_stats(uuid);

-- ============ 5. Drop duplicate RLS policies on vendor_stats ============
DROP POLICY IF EXISTS "vendor_stats_select_own" ON public.vendor_stats;
DROP POLICY IF EXISTS "vendor_stats_update_own" ON public.vendor_stats;

-- ============ 6. Update place_order to use get_effective_commission_rate ============
CREATE OR REPLACE FUNCTION public.place_order(
  p_customer_id uuid,
  p_vendor_id uuid,
  p_items jsonb,
  p_subtotal numeric DEFAULT 0,
  p_shipping_cost numeric DEFAULT 0,
  p_total numeric DEFAULT 0,
  p_delivery_type text DEFAULT 'delivery',
  p_shipping_address jsonb DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_payment_status text DEFAULT 'unpaid'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_order_id uuid;
  v_order_number text;
  v_item jsonb;
  v_commission numeric;
  v_rate numeric;
BEGIN
  IF p_customer_id IS NULL OR p_customer_id != auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ou pa otorize pou w pase kòmand sa a');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM customers WHERE user_id = auth.uid() AND deleted_at IS NULL) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Kont kliyan pa egziste');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM vendors WHERE id = p_vendor_id AND deleted_at IS NULL) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Vandè sa a pa egziste');
  END IF;

  -- Use the production commission function that supports tiers + vendor overrides
  v_rate := public.get_effective_commission_rate(p_vendor_id, p_total);
  v_commission := ROUND(p_total * (v_rate / 100.0), 2);

  INSERT INTO public.orders (
    customer_id, vendor_id, status, subtotal, shipping_cost, total,
    commission, payment_status, delivery_type, shipping_address, notes, items
  ) VALUES (
    p_customer_id, p_vendor_id, 'pending', p_subtotal, p_shipping_cost, p_total,
    v_commission, p_payment_status, p_delivery_type, p_shipping_address, p_notes, p_items
  )
  RETURNING id, order_number INTO v_order_id, v_order_number;

  IF p_items IS NOT NULL AND jsonb_typeof(p_items) = 'array' THEN
    FOR v_item IN SELECT jsonb_array_elements(p_items) LOOP
      INSERT INTO public.order_items (order_id, product_id, product_name, quantity, unit_price, subtotal)
      VALUES (
        v_order_id,
        NULLIF(v_item->>'product_id', '')::uuid,
        v_item->>'product_name',
        COALESCE((v_item->>'quantity')::integer, 1),
        COALESCE((v_item->>'unit_price')::numeric, 0),
        COALESCE((v_item->>'subtotal')::numeric, 0)
      );
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'order_number', v_order_number
  );
END;
$function$;

-- ============ 7. Grant execute on remaining RPCs ============
GRANT EXECUTE ON FUNCTION public.get_admin_analytics TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_vendor_dashboard(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_top_sellers(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_top_products(integer) TO authenticated;
