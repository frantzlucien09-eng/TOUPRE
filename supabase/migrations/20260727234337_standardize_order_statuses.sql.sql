/*
# Standardize Order Status System

Official statuses (English in DB, Creole display):
- pending → "Nouvo" (vendor) / "An Atant" (customer)
- accepted → "Aksepte" (vendor) / "Konfime" (customer)
- preparing → "An Preparasyon" (both)
- ready_pickup → "Pare pou Retire" (pickup)
- delivering → "Ap Livre" (vendor) / "Vandè a Ap Vini" (customer)
- delivered → "Livre" (both)
- picked_up → "Kliyan Retire l" (vendor) / "Retire" (customer)
- cancelled → "Anile" (both)

Flow:
- Delivery: pending → accepted → preparing → delivering → delivered
- Pickup: pending → accepted → preparing → ready_pickup → picked_up
- Any step → cancelled
*/

-- ============================================================
-- 1. Migrate existing data to official statuses
-- ============================================================
UPDATE public.orders SET status = 'pending' WHERE status = 'new';
UPDATE public.orders SET status = 'pending' WHERE status = 'en_attente';
UPDATE public.orders SET status = 'accepted' WHERE status = 'confirmed';
UPDATE public.orders SET status = 'preparing' WHERE status = 'an_preparasyon';
UPDATE public.orders SET status = 'delivering' WHERE status = 'ap_livre';
UPDATE public.orders SET status = 'delivering' WHERE status = 'shipping';
UPDATE public.orders SET status = 'ready_pickup' WHERE status = 'ready';
UPDATE public.orders SET status = 'ready_pickup' WHERE status = 'pare_retire';
UPDATE public.orders SET status = 'delivered' WHERE status = 'livre';
UPDATE public.orders SET status = 'picked_up' WHERE status = 'pickedup';
UPDATE public.orders SET status = 'cancelled' WHERE status = 'anile';
UPDATE public.orders SET status = 'cancelled' WHERE status = 'refunded';

-- ============================================================
-- 2. Update constraint to only allow official statuses
-- ============================================================
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;

ALTER TABLE public.orders ADD CONSTRAINT orders_status_check
  CHECK (status = ANY (ARRAY[
    'pending'::text,
    'accepted'::text,
    'preparing'::text,
    'ready_pickup'::text,
    'delivering'::text,
    'delivered'::text,
    'picked_up'::text,
    'cancelled'::text
  ]));

-- ============================================================
-- 3. Create order_status_history table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.order_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  status text NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone_select_order_status_history" ON public.order_status_history FOR SELECT
  TO anon, authenticated USING (true);

CREATE POLICY "authed_insert_order_status_history" ON public.order_status_history FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_order_status_history_order ON public.order_status_history(order_id);

-- ============================================================
-- 4. Auto-log status changes via trigger
-- ============================================================
CREATE OR REPLACE FUNCTION public.log_order_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.order_status_history (order_id, status, created_at)
    VALUES (NEW.id, NEW.status, NEW.created_at);
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.order_status_history (order_id, status, created_at)
    VALUES (NEW.id, NEW.status, now());
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_log_order_status ON public.orders;
CREATE TRIGGER trg_log_order_status
  AFTER INSERT OR UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.log_order_status_change();

-- ============================================================
-- 5. update_order_status RPC — updates status + notifies customer
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_order_status(
  p_order_id uuid,
  p_new_status text,
  p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_order record;
  v_customer_user_id uuid;
  v_notif_title text;
  v_notif_body text;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Kòmand pa egziste');
  END IF;

  -- Update the order
  UPDATE public.orders
  SET status = p_new_status,
      updated_at = now(),
      completed_at = CASE WHEN p_new_status IN ('delivered', 'picked_up', 'cancelled') THEN now() ELSE completed_at END
  WHERE id = p_order_id;

  -- Determine notification text
  v_notif_title := CASE p_new_status
    WHEN 'accepted' THEN 'Kòmand Konfime!'
    WHEN 'preparing' THEN 'Kòmand Ap Prepare'
    WHEN 'delivering' THEN 'Vandè a Ap Vini!'
    WHEN 'ready_pickup' THEN 'Kòmand Pare pou Retire!'
    WHEN 'delivered' THEN 'Kòmand ou LIVRE!'
    WHEN 'picked_up' THEN 'Kòmand Retire!'
    WHEN 'cancelled' THEN 'Kòmand Anile'
    ELSE 'Kòmand Mete ajou'
  END;

  v_notif_body := CASE p_new_status
    WHEN 'accepted' THEN 'Vandè a aksepte kòmand ou!'
    WHEN 'preparing' THEN 'Kòmand ou ap prepare kounye a!'
    WHEN 'delivering' THEN 'Vandè a nan wout pou livre w!'
    WHEN 'ready_pickup' THEN 'Kòmand ou pare pou w retire l!'
    WHEN 'delivered' THEN 'Kòmand ou LIVRE! Tanpri evalye esperyans ou.'
    WHEN 'picked_up' THEN 'Kliyan retire kòmand ou. Mèsi!'
    WHEN 'cancelled' THEN COALESCE(p_note, 'Vandè a refize/kansile kòmand sa a.')
    ELSE 'Estati kòmand ou mete ajou.'
  END;

  -- Send notification to customer
  IF v_order.customer_id IS NOT NULL THEN
    SELECT user_id INTO v_customer_user_id FROM public.customers WHERE id = v_order.customer_id AND deleted_at IS NULL;
    IF v_customer_user_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, type, title, body, data, is_read, read)
      VALUES (
        v_customer_user_id, 'order', v_notif_title, v_notif_body,
        jsonb_build_object('order_id', p_order_id, 'status', p_new_status),
        false, false
      ) ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  RETURN jsonb_build_object('success', true, 'order_id', p_order_id, 'status', p_new_status);
END;
$function$;

-- ============================================================
-- 6. Update place_order RPC to use 'pending' instead of 'new'
-- ============================================================
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
AS $function$
DECLARE
  v_order_id uuid;
  v_order_number text;
  v_item jsonb;
  v_commission numeric;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.vendors WHERE id = p_vendor_id AND deleted_at IS NULL) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Vandè sa a pa egziste');
  END IF;

  v_commission := p_total * 0.10;

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

-- ============================================================
-- 7. Ensure realtime includes order_status_history
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='order_status_history') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.order_status_history;
  END IF;
END $$;
