/*
# Fix: get_effective_commission_rate uses wrong column name
The vendors table has commission_rate, not custom_commission_rate
*/

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
  SELECT commission_rate INTO v_vendor_rate
  FROM public.vendors
  WHERE id = p_vendor_id AND deleted_at IS NULL AND commission_rate IS NOT NULL;

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
