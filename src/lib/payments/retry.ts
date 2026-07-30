import { supabase } from '../supabase';
import type { PaymentRpcResult } from './types';
import { logPaymentError } from './errors';

/** Exponential backoff delay in seconds for attempt N (1-based). */
export function retryDelaySeconds(attempt: number): number {
  const base = 30;
  const delay = base * Math.pow(2, Math.max(attempt - 1, 0));
  return Math.min(delay, 3600);
}

export async function schedulePaymentRetry(
  paymentId: string,
  delaySeconds?: number
): Promise<PaymentRpcResult> {
  const { data, error } = await supabase.rpc('schedule_payment_retry', {
    p_payment_id: paymentId,
    p_delay_seconds: delaySeconds ?? 60,
  });
  if (error) {
    logPaymentError('schedulePaymentRetry', error, { paymentId });
    return { success: false, error: error.message, error_code: 'unknown' };
  }
  return data as PaymentRpcResult;
}

export async function expireStalePayments(limit = 100): Promise<PaymentRpcResult> {
  const { data, error } = await supabase.rpc('expire_stale_payments', {
    p_limit: limit,
  });
  if (error) {
    logPaymentError('expireStalePayments', error);
    return { success: false, error: error.message, error_code: 'payment_timeout' };
  }
  return data as PaymentRpcResult;
}

export async function runPaymentReconciliation(provider?: string | null): Promise<PaymentRpcResult> {
  const { data, error } = await supabase.rpc('run_payment_reconciliation', {
    p_provider: provider ?? null,
  });
  if (error) {
    logPaymentError('runPaymentReconciliation', error, { provider });
    return { success: false, error: error.message, error_code: 'unknown' };
  }
  return data as PaymentRpcResult;
}
