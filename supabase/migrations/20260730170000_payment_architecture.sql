/*
  Payment Architecture (provider-agnostic)

  Reuses live tables when present: payments, transactions, payment_methods,
  wallets, audit_logs. Aligns columns via ADD COLUMN IF NOT EXISTS.

  New tables (only what cannot reuse):
  - payment_webhook_events
  - payment_provider_configs
  - payment_reconciliation_runs

  Does NOT connect to MonCash / NatCash / card rails yet.
  Does NOT drop existing RLS policies on reused tables.
*/

-- ============================================================
-- payments (intent / charge lifecycle — source of truth)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS idempotency_key text,
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS customer_id uuid,
  ADD COLUMN IF NOT EXISTS vendor_id uuid,
  ADD COLUMN IF NOT EXISTS order_id uuid,
  ADD COLUMN IF NOT EXISTS ad_payment_id uuid,
  ADD COLUMN IF NOT EXISTS withdrawal_id uuid,
  ADD COLUMN IF NOT EXISTS purpose text NOT NULL DEFAULT 'order',
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS provider_method text,
  ADD COLUMN IF NOT EXISTS amount numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'HTG',
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'created',
  ADD COLUMN IF NOT EXISTS provider_payment_id text,
  ADD COLUMN IF NOT EXISTS provider_checkout_url text,
  ADD COLUMN IF NOT EXISTS provider_raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS error_code text,
  ADD COLUMN IF NOT EXISTS error_message text,
  ADD COLUMN IF NOT EXISTS error_details jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS attempt_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_attempts integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS next_retry_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_attempt_at timestamptz,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS failed_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS refunded_at timestamptz,
  ADD COLUMN IF NOT EXISTS fraud_score numeric(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fraud_flags jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS risk_level text NOT NULL DEFAULT 'low',
  ADD COLUMN IF NOT EXISTS client_ip text,
  ADD COLUMN IF NOT EXISTS user_agent text,
  ADD COLUMN IF NOT EXISTS reconciled_at timestamptz,
  ADD COLUMN IF NOT EXISTS reconciliation_status text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS uq_payments_idempotency_key
  ON public.payments (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments (status);
CREATE INDEX IF NOT EXISTS idx_payments_provider ON public.payments (provider);
CREATE INDEX IF NOT EXISTS idx_payments_order_id ON public.payments (order_id);
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON public.payments (user_id);
CREATE INDEX IF NOT EXISTS idx_payments_expires_at ON public.payments (expires_at)
  WHERE status IN ('created', 'pending', 'processing', 'requires_action');
CREATE INDEX IF NOT EXISTS idx_payments_next_retry ON public.payments (next_retry_at)
  WHERE next_retry_at IS NOT NULL AND status IN ('pending', 'processing', 'failed');

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Owner read (keep existing admin_* policies intact)
DROP POLICY IF EXISTS "owner_select_own_payments" ON public.payments;
CREATE POLICY "owner_select_own_payments" ON public.payments
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================
-- transactions (immutable ledger entries)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS payment_id uuid,
  ADD COLUMN IF NOT EXISTS wallet_id uuid,
  ADD COLUMN IF NOT EXISTS entry_type text NOT NULL DEFAULT 'debit',
  ADD COLUMN IF NOT EXISTS account text NOT NULL DEFAULT 'platform',
  ADD COLUMN IF NOT EXISTS amount numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'HTG',
  ADD COLUMN IF NOT EXISTS balance_after numeric(14,2),
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS reference_type text,
  ADD COLUMN IF NOT EXISTS reference_id uuid,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS created_by uuid;

CREATE INDEX IF NOT EXISTS idx_transactions_payment_id ON public.transactions (payment_id);
CREATE INDEX IF NOT EXISTS idx_transactions_wallet_id ON public.transactions (wallet_id);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON public.transactions (created_at DESC);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- payment_methods (saved methods — provider agnostic)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_methods
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS method_type text NOT NULL DEFAULT 'mobile_wallet',
  ADD COLUMN IF NOT EXISTS label text,
  ADD COLUMN IF NOT EXISTS last_four text,
  ADD COLUMN IF NOT EXISTS brand text,
  ADD COLUMN IF NOT EXISTS phone_masked text,
  ADD COLUMN IF NOT EXISTS provider_method_id text,
  ADD COLUMN IF NOT EXISTS is_default boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_payment_methods_user ON public.payment_methods (user_id)
  WHERE deleted_at IS NULL;

ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- wallets
-- ============================================================
CREATE TABLE IF NOT EXISTS public.wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.wallets
  ADD COLUMN IF NOT EXISTS owner_type text NOT NULL DEFAULT 'platform',
  ADD COLUMN IF NOT EXISTS owner_id uuid,
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'HTG',
  ADD COLUMN IF NOT EXISTS available_balance numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pending_balance numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS uq_wallets_owner_currency
  ON public.wallets (owner_type, owner_id, currency)
  WHERE owner_id IS NOT NULL;

ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- audit_logs (reuse for payment audit)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS actor_id uuid,
  ADD COLUMN IF NOT EXISTS actor_role text,
  ADD COLUMN IF NOT EXISTS action text,
  ADD COLUMN IF NOT EXISTS entity_type text,
  ADD COLUMN IF NOT EXISTS entity_id uuid,
  ADD COLUMN IF NOT EXISTS payment_id uuid,
  ADD COLUMN IF NOT EXISTS severity text NOT NULL DEFAULT 'info',
  ADD COLUMN IF NOT EXISTS message text,
  ADD COLUMN IF NOT EXISTS before_state jsonb,
  ADD COLUMN IF NOT EXISTS after_state jsonb,
  ADD COLUMN IF NOT EXISTS error_code text,
  ADD COLUMN IF NOT EXISTS error_message text,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS ip_address text,
  ADD COLUMN IF NOT EXISTS user_agent text;

CREATE INDEX IF NOT EXISTS idx_audit_logs_payment_id ON public.audit_logs (payment_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs (created_at DESC);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Link domain tables to payments (optional FKs as columns only)
-- ============================================================
ALTER TABLE public.ad_payments
  ADD COLUMN IF NOT EXISTS payment_id uuid,
  ADD COLUMN IF NOT EXISTS provider text,
  ADD COLUMN IF NOT EXISTS error_message text;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_id uuid,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- ============================================================
-- NEW: payment_provider_configs
-- ============================================================
CREATE TABLE IF NOT EXISTS public.payment_provider_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL UNIQUE,
  display_name text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  sandbox boolean NOT NULL DEFAULT true,
  supports_refunds boolean NOT NULL DEFAULT false,
  supports_webhooks boolean NOT NULL DEFAULT true,
  timeout_seconds integer NOT NULL DEFAULT 900,
  max_retries integer NOT NULL DEFAULT 3,
  -- Non-secret operational config only (never store API secrets here)
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  webhook_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_provider_configs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_select_payment_provider_configs" ON public.payment_provider_configs;
CREATE POLICY "admin_select_payment_provider_configs" ON public.payment_provider_configs
  FOR SELECT TO authenticated USING (public.has_role('admin'));

DROP POLICY IF EXISTS "admin_insert_payment_provider_configs" ON public.payment_provider_configs;
CREATE POLICY "admin_insert_payment_provider_configs" ON public.payment_provider_configs
  FOR INSERT TO authenticated WITH CHECK (public.has_role('admin'));

DROP POLICY IF EXISTS "admin_update_payment_provider_configs" ON public.payment_provider_configs;
CREATE POLICY "admin_update_payment_provider_configs" ON public.payment_provider_configs
  FOR UPDATE TO authenticated
  USING (public.has_role('admin')) WITH CHECK (public.has_role('admin'));

DROP POLICY IF EXISTS "admin_delete_payment_provider_configs" ON public.payment_provider_configs;
CREATE POLICY "admin_delete_payment_provider_configs" ON public.payment_provider_configs
  FOR DELETE TO authenticated USING (public.has_role('admin'));

INSERT INTO public.payment_provider_configs (provider, display_name, enabled, sandbox, supports_refunds, supports_webhooks, timeout_seconds, max_retries, webhook_path, config)
VALUES
  ('moncash', 'MonCash', false, true, false, true, 900, 3, '/functions/v1/payment-webhook?provider=moncash', '{"currency":"HTG"}'::jsonb),
  ('natcash', 'NatCash', false, true, false, true, 900, 3, '/functions/v1/payment-webhook?provider=natcash', '{"currency":"HTG"}'::jsonb),
  ('visa', 'Visa', false, true, true, true, 1800, 3, '/functions/v1/payment-webhook?provider=visa', '{"currency":"HTG"}'::jsonb),
  ('mastercard', 'Mastercard', false, true, true, true, 1800, 3, '/functions/v1/payment-webhook?provider=mastercard', '{"currency":"HTG"}'::jsonb),
  ('manual', 'Manual / Admin', true, false, true, false, 86400, 1, null, '{"currency":"HTG"}'::jsonb)
ON CONFLICT (provider) DO NOTHING;

-- ============================================================
-- NEW: payment_webhook_events
-- ============================================================
CREATE TABLE IF NOT EXISTS public.payment_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  event_id text,
  event_type text,
  payment_id uuid,
  signature text,
  signature_valid boolean,
  headers jsonb NOT NULL DEFAULT '{}'::jsonb,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  verified boolean NOT NULL DEFAULT false,
  processed boolean NOT NULL DEFAULT false,
  processing_error text,
  duplicate_of uuid,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  UNIQUE (provider, event_id)
);

CREATE INDEX IF NOT EXISTS idx_payment_webhook_events_payment
  ON public.payment_webhook_events (payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_webhook_events_received
  ON public.payment_webhook_events (received_at DESC);

ALTER TABLE public.payment_webhook_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_select_payment_webhook_events" ON public.payment_webhook_events;
CREATE POLICY "admin_select_payment_webhook_events" ON public.payment_webhook_events
  FOR SELECT TO authenticated USING (public.has_role('admin'));

-- ============================================================
-- NEW: payment_reconciliation_runs
-- ============================================================
CREATE TABLE IF NOT EXISTS public.payment_reconciliation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text,
  status text NOT NULL DEFAULT 'running',
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  matched_count integer NOT NULL DEFAULT 0,
  mismatch_count integer NOT NULL DEFAULT 0,
  unpaid_stale_count integer NOT NULL DEFAULT 0,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid
);

ALTER TABLE public.payment_reconciliation_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_select_payment_reconciliation_runs" ON public.payment_reconciliation_runs;
CREATE POLICY "admin_select_payment_reconciliation_runs" ON public.payment_reconciliation_runs
  FOR SELECT TO authenticated USING (public.has_role('admin'));

DROP POLICY IF EXISTS "admin_insert_payment_reconciliation_runs" ON public.payment_reconciliation_runs;
CREATE POLICY "admin_insert_payment_reconciliation_runs" ON public.payment_reconciliation_runs
  FOR INSERT TO authenticated WITH CHECK (public.has_role('admin'));

DROP POLICY IF EXISTS "admin_update_payment_reconciliation_runs" ON public.payment_reconciliation_runs;
CREATE POLICY "admin_update_payment_reconciliation_runs" ON public.payment_reconciliation_runs
  FOR UPDATE TO authenticated
  USING (public.has_role('admin')) WITH CHECK (public.has_role('admin'));

-- ============================================================
-- Helper: payment audit writer
-- ============================================================
CREATE OR REPLACE FUNCTION public.log_payment_audit(
  p_action text,
  p_payment_id uuid DEFAULT NULL,
  p_entity_type text DEFAULT 'payment',
  p_entity_id uuid DEFAULT NULL,
  p_message text DEFAULT NULL,
  p_before jsonb DEFAULT NULL,
  p_after jsonb DEFAULT NULL,
  p_severity text DEFAULT 'info',
  p_error_code text DEFAULT NULL,
  p_error_message text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.audit_logs (
    actor_id, action, entity_type, entity_id, payment_id, severity, message,
    before_state, after_state, error_code, error_message, metadata
  ) VALUES (
    auth.uid(), p_action, p_entity_type, COALESCE(p_entity_id, p_payment_id), p_payment_id, p_severity, p_message,
    p_before, p_after, p_error_code, p_error_message, COALESCE(p_metadata, '{}'::jsonb)
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.log_payment_audit TO authenticated, service_role;

-- ============================================================
-- Transition payment status (lifecycle + order projection)
-- ============================================================
CREATE OR REPLACE FUNCTION public.transition_payment_status(
  p_payment_id uuid,
  p_new_status text,
  p_error_code text DEFAULT NULL,
  p_error_message text DEFAULT NULL,
  p_provider_payment_id text DEFAULT NULL,
  p_provider_raw jsonb DEFAULT NULL,
  p_metadata jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_pay record;
  v_allowed boolean := false;
  v_before jsonb;
BEGIN
  SELECT * INTO v_pay FROM public.payments WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Peman pa jwenn', 'error_code', 'payment_not_found');
  END IF;

  IF NOT (public.has_role('admin') OR v_pay.user_id = auth.uid() OR auth.role() = 'service_role') THEN
    -- service_role check via JWT claim is limited; allow when called from SECURITY DEFINER webhook path with null auth
    IF auth.uid() IS NOT NULL AND v_pay.user_id IS DISTINCT FROM auth.uid() AND NOT public.has_role('admin') THEN
      RETURN jsonb_build_object('success', false, 'error', 'Ou pa otorize', 'error_code', 'forbidden');
    END IF;
  END IF;

  -- Lifecycle matrix
  v_allowed := CASE v_pay.status
    WHEN 'created' THEN p_new_status IN ('pending', 'processing', 'requires_action', 'cancelled', 'expired', 'failed', 'blocked')
    WHEN 'pending' THEN p_new_status IN ('processing', 'requires_action', 'authorized', 'captured', 'paid', 'failed', 'cancelled', 'expired', 'blocked')
    WHEN 'processing' THEN p_new_status IN ('requires_action', 'authorized', 'captured', 'paid', 'failed', 'cancelled', 'expired')
    WHEN 'requires_action' THEN p_new_status IN ('processing', 'authorized', 'captured', 'paid', 'failed', 'cancelled', 'expired')
    WHEN 'authorized' THEN p_new_status IN ('captured', 'paid', 'cancelled', 'failed', 'refunded')
    WHEN 'captured' THEN p_new_status IN ('paid', 'refunded', 'partially_refunded')
    WHEN 'paid' THEN p_new_status IN ('refunded', 'partially_refunded')
    WHEN 'failed' THEN p_new_status IN ('pending', 'processing', 'cancelled', 'expired') -- retry
    WHEN 'blocked' THEN p_new_status IN ('cancelled')
    WHEN 'cancelled' THEN false
    WHEN 'expired' THEN false
    WHEN 'refunded' THEN false
    WHEN 'partially_refunded' THEN p_new_status IN ('refunded')
    ELSE false
  END;

  IF NOT v_allowed THEN
    PERFORM public.log_payment_audit(
      'payment.status_rejected', p_payment_id, 'payment', p_payment_id,
      'Invalid transition ' || v_pay.status || ' -> ' || p_new_status,
      to_jsonb(v_pay), NULL, 'warn', 'invalid_transition',
      'Invalid payment status transition',
      jsonb_build_object('from', v_pay.status, 'to', p_new_status)
    );
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Transisyon estati invalid',
      'error_code', 'invalid_transition',
      'from', v_pay.status,
      'to', p_new_status
    );
  END IF;

  v_before := to_jsonb(v_pay);

  UPDATE public.payments SET
    status = p_new_status,
    error_code = COALESCE(p_error_code, error_code),
    error_message = COALESCE(p_error_message, error_message),
    provider_payment_id = COALESCE(p_provider_payment_id, provider_payment_id),
    provider_raw = CASE WHEN p_provider_raw IS NULL THEN provider_raw ELSE provider_raw || p_provider_raw END,
    metadata = CASE WHEN p_metadata IS NULL THEN metadata ELSE metadata || p_metadata END,
    paid_at = CASE WHEN p_new_status IN ('paid', 'captured') THEN COALESCE(paid_at, now()) ELSE paid_at END,
    failed_at = CASE WHEN p_new_status = 'failed' THEN now() ELSE failed_at END,
    cancelled_at = CASE WHEN p_new_status = 'cancelled' THEN now() ELSE cancelled_at END,
    refunded_at = CASE WHEN p_new_status IN ('refunded', 'partially_refunded') THEN now() ELSE refunded_at END,
    updated_at = now()
  WHERE id = p_payment_id;

  -- Project onto orders.payment_status when linked
  IF v_pay.order_id IS NOT NULL THEN
    UPDATE public.orders SET
      payment_status = CASE
        WHEN p_new_status IN ('paid', 'captured') THEN 'paid'
        WHEN p_new_status = 'refunded' THEN 'refunded'
        WHEN p_new_status = 'partially_refunded' THEN 'partially_paid'
        WHEN p_new_status IN ('failed', 'cancelled', 'expired', 'blocked') THEN COALESCE(payment_status, 'unpaid')
        ELSE COALESCE(payment_status, 'pending')
      END,
      payment_id = p_payment_id,
      updated_at = now()
    WHERE id = v_pay.order_id;
  END IF;

  IF v_pay.ad_payment_id IS NOT NULL AND p_new_status IN ('paid', 'captured') THEN
    UPDATE public.ad_payments SET status = 'paid', paid_at = now(), payment_id = p_payment_id
    WHERE id = v_pay.ad_payment_id;
  ELSIF v_pay.ad_payment_id IS NOT NULL AND p_new_status = 'failed' THEN
    UPDATE public.ad_payments SET status = 'failed', payment_id = p_payment_id, error_message = p_error_message
    WHERE id = v_pay.ad_payment_id;
  END IF;

  PERFORM public.log_payment_audit(
    'payment.status_changed', p_payment_id, 'payment', p_payment_id,
    'Status ' || v_pay.status || ' -> ' || p_new_status,
    v_before, jsonb_build_object('status', p_new_status), 'info',
    p_error_code, p_error_message,
    jsonb_build_object('from', v_pay.status, 'to', p_new_status)
  );

  RETURN jsonb_build_object('success', true, 'payment_id', p_payment_id, 'status', p_new_status);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.transition_payment_status TO authenticated, service_role;

-- ============================================================
-- Create payment with idempotency
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_payment(
  p_idempotency_key text,
  p_amount numeric,
  p_provider text DEFAULT 'manual',
  p_purpose text DEFAULT 'order',
  p_currency text DEFAULT 'HTG',
  p_order_id uuid DEFAULT NULL,
  p_ad_payment_id uuid DEFAULT NULL,
  p_vendor_id uuid DEFAULT NULL,
  p_customer_id uuid DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb,
  p_client_ip text DEFAULT NULL,
  p_user_agent text DEFAULT NULL,
  p_timeout_seconds integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_existing record;
  v_cfg record;
  v_id uuid;
  v_expires timestamptz;
  v_timeout integer;
  v_fraud numeric := 0;
  v_risk text := 'low';
  v_flags jsonb := '[]'::jsonb;
BEGIN
  IF p_idempotency_key IS NULL OR length(trim(p_idempotency_key)) < 8 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Idempotency key obligatwa', 'error_code', 'missing_idempotency_key');
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Montan invalid', 'error_code', 'invalid_amount');
  END IF;

  SELECT * INTO v_existing FROM public.payments WHERE idempotency_key = p_idempotency_key;
  IF FOUND THEN
    PERFORM public.log_payment_audit(
      'payment.idempotent_hit', v_existing.id, 'payment', v_existing.id,
      'Idempotent replay', NULL, to_jsonb(v_existing), 'info', NULL, NULL,
      jsonb_build_object('idempotency_key', p_idempotency_key)
    );
    RETURN jsonb_build_object(
      'success', true,
      'idempotent', true,
      'payment_id', v_existing.id,
      'status', v_existing.status
    );
  END IF;

  SELECT * INTO v_cfg FROM public.payment_provider_configs WHERE provider = p_provider;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Founisè peman pa konnen', 'error_code', 'unknown_provider');
  END IF;

  -- Soft gate: provider may be disabled (architecture ready; no live rails yet)
  IF p_provider <> 'manual' AND v_cfg.enabled IS NOT TRUE THEN
    -- Still allow creating the payment record in 'created' state for future enablement tests,
    -- but mark blocked if amount is extreme fraud signal only — otherwise pending architecture.
    NULL;
  END IF;

  v_timeout := COALESCE(p_timeout_seconds, v_cfg.timeout_seconds, 900);
  v_expires := now() + make_interval(secs => v_timeout);

  -- Basic fraud heuristics (provider-agnostic)
  IF p_amount >= 500000 THEN
    v_fraud := v_fraud + 40;
    v_flags := v_flags || jsonb_build_array('high_amount');
  ELSIF p_amount >= 100000 THEN
    v_fraud := v_fraud + 20;
    v_flags := v_flags || jsonb_build_array('elevated_amount');
  END IF;

  IF p_client_ip IS NULL THEN
    v_fraud := v_fraud + 5;
    v_flags := v_flags || jsonb_build_array('missing_ip');
  END IF;

  v_risk := CASE
    WHEN v_fraud >= 70 THEN 'blocked'
    WHEN v_fraud >= 40 THEN 'high'
    WHEN v_fraud >= 20 THEN 'medium'
    ELSE 'low'
  END;

  INSERT INTO public.payments (
    idempotency_key, user_id, customer_id, vendor_id, order_id, ad_payment_id,
    purpose, provider, amount, currency, status, metadata, expires_at,
    fraud_score, fraud_flags, risk_level, client_ip, user_agent, max_attempts, attempt_count
  ) VALUES (
    p_idempotency_key, auth.uid(), p_customer_id, p_vendor_id, p_order_id, p_ad_payment_id,
    p_purpose, p_provider, p_amount, COALESCE(p_currency, 'HTG'),
    CASE WHEN v_risk = 'blocked' THEN 'blocked' ELSE 'created' END,
    COALESCE(p_metadata, '{}'::jsonb), v_expires,
    v_fraud, v_flags, v_risk, p_client_ip, p_user_agent,
    COALESCE(v_cfg.max_retries, 3), 0
  )
  RETURNING id INTO v_id;

  IF v_risk = 'blocked' THEN
    PERFORM public.log_payment_audit(
      'payment.fraud_blocked', v_id, 'payment', v_id,
      'Payment blocked by fraud rules', NULL, NULL, 'warn', 'fraud_blocked',
      'Fraud score too high', jsonb_build_object('fraud_score', v_fraud, 'flags', v_flags)
    );
    RETURN jsonb_build_object(
      'success', false,
      'payment_id', v_id,
      'error', 'Peman bloke pou sekirite',
      'error_code', 'fraud_blocked',
      'risk_level', v_risk
    );
  END IF;

  -- Ledger: pending escrow hold (informational double-entry stub)
  INSERT INTO public.transactions (payment_id, entry_type, account, amount, currency, description, reference_type, reference_id, created_by, metadata)
  VALUES
    (v_id, 'debit', 'customer', p_amount, COALESCE(p_currency, 'HTG'), 'Payment initiated', 'payment', v_id, auth.uid(), jsonb_build_object('phase', 'create')),
    (v_id, 'credit', 'escrow', p_amount, COALESCE(p_currency, 'HTG'), 'Escrow hold', 'payment', v_id, auth.uid(), jsonb_build_object('phase', 'create'));

  IF p_order_id IS NOT NULL THEN
    UPDATE public.orders SET payment_id = v_id, payment_status = COALESCE(payment_status, 'pending'), updated_at = now()
    WHERE id = p_order_id;
  END IF;

  PERFORM public.log_payment_audit(
    'payment.created', v_id, 'payment', v_id,
    'Payment created', NULL, jsonb_build_object('amount', p_amount, 'provider', p_provider),
    'info', NULL, NULL, jsonb_build_object('idempotency_key', p_idempotency_key)
  );

  RETURN jsonb_build_object(
    'success', true,
    'idempotent', false,
    'payment_id', v_id,
    'status', 'created',
    'expires_at', v_expires,
    'risk_level', v_risk,
    'fraud_score', v_fraud,
    'provider_enabled', COALESCE(v_cfg.enabled, false)
  );
EXCEPTION WHEN unique_violation THEN
  SELECT * INTO v_existing FROM public.payments WHERE idempotency_key = p_idempotency_key;
  RETURN jsonb_build_object(
    'success', true,
    'idempotent', true,
    'payment_id', v_existing.id,
    'status', v_existing.status
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.create_payment TO authenticated, service_role;

-- ============================================================
-- Expire timed-out payments
-- ============================================================
CREATE OR REPLACE FUNCTION public.expire_stale_payments(p_limit integer DEFAULT 100)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  r record;
  v_count integer := 0;
BEGIN
  FOR r IN
    SELECT id FROM public.payments
    WHERE expires_at IS NOT NULL
      AND expires_at < now()
      AND status IN ('created', 'pending', 'processing', 'requires_action')
    ORDER BY expires_at ASC
    LIMIT GREATEST(p_limit, 1)
    FOR UPDATE SKIP LOCKED
  LOOP
    PERFORM public.transition_payment_status(r.id, 'expired', 'payment_timeout', 'Payment expired before completion');
    v_count := v_count + 1;
  END LOOP;

  PERFORM public.log_payment_audit(
    'payment.timeout_sweep', NULL, 'payment_batch', NULL,
    'Expired stale payments', NULL, jsonb_build_object('count', v_count), 'info'
  );

  RETURN jsonb_build_object('success', true, 'expired_count', v_count);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.expire_stale_payments TO authenticated, service_role;

-- ============================================================
-- Schedule payment retry
-- ============================================================
CREATE OR REPLACE FUNCTION public.schedule_payment_retry(
  p_payment_id uuid,
  p_delay_seconds integer DEFAULT 60
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_pay record;
BEGIN
  SELECT * INTO v_pay FROM public.payments WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'payment_not_found');
  END IF;

  IF v_pay.attempt_count >= v_pay.max_attempts THEN
    PERFORM public.transition_payment_status(p_payment_id, 'failed', 'max_retries', 'Max payment retries exceeded');
    RETURN jsonb_build_object('success', false, 'error_code', 'max_retries', 'payment_id', p_payment_id);
  END IF;

  UPDATE public.payments SET
    attempt_count = attempt_count + 1,
    last_attempt_at = now(),
    next_retry_at = now() + make_interval(secs => GREATEST(p_delay_seconds, 5)),
    status = CASE WHEN status = 'failed' THEN 'pending' ELSE status END,
    updated_at = now()
  WHERE id = p_payment_id;

  PERFORM public.log_payment_audit(
    'payment.retry_scheduled', p_payment_id, 'payment', p_payment_id,
    'Retry scheduled', NULL, jsonb_build_object('delay_seconds', p_delay_seconds), 'info'
  );

  RETURN jsonb_build_object('success', true, 'payment_id', p_payment_id, 'next_retry_at', now() + make_interval(secs => GREATEST(p_delay_seconds, 5)));
END;
$function$;

GRANT EXECUTE ON FUNCTION public.schedule_payment_retry TO authenticated, service_role;

-- ============================================================
-- Record webhook (verification result supplied by edge layer)
-- ============================================================
CREATE OR REPLACE FUNCTION public.record_payment_webhook(
  p_provider text,
  p_event_id text,
  p_event_type text,
  p_payload jsonb,
  p_headers jsonb DEFAULT '{}'::jsonb,
  p_signature text DEFAULT NULL,
  p_signature_valid boolean DEFAULT false,
  p_payment_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_id uuid;
  v_dup uuid;
BEGIN
  IF p_event_id IS NOT NULL THEN
    SELECT id INTO v_dup FROM public.payment_webhook_events
    WHERE provider = p_provider AND event_id = p_event_id;
    IF v_dup IS NOT NULL THEN
      RETURN jsonb_build_object('success', true, 'duplicate', true, 'webhook_id', v_dup);
    END IF;
  END IF;

  INSERT INTO public.payment_webhook_events (
    provider, event_id, event_type, payment_id, signature, signature_valid,
    headers, payload, verified, processed
  ) VALUES (
    p_provider, p_event_id, p_event_type, p_payment_id, p_signature, COALESCE(p_signature_valid, false),
    COALESCE(p_headers, '{}'::jsonb), COALESCE(p_payload, '{}'::jsonb),
    COALESCE(p_signature_valid, false), false
  )
  RETURNING id INTO v_id;

  PERFORM public.log_payment_audit(
    'payment.webhook_received', p_payment_id, 'webhook', v_id,
    'Webhook received from ' || p_provider,
    NULL, jsonb_build_object('event_type', p_event_type, 'verified', p_signature_valid),
    CASE WHEN p_signature_valid THEN 'info' ELSE 'warn' END,
    CASE WHEN p_signature_valid THEN NULL ELSE 'invalid_signature' END,
    CASE WHEN p_signature_valid THEN NULL ELSE 'Webhook signature invalid' END,
    jsonb_build_object('provider', p_provider, 'event_id', p_event_id)
  );

  RETURN jsonb_build_object('success', true, 'duplicate', false, 'webhook_id', v_id, 'verified', COALESCE(p_signature_valid, false));
END;
$function$;

GRANT EXECUTE ON FUNCTION public.record_payment_webhook TO authenticated, service_role;

-- ============================================================
-- Simple reconciliation sweep (internal ledger vs order projection)
-- ============================================================
CREATE OR REPLACE FUNCTION public.run_payment_reconciliation(
  p_provider text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_run_id uuid;
  v_matched integer := 0;
  v_mismatch integer := 0;
  v_stale integer := 0;
  r record;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.has_role('admin') THEN
    RETURN jsonb_build_object('success', false, 'error_code', 'forbidden');
  END IF;

  INSERT INTO public.payment_reconciliation_runs (provider, status, created_by)
  VALUES (p_provider, 'running', auth.uid())
  RETURNING id INTO v_run_id;

  -- Expire stale first
  PERFORM public.expire_stale_payments(200);

  FOR r IN
    SELECT p.id, p.status, p.order_id, o.payment_status
    FROM public.payments p
    LEFT JOIN public.orders o ON o.id = p.order_id
    WHERE (p_provider IS NULL OR p.provider = p_provider)
      AND p.created_at > now() - interval '30 days'
  LOOP
    IF r.order_id IS NULL THEN
      v_matched := v_matched + 1;
    ELSIF r.status IN ('paid', 'captured') AND r.payment_status = 'paid' THEN
      v_matched := v_matched + 1;
      UPDATE public.payments SET reconciled_at = now(), reconciliation_status = 'matched', updated_at = now() WHERE id = r.id;
    ELSIF r.status IN ('paid', 'captured') AND r.payment_status IS DISTINCT FROM 'paid' THEN
      v_mismatch := v_mismatch + 1;
      UPDATE public.payments SET reconciliation_status = 'order_status_mismatch', updated_at = now() WHERE id = r.id;
      -- Auto-heal projection
      UPDATE public.orders SET payment_status = 'paid', payment_id = r.id, updated_at = now() WHERE id = r.order_id;
    ELSIF r.status IN ('created', 'pending', 'processing', 'requires_action') THEN
      v_stale := v_stale + 1;
    ELSE
      v_matched := v_matched + 1;
    END IF;
  END LOOP;

  UPDATE public.payment_reconciliation_runs SET
    status = 'completed',
    finished_at = now(),
    matched_count = v_matched,
    mismatch_count = v_mismatch,
    unpaid_stale_count = v_stale,
    details = jsonb_build_object('provider', p_provider)
  WHERE id = v_run_id;

  PERFORM public.log_payment_audit(
    'payment.reconciliation_completed', NULL, 'reconciliation', v_run_id,
    'Reconciliation completed', NULL,
    jsonb_build_object('matched', v_matched, 'mismatch', v_mismatch, 'stale', v_stale),
    'info'
  );

  RETURN jsonb_build_object(
    'success', true,
    'run_id', v_run_id,
    'matched_count', v_matched,
    'mismatch_count', v_mismatch,
    'unpaid_stale_count', v_stale
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.run_payment_reconciliation TO authenticated, service_role;
