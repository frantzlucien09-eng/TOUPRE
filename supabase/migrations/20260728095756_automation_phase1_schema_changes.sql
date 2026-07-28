/*
# Phase 1: Schema Changes for Production Automations

## Context
The automation system needs:
1. vendor_stats: withdrawn_balance, total_earnings columns
2. products: favorite_count column for tracking
3. product_stats: revenue, favorite_count columns
4. orders: expanded status constraint (add refunded, processing, shipped, completed)
5. automation_error_log table for fail-safe error tracking
*/

-- ============================================================
-- 1. vendor_stats: add withdrawn_balance and total_earnings
-- ============================================================
ALTER TABLE public.vendor_stats
  ADD COLUMN IF NOT EXISTS withdrawn_balance numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_earnings numeric(14,2) NOT NULL DEFAULT 0;

-- Backfill from existing data
UPDATE public.vendor_stats SET
  withdrawn_balance = COALESCE((
    SELECT SUM(amount) FROM public.withdrawals
    WHERE vendor_id = vendor_stats.vendor_id AND deleted_at IS NULL AND status = 'paid'
  ), 0),
  total_earnings = COALESCE(vendor_revenue, 0);

-- ============================================================
-- 2. products: add favorite_count column
-- ============================================================
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS favorite_count integer NOT NULL DEFAULT 0;

-- Backfill favorite_count from favorites table
UPDATE public.products p SET favorite_count = COALESCE((
  SELECT COUNT(*) FROM public.favorites f
  WHERE f.product_id = p.id AND f.deleted_at IS NULL
), 0);

-- ============================================================
-- 3. product_stats: add revenue and favorite_count columns
-- ============================================================
ALTER TABLE public.product_stats
  ADD COLUMN IF NOT EXISTS revenue numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS favorite_count integer NOT NULL DEFAULT 0;

-- Backfill revenue from sold_count * price
UPDATE public.product_stats ps SET revenue = COALESCE((
  SELECT COALESCE(p.sold_count, 0) * COALESCE(p.price, 0)
  FROM public.products p WHERE p.id = ps.product_id
), 0);

-- ============================================================
-- 4. orders: expand status constraint
-- Current: pending, accepted, preparing, ready_pickup, delivering,
--          delivered, picked_up, cancelled
-- Add: refunded, processing, shipped, completed
-- ============================================================
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_status_check CHECK (
  status IN ('pending', 'accepted', 'preparing', 'processing', 'ready_pickup',
             'delivering', 'shipped', 'delivered', 'picked_up', 'completed',
             'cancelled', 'refunded')
);

-- ============================================================
-- 5. automation_error_log table (fail-safe)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.automation_error_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_name text NOT NULL,
  function_name text NOT NULL,
  error_message text NOT NULL,
  error_detail text,
  error_hint text,
  record_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.automation_error_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_read_error_log" ON public.automation_error_log
  FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY "admin_manage_error_log" ON public.automation_error_log
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE INDEX IF NOT EXISTS idx_automation_error_log_created
  ON public.automation_error_log (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_automation_error_log_trigger
  ON public.automation_error_log (trigger_name);

GRANT SELECT ON public.automation_error_log TO authenticated;
