import { supabase } from '../supabase';
import type {
  CreatePaymentInput,
  Payment,
  PaymentProvider,
  PaymentProviderConfig,
  PaymentRpcResult,
  PaymentStatus,
} from './types';
import { getPaymentProvider } from './providers';
import { assessPaymentFraud } from './fraud';
import { createIdempotencyKey } from './idempotency';
import { logPaymentError, PaymentError } from './errors';
import { writePaymentAudit } from './audit';
import { postCaptureLedger } from './ledger';
import { schedulePaymentRetry, retryDelaySeconds } from './retry';
import { isSuccessfulPaymentStatus } from './status';

export async function createPayment(input: CreatePaymentInput): Promise<PaymentRpcResult> {
  const fraud = assessPaymentFraud({
    amount: input.amount,
    clientIp: input.clientIp,
    userAgent: input.userAgent,
    metadata: input.metadata,
  });

  if (fraud.blocked) {
    logPaymentError(
      'createPayment',
      new PaymentError('fraud_blocked', 'Peman bloke pou sekirite', { fraud }),
      { amount: input.amount, provider: input.provider }
    );
  }

  const { data, error } = await supabase.rpc('create_payment', {
    p_idempotency_key: input.idempotencyKey,
    p_amount: input.amount,
    p_provider: input.provider,
    p_purpose: input.purpose ?? 'order',
    p_currency: input.currency ?? 'HTG',
    p_order_id: input.orderId ?? null,
    p_ad_payment_id: input.adPaymentId ?? null,
    p_vendor_id: input.vendorId ?? null,
    p_customer_id: input.customerId ?? null,
    p_metadata: {
      ...(input.metadata ?? {}),
      client_fraud_score: fraud.score,
      client_fraud_flags: fraud.flags,
    },
    p_client_ip: input.clientIp ?? null,
    p_user_agent: input.userAgent ?? null,
    p_timeout_seconds: input.timeoutSeconds ?? null,
  });

  if (error) {
    logPaymentError('createPayment', error, { provider: input.provider });
    return { success: false, error: error.message, error_code: 'unknown' };
  }
  return data as PaymentRpcResult;
}

export async function transitionPaymentStatus(args: {
  paymentId: string;
  status: PaymentStatus | string;
  errorCode?: string | null;
  errorMessage?: string | null;
  providerPaymentId?: string | null;
  providerRaw?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
}): Promise<PaymentRpcResult> {
  const { data, error } = await supabase.rpc('transition_payment_status', {
    p_payment_id: args.paymentId,
    p_new_status: args.status,
    p_error_code: args.errorCode ?? null,
    p_error_message: args.errorMessage ?? null,
    p_provider_payment_id: args.providerPaymentId ?? null,
    p_provider_raw: args.providerRaw ?? null,
    p_metadata: args.metadata ?? null,
  });
  if (error) {
    logPaymentError('transitionPaymentStatus', error, { paymentId: args.paymentId, status: args.status });
    return { success: false, error: error.message, error_code: 'unknown' };
  }
  return data as PaymentRpcResult;
}

/**
 * Initiate payment with a provider adapter.
 * Non-manual providers return provider_not_connected until wired.
 */
