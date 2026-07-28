/*
# Remove duplicate notification from place_order RPC

The place_order RPC was inserting a notification AND the trg_notify_vendor_on_order
trigger was also inserting one — causing duplicates. Remove the notification insert
from the RPC since the trigger handles it automatically.
*/

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
    p_customer_id, p_vendor_id, 'new', p_subtotal, p_shipping_cost, p_total,
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

  -- Notification is sent by trg_notify_vendor_on_order trigger

  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'order_number', v_order_number
  );
END;
$function$;
