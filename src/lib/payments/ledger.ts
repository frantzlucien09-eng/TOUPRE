import { supabase } from '../supabase';
import type { LedgerTransaction } from './types';
import { logPaymentError } from './errors';

export async function listLedgerForPayment(paymentId: string): Promise<LedgerTransaction[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('payment_id', paymentId)
    .order('created_at', { ascending: true });
  if (error) {
    logPaymentError('listLedgerForPayment', error, { paymentId });
    throw error;
  }
  return (data ?? []) as LedgerTransaction[];
}

export async function appendLedgerEntries(
  paymentId: string,
  entries: Array<{
    entryType: 'debit' | 'credit';
    account: string;
    amount: number;
    currency?: string;
    description?: string;
    metadata?: Record<string, unknown>;
  }>
): Promise<void> {
  const rows = entries.map((e) => ({
    payment_id: paymentId,
    entry_type: e.entryType,
    account: e.account,
    amount: e.amount,
    currency: e.currency ?? 'HTG',
    description: e.description ?? null,
    reference_type: 'payment',
    reference_id: paymentId,
    metadata: e.metadata ?? {},
  }));
  const { error } = await supabase.from('transactions').insert(rows);
  if (error) {
    logPaymentError('appendLedgerEntries', error, { paymentId });
    throw error;
  }
}

/** On successful capture: move escrow → vendor/platform split (informational until MonCash). */
export async function postCaptureLedger(args: {
  paymentId: string;
  amount: number;
  commission?: number;
  currency?: string;
}): Promise<void> {
  const commission = args.commission ?? 0;
  const vendorAmount = Math.max(args.amount - commission, 0);
  await appendLedgerEntries(args.paymentId, [
    {
      entryType: 'debit',
      account: 'escrow',
      amount: args.amount,
      currency: args.currency,
      description: 'Release escrow on capture',
    },
    {
      entryType: 'credit',
      account: 'vendor',
      amount: vendorAmount,
      currency: args.currency,
      description: 'Vendor net',
    },
    ...(commission > 0
      ? [
          {
            entryType: 'credit' as const,
            account: 'platform',
            amount: commission,
            currency: args.currency,
            description: 'Platform commission',
          },
        ]
      : []),
  ]);
}
