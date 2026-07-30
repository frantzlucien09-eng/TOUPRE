/*
  Classified public visibility + no marketplace purchase for Kay/Machin

  - Public SELECT: classifieds only when active and not expired
  - place_order: reject Kay/Machin product line items
  - Expired rows are never deleted (app soft-expire only)
*/

-- Public catalog: physical goods stay active=true; classifieds need live ad window
DROP POLICY IF EXISTS anon_select_products ON public.products;
CREATE POLICY anon_select_products ON public.products FOR SELECT
  TO anon, authenticated
  USING (
    deleted_at IS NULL
    AND (
      (
        category IS DISTINCT FROM 'kay'
        AND category IS DISTINCT FROM 'machin'
        AND active = true
      )
      OR (
        category IN ('kay', 'machin')
        AND active = true
        AND COALESCE(ad_status, '') = 'active'
        AND COALESCE(status, '') = 'active'
        AND (ad_expires_at IS NULL OR ad_expires_at > now())
      )
    )
  );

-- Keep a matching public_read policy if present (OR'd with others)
DROP POLICY IF EXISTS public_read_products ON public.products;
CREATE POLICY public_read_products ON public.products FOR SELECT
  TO anon, authenticated
  USING (
    deleted_at IS NULL
    AND (
      (
        category IS DISTINCT FROM 'kay'
        AND category IS DISTINCT FROM 'machin'
        AND active = true
      )
      OR (
        category IN ('kay', 'machin')
        AND active = true
        AND COALESCE(ad_status, '') = 'active'
        AND COALESCE(status, '') = 'active'
        AND (ad_expires_at IS NULL OR ad_expires_at > now())
      )
    )
  );

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
  v_product_id uuid;
  v_category text;
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

  -- Classified ads (Kay / Machin) are contact-only — never marketplace orders
  IF p_items IS NOT NULL AND jsonb_typeof(p_items) = 'array' THEN
    FOR v_item IN SELECT jsonb_array_elements(p_items) LOOP
      v_product_id := NULLIF(v_item->>'product_id', '')::uuid;
      IF v_product_id IS NOT NULL THEN
        SELECT category INTO v_category FROM public.products WHERE id = v_product_id;
        IF v_category IN ('kay', 'machin') THEN
          RETURN jsonb_build_object(
            'success', false,
            'error', 'Anons Kay/Machin se pou kontak vandè sèlman — pa nan kòmand.'
          );
        END IF;
      END IF;
    END LOOP;
  END IF;

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
