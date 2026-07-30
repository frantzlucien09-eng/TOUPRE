/*
  Phase 1 — Customer commerce schema alignment

  1. Ensure customers.user_id / deleted_at exist (place_order checks user_id)
  2. Create carts + cart_items if missing (RLS policies already reference them)
  3. Fix place_order customer lookup to accept id OR user_id = auth.uid()
*/

-- ============ customers alignment ============
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

UPDATE public.customers
SET user_id = id
WHERE user_id IS NULL AND id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_customers_user_id ON public.customers (user_id);

-- ============ carts ============
CREATE TABLE IF NOT EXISTS public.carts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

ALTER TABLE public.carts ENABLE ROW LEVEL SECURITY;

-- ============ cart_items ============
CREATE TABLE IF NOT EXISTS public.cart_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id uuid NOT NULL REFERENCES public.carts(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cart_id, product_id)
);

ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_cart_items_cart_id ON public.cart_items (cart_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_product_id ON public.cart_items (product_id);

-- ============ place_order: accept customers.id or customers.user_id = auth.uid() ============
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
  v_customer_ok boolean;
BEGIN
  IF p_customer_id IS NULL OR p_customer_id != auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ou pa otorize pou w pase kòmand sa a');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.customers c
    WHERE (c.user_id = auth.uid() OR c.id = auth.uid())
      AND c.deleted_at IS NULL
  ) INTO v_customer_ok;

  IF NOT v_customer_ok THEN
    RETURN jsonb_build_object('success', false, 'error', 'Kont kliyan pa egziste');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.vendors WHERE id = p_vendor_id AND deleted_at IS NULL) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Vandè sa a pa egziste');
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

GRANT EXECUTE ON FUNCTION public.place_order TO authenticated;
