import { supabase } from '../supabase';
import type { PaymentRpcResult, PaymentWebhookEvent } from './types';
import { getPaymentProvider } from './providers';
import { logPaymentError, PaymentError } from './errors';
import { writePaymentAudit } from './audit';

export async function recordWebhookEvent(args: {
  provider: string;
  eventId?: string | null;
  eventType?: string | null;
  payload: Record<string, unknown>;
  headers?: Record<string, unknown>;
  signature?: string | null;
  signatureValid?: boolean;
  paymentId?: string | null;
}): Promise<PaymentRpcResult> {
  const { data, error } = await supabase.rpc('record_payment_webhook', {
    p_provider: args.provider,
    p_event_id: args.eventId ?? null,
    p_event_type: args.eventType ?? null,
    p_payload: args.payload,
    p_headers: args.headers ?? {},
    p_signature: args.signature ?? null,
    p_signature_valid: args.signatureValid ?? false,
    p_payment_id: args.paymentId ?? null,
  });
  if (error) {
    logPaymentError('recordWebhookEvent', error, { provider: args.provider });
    return { success: false, error: error.message, error_code: 'unknown' };
  }
  return data as PaymentRpcResult;
}

/**
 * Verify + persist a webhook using the provider adapter.
 * Adapters for MonCash/NatCash/cards are stubs until connected.
 */
export async function ingestProviderWebhook(args: {
  provider: string;
  headers: Record<string, string>;
  rawBody: string;
  parsedPayload?: Record<string, unknown>;
}): Promise<PaymentRpcResult> {
  const adapter = getPaymentProvider(args.provider);
  const signature =
    args.headers['x-signature'] ||
    args.headers['x-moncash-signature'] ||
    args.headers['stripe-signature'] ||
    null;

  const verification = await adapter.verifyWebhook({
    headers: args.headers,
    rawBody: args.rawBody,
    signature,
  });

  if (!adapter.connected) {
    await writePaymentAudit({
      action: 'payment.webhook_rejected',
      message: 'Provider not connected — webhook not accepted for settlement',
      severity: 'warn',
      errorCode: 'provider_not_connected',
      errorMessage: verification.errorMessage ?? 'Provider not connected',
      metadata: { provider: args.provider },
    });
    throw new PaymentError(
      'provider_not_connected',
      verification.errorMessage || 'Provider not connected'
    );
  }

  const payload =
    args.parsedPayload ??
    (() => {
      try {
        return JSON.parse(args.rawBody) as Record<string, unknown>;
      } catch {
        return { raw: args.rawBody };
      }
    })();

  const recorded = await recordWebhookEvent({
    provider: args.provider,
    eventId: verification.eventId ?? null,
    eventType: verification.eventType ?? null,
    payload,
    headers: args.headers,
    signature,
    signatureValid: verification.valid,
    paymentId: verification.paymentId ?? null,
  });

  if (!verification.valid) {
    logPaymentError('ingestProviderWebhook', new PaymentError('invalid_signature', 'Invalid webhook signature'), {
      provider: args.provider,
    });
    return {
      ...recorded,
      success: false,
      error_code: 'invalid_signature',
      error: 'Invalid webhook signature',
      verified: false,
    };
  }

  return { ...recorded, verified: true };
}

export async function listWebhookEvents(limit = 50): Promise<PaymentWebhookEvent[]> {
  const { data, error } = await supabase
    .from('payment_webhook_events')
    .select('*')
    .order('received_at', { ascending: false })
    .limit(limit);
  if (error) {
    logPaymentError('listWebhookEvents', error);
    throw error;
  }
  return (data ?? []) as PaymentWebhookEvent[];
}