export async function initiatePaymentWithProvider(args: {
  amount: number;
  provider: PaymentProvider;
  purpose?: CreatePaymentInput['purpose'];
  orderId?: string | null;
  adPaymentId?: string | null;
  vendorId?: string | null;
  customerId?: string | null;
  metadata?: Record<string, unknown>;
  idempotencyKey?: string;
  returnUrl?: string;
  cancelUrl?: string;
}): Promise<PaymentRpcResult & { checkoutUrl?: string | null }> {
  const key = args.idempotencyKey || createIdempotencyKey(args.provider);
  const created = await createPayment({
    idempotencyKey: key,
    amount: args.amount,
    provider: args.provider,
    purpose: args.purpose,
    orderId: args.orderId,
    adPaymentId: args.adPaymentId,
    vendorId: args.vendorId,
    customerId: args.customerId,
    metadata: args.metadata,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
  });

  if (!created.success || !created.payment_id) {
    return created;
  }

  if (created.status === 'blocked') {
    return { ...created, success: false, error_code: 'fraud_blocked', error: 'Peman bloke pou sekirite' };
  }

  const adapter = getPaymentProvider(args.provider);
  const pending = await transitionPaymentStatus({
    paymentId: created.payment_id,
    status: 'pending',
  });
  if (!pending.success) return pending;

  const initiated = await adapter.initiate({
    paymentId: created.payment_id,
    amount: args.amount,
    currency: 'HTG',
    purpose: args.purpose ?? 'order',
    metadata: args.metadata,
    returnUrl: args.returnUrl,
    cancelUrl: args.cancelUrl,
  });

  if (!initiated.ok) {
    await transitionPaymentStatus({
      paymentId: created.payment_id,
      status: 'failed',
      errorCode: initiated.errorCode ?? 'provider_not_connected',
      errorMessage: initiated.errorMessage ?? 'Provider initiate failed',
      providerRaw: initiated.raw ?? null,
    });
    const delay = retryDelaySeconds(1);
    await schedulePaymentRetry(created.payment_id, delay);
    logPaymentError(
      'initiatePaymentWithProvider',
      new PaymentError(
        (initiated.errorCode as 'provider_not_connected') || 'provider_not_connected',
        initiated.errorMessage || 'Provider initiate failed'
      ),
      { paymentId: created.payment_id, provider: args.provider }
    );
    return {
      success: false,
      payment_id: created.payment_id,
      status: 'failed',
      error: initiated.errorMessage,
      error_code: initiated.errorCode ?? 'provider_not_connected',
    };
  }

  if (initiated.requiresAction) {
    await transitionPaymentStatus({
      paymentId: created.payment_id,
      status: 'requires_action',
      providerPaymentId: initiated.providerPaymentId,
      providerRaw: initiated.raw ?? null,
    });
  } else if (args.provider === 'manual') {
    // Manual path can be marked paid by admin separately; move to processing.
    await transitionPaymentStatus({
      paymentId: created.payment_id,
      status: 'processing',
      providerPaymentId: initiated.providerPaymentId,
      providerRaw: initiated.raw ?? null,
    });
  } else {
    await transitionPaymentStatus({
      paymentId: created.payment_id,
      status: 'processing',
      providerPaymentId: initiated.providerPaymentId,
      providerRaw: initiated.raw ?? null,
    });
  }

  // Persist checkout URL if present
  if (initiated.checkoutUrl) {
    await supabase
      .from('payments')
      .update({
        provider_checkout_url: initiated.checkoutUrl,
        provider_payment_id: initiated.providerPaymentId ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', created.payment_id);
  }

  return {
    success: true,
    payment_id: created.payment_id,
    status: initiated.requiresAction ? 'requires_action' : 'processing',
    checkoutUrl: initiated.checkoutUrl ?? null,
    provider_enabled: adapter.connected,
  };
}

export async function markPaymentPaid(args: {
  paymentId: string;
  providerPaymentId?: string | null;
  commission?: number;
  amount?: number;
  metadata?: Record<string, unknown>;
}): Promise<PaymentRpcResult> {
  const result = await transitionPaymentStatus({
    paymentId: args.paymentId,
    status: 'paid',
    providerPaymentId: args.providerPaymentId,
    metadata: args.metadata,
  });
  if (result.success && args.amount != null) {
    try {
      await postCaptureLedger({
        paymentId: args.paymentId,
        amount: args.amount,
        commission: args.commission,
      });
    } catch (err) {
      logPaymentError('markPaymentPaid.ledger', err, { paymentId: args.paymentId });
    }
  }
  return result;
}

export async function getPayment(paymentId: string): Promise<Payment | null> {
  const { data, error } = await supabase.from('payments').select('*').eq('id', paymentId).maybeSingle();
  if (error) {
    logPaymentError('getPayment', error, { paymentId });
    throw error;
  }
  return (data as Payment) ?? null;
}

export async function listPayments(filters?: {
  status?: string;
  provider?: string;
  limit?: number;
}): Promise<Payment[]> {
  let q = supabase.from('payments').select('*').order('created_at', { ascending: false });
  if (filters?.status) q = q.eq('status', filters.status);
  if (filters?.provider) q = q.eq('provider', filters.provider);
  q = q.limit(filters?.limit ?? 50);
  const { data, error } = await q;
  if (error) {
    logPaymentError('listPayments', error, filters);
    throw error;
  }
  return (data ?? []) as Payment[];
}

export async function listProviderConfigs(): Promise<PaymentProviderConfig[]> {
  const { data, error } = await supabase
    .from('payment_provider_configs')
    .select('*')
    .order('provider', { ascending: true });
  if (error) {
    logPaymentError('listProviderConfigs', error);
    throw error;
  }
  return (data ?? []) as PaymentProviderConfig[];
}

export async function setProviderEnabled(provider: string, enabled: boolean): Promise<void> {
  const { error } = await supabase
    .from('payment_provider_configs')
    .update({ enabled, updated_at: new Date().toISOString() })
    .eq('provider', provider);
  if (error) {
    logPaymentError('setProviderEnabled', error, { provider, enabled });
    throw error;
  }
  await writePaymentAudit({
    action: enabled ? 'payment.provider_enabled' : 'payment.provider_disabled',
    message: `${provider} ${enabled ? 'enabled' : 'disabled'}`,
    metadata: { provider, enabled },
  });
}

export function paymentLooksPaid(payment: Pick<Payment, 'status'>): boolean {
  return isSuccessfulPaymentStatus(payment.status);
}
