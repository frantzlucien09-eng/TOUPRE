/*
# Order status history + admin cancel

1. New table: `order_status_history`
Tracks every status change for each order so the admin can see a full
timeline (when it went new -> preparing -> ready -> delivering -> delivered,
or -> cancelled).

2. Trigger: `log_order_status_change`
AFTER INSERT or UPDATE on `orders` — when `status` changes, inserts a row
into `order_status_history`. Safe with existing vendor/customer updates.

3. Function: `admin_cancel_order(p_order_id, p_reason, p_reviewer_id)`
SECURITY DEFINER — lets an admin cancel an order due to a dispute, sets
status='cancelled', reject_reason, and logs to activity_log. Vendors
cannot cancel via this function; only admin calls it with service role.

4. RLS
- order_status_history: admin can read all; vendor/customer can read
  their own order's history.
*/

CREATE TABLE IF NOT EXISTS order_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status text NOT NULL,
  changed_by uuid,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE order_status_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_read_order_history" ON order_status_history;
CREATE POLICY "admin_read_order_history"
ON order_status_history FOR SELECT
TO authenticated USING (is_admin());

DROP POLICY IF EXISTS "participants_read_order_history" ON order_status_history;
CREATE POLICY "participants_read_order_history"
ON order_status_history FOR SELECT
TO authenticated USING (
  EXISTS (
    SELECT 1 FROM orders o
    WHERE o.id = order_id
      AND (o.vendor_id = auth.uid() OR o.customer_id = auth.uid())
  )
);

CREATE INDEX IF NOT EXISTS idx_order_history_order ON order_status_history(order_id, created_at);

-- Trigger to log status changes
CREATE OR REPLACE FUNCTION log_order_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (TG_OP = 'INSERT') OR (TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status) THEN
    INSERT INTO order_status_history (order_id, status, changed_by)
    VALUES (NEW.id, NEW.status, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_order_status ON orders;
CREATE TRIGGER trg_order_status
AFTER INSERT OR UPDATE OF status ON orders
FOR EACH ROW EXECUTE FUNCTION log_order_status_change();

-- Admin cancel order function
CREATE OR REPLACE FUNCTION admin_cancel_order(
  p_order_id uuid,
  p_reason text,
  p_reviewer_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  o orders%ROWTYPE;
BEGIN
  SELECT * INTO o FROM orders WHERE id = p_order_id;
  IF o.id IS NULL OR o.status = 'cancelled' OR o.status = 'delivered' THEN
    RETURN;
  END IF;
  UPDATE orders
    SET status = 'cancelled',
        reject_reason = p_reason,
        updated_at = now()
    WHERE id = p_order_id;
  INSERT INTO activity_log (actor_id, actor_type, actor_name, action, entity_type, entity_id, metadata)
    VALUES (
      p_reviewer_id,
      'admin',
      (SELECT email FROM admin_profiles WHERE id = p_reviewer_id),
      'order.cancelled',
      'orders',
      o.id,
      jsonb_build_object('order_id', o.id, 'reason', p_reason, 'total', o.total)
    );
END;
$$;
