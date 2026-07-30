import { supabase } from '../supabase';
import { logPaymentError } from './errors';

export async function writePaymentAudit(args: {
  action: string;
  paymentId?: string | null;
  message?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  severity?: string;
  errorCode?: string | null;
  errorMessage?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<string | null> {
  const { data, error } = await supabase.rpc('log_payment_audit', {
    p_action: args.action,
    p_payment_id: args.paymentId ?? null,
    p_entity_type: 'payment',
    p_entity_id: args.paymentId ?? null,
    p_message: args.message ?? null,
    p_before: args.before ?? null,
    p_after: args.after ?? null,
    p_severity: args.severity ?? 'info',
    p_error_code: args.errorCode ?? null,
    p_error_message: args.errorMessage ?? null,
    p_metadata: args.metadata ?? {},
  });
  if (error) {
    logPaymentError('writePaymentAudit', error, { action: args.action });
    return null;
  }
  return (data as string) ?? null;
}

export async function listPaymentAudit(paymentId: string, limit = 50) {
  const { data, error } = await supabase
    .from('audit_logs')
    .select('*')
    .eq('payment_id', paymentId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) {
    logPaymentError('listPaymentAudit', error, { paymentId });
    throw error;
  }
  return data ?? [];
}
