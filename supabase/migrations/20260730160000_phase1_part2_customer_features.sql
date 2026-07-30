/*
  Phase 1 Part 2 — Customer feature alignment

  Ensures existing remote tables (addresses, recent_views) have the columns
  the customer app needs. Adds vendor_favorites (no prior table) and
  customer_cancel_order RPC (customers cannot use update_order_status).

  Does NOT drop or replace existing RLS policies on addresses / recent_views /
  favorites / orders.
*/

-- ============ addresses (reuse existing table) ============
CREATE TABLE IF NOT EXISTS public.addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label text,
  full_name text,
  phone text,
  address text,
  city text,
  department text,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.addresses
  ADD COLUMN IF NOT EXISTS label text,
  ADD COLUMN IF NOT EXISTS full_name text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS department text,
  ADD COLUMN IF NOT EXISTS is_default boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_addresses_user_id ON public.addresses (user_id);

-- ============ recent_views (reuse existing table) ============
CREATE TABLE IF NOT EXISTS public.recent_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  viewed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, product_id)
);

ALTER TABLE public.recent_views
  ADD COLUMN IF NOT EXISTS viewed_at timestamptz DEFAULT now();

ALTER TABLE public.recent_views ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_recent_views_user_viewed
  ON public.recent_views (user_id, viewed_at DESC);

-- ============ vendor_favorites (no prior table in schema) ============
CREATE TABLE IF NOT EXISTS public.vendor_favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE (user_id, vendor_id)
);

ALTER TABLE public.vendor_favorites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "customer_select_own_vendor_favorites" ON public.vendor_favorites;
CREATE POLICY "customer_select_own_vendor_favorites" ON public.vendor_favorites
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "customer_insert_own_vendor_favorites" ON public.vendor_favorites;
CREATE POLICY "customer_insert_own_vendor_favorites" ON public.vendor_favorites
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "customer_update_own_vendor_favorites" ON public.vendor_favorites;
CREATE POLICY "customer_update_own_vendor_favorites" ON public.vendor_favorites
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "customer_delete_own_vendor_favorites" ON public.vendor_favorites;
CREATE POLICY "customer_delete_own_vendor_favorites" ON public.vendor_favorites
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_vendor_favorites_user
  ON public.vendor_favorites (user_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_vendor_favorites_vendor
  ON public.vendor_favorites (vendor_id) WHERE deleted_at IS NULL;

-- ============ customer_cancel_order (pending only) ============
CREATE OR REPLACE FUNCTION public.customer_cancel_order(
  p_order_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_order record;
  v_vendor_user_id uuid;
BEGIN
  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Kòmand pa egziste');
  END IF;

  IF v_order.customer_id IS DISTINCT FROM auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ou pa otorize pou w anile kòmand sa a');
  END IF;

  IF v_order.status IS DISTINCT FROM 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ou ka anile sèlman anvan vandè a aksepte');
  END IF;

  UPDATE public.orders
  SET
    status = 'cancelled',
    reject_reason = COALESCE(NULLIF(trim(p_reason), ''), 'Kliyan anile'),
    updated_at = now(),
    completed_at = now()
  WHERE id = p_order_id;

  SELECT user_id INTO v_vendor_user_id
  FROM public.vendors
  WHERE id = v_order.vendor_id AND deleted_at IS NULL;

  IF v_vendor_user_id IS NOT NULL THEN
    BEGIN
      PERFORM public.notify_user(
        v_vendor_user_id,
        'order',
        'Kòmand Anile',
        'Kliyan anile kòmand #' || COALESCE(v_order.order_number, p_order_id::text),
        jsonb_build_object('order_id', p_order_id, 'status', 'cancelled')
      );
    EXCEPTION WHEN undefined_function THEN
      NULL;
    END;
  END IF;

  RETURN jsonb_build_object('success', true, 'order_id', p_order_id);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.customer_cancel_order(uuid, text) TO authenticated;
