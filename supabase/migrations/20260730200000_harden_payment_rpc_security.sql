/*
  Production security hardening for payment RPCs

  - Owners cannot mark payments paid/captured/authorized/refunded
  - expire / retry / webhook / reconciliation require admin or service_role
  - Close null-uid authorization bypass on reconciliation
*/

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
  v_is_admin boolean := public.has_role('admin');
  v_is_service boolean := (auth.role() = 'service_role');
  v_is_owner boolean := false;
  v_is_settlement boolean := false;
BEGIN
  SELECT * INTO v_pay FROM public.payments WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Peman pa jwenn', 'error_code', 'payment_not_found');
  END IF;

  v_is_owner := (auth.uid() IS NOT NULL AND v_pay.user_id = auth.uid());
  v_is_settlement := p_new_status IN (
    'authorized', 'captured', 'paid', 'refunded', 'partially_refunded'
  );

  IF v_is_settlement THEN
    IF NOT (v_is_admin OR v_is_service) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Ou pa otorize', 'error_code', 'forbidden');
    END IF;
  ELSE
    IF NOT (v_is_admin OR v_is_service OR v_is_owner) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Ou pa otorize', 'error_code', 'forbidden');
    END IF;
  END IF;

  v_allowed := CASE v_pay.status
    WHEN 'created' THEN p_new_status IN ('pending', 'processing', 'requires_action', 'cancelled', 'expired', 'failed', 'blocked')
    WHEN 'pending' THEN p_new_status IN ('processing', 'requires_action', 'authorized', 'captured', 'paid', 'failed', 'cancelled', 'expired', 'blocked')
    WHEN 'processing' THEN p_new_status IN ('requires_action', 'authorized', 'captured', 'paid', 'failed', 'cancelled', 'expired')
    WHEN 'requires_action' THEN p_new_status IN ('processing', 'authorized', 'captured', 'paid', 'failed', 'cancelled', 'expired')
    WHEN 'authorized' THEN p_new_status IN ('captured', 'paid', 'cancelled', 'failed', 'refunded')
    WHEN 'captured' THEN p_new_status IN ('paid', 'refunded', 'partially_refunded')
    WHEN 'paid' THEN p_new_status IN ('refunded', 'partially_refunded')
    WHEN 'failed' THEN p_new_status IN ('pending', 'processing', 'cancelled', 'expired')
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
  IF NOT (public.has_role('admin') OR auth.role() = 'service_role') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ou pa otorize', 'error_code', 'forbidden');
  END IF;

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
  IF NOT (public.has_role('admin') OR auth.role() = 'service_role') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ou pa otorize', 'error_code', 'forbidden');
  END IF;

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
  IF auth.role() IS DISTINCT FROM 'service_role' AND NOT public.has_role('admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ou pa otorize', 'error_code', 'forbidden');
  END IF;

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
  IF auth.role() = 'service_role' THEN
    NULL;
  ELSIF auth.uid() IS NOT NULL AND public.has_role('admin') THEN
    NULL;
  ELSE
    RETURN jsonb_build_object('success', false, 'error_code', 'forbidden');
  END IF;

  INSERT INTO public.payment_reconciliation_runs (provider, status, created_by)
  VALUES (p_provider, 'running', auth.uid())
  RETURNING id INTO v_run_id;

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

REVOKE ALL ON FUNCTION public.record_payment_webhook(text, text, text, jsonb, jsonb, text, boolean, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_payment_webhook(text, text, text, jsonb, jsonb, text, boolean, uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.expire_stale_payments(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.expire_stale_payments(integer) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.schedule_payment_retry(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.schedule_payment_retry(uuid, integer) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.run_payment_reconciliation(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.run_payment_reconciliation(text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.transition_payment_status(uuid, text, text, text, text, jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.transition_payment_status(uuid, text, text, text, text, jsonb, jsonb) TO authenticated, service_role;
