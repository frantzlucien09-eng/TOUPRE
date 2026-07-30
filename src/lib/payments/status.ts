import type { PaymentStatus } from './types';

/** Canonical payment status lifecycle (provider-agnostic). */
export const PAYMENT_STATUSES: PaymentStatus[] = [
  'created',
  'pending',
  'processing',
  'requires_action',
  'authorized',
  'captured',
  'paid',
  'failed',
  'cancelled',
  'expired',
  'blocked',
  'refunded',
  'partially_refunded',
];

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  created: 'Kreye',
  pending: 'An Atant',
  processing: 'Ap Trete',
  requires_action: 'Aksyon Nesesè',
  authorized: 'Otorize',
  captured: 'Capture',
  paid: 'Peye',
  failed: 'Echwe',
  cancelled: 'Anile',
  expired: 'Ekspire',
  blocked: 'Bloke',
  refunded: 'Rembouse',
  partially_refunded: 'Rembouse Pasyèl',
};

export const PAYMENT_STATUS_STYLES: Record<string, string> = {
  created: 'bg-slate-100 text-slate-600',
  pending: 'bg-amber-100 text-amber-700',
  processing: 'bg-blue-100 text-blue-700',
  requires_action: 'bg-violet-100 text-violet-700',
  authorized: 'bg-indigo-100 text-indigo-700',
  captured: 'bg-emerald-100 text-emerald-700',
  paid: 'bg-emerald-100 text-emerald-700',
  failed: 'bg-rose-100 text-rose-700',
  cancelled: 'bg-slate-200 text-slate-600',
  expired: 'bg-slate-200 text-slate-600',
  blocked: 'bg-rose-200 text-rose-800',
  refunded: 'bg-orange-100 text-orange-700',
  partially_refunded: 'bg-orange-50 text-orange-700',
};

export const TERMINAL_PAYMENT_STATUSES: PaymentStatus[] = [
  'paid',
  'cancelled',
  'expired',
  'blocked',
  'refunded',
];

export const RETRYABLE_PAYMENT_STATUSES: PaymentStatus[] = ['failed', 'pending', 'processing'];

const ALLOWED: Record<PaymentStatus, PaymentStatus[]> = {
  created: ['pending', 'processing', 'requires_action', 'cancelled', 'expired', 'failed', 'blocked'],
  pending: ['processing', 'requires_action', 'authorized', 'captured', 'paid', 'failed', 'cancelled', 'expired', 'blocked'],
  processing: ['requires_action', 'authorized', 'captured', 'paid', 'failed', 'cancelled', 'expired'],
  requires_action: ['processing', 'authorized', 'captured', 'paid', 'failed', 'cancelled', 'expired'],
  authorized: ['captured', 'paid', 'cancelled', 'failed', 'refunded'],
  captured: ['paid', 'refunded', 'partially_refunded'],
  paid: ['refunded', 'partially_refunded'],
  failed: ['pending', 'processing', 'cancelled', 'expired'],
  blocked: ['cancelled'],
  cancelled: [],
  expired: [],
  refunded: [],
  partially_refunded: ['refunded'],
};

export function canTransitionPaymentStatus(from: string, to: string): boolean {
  const allowed = ALLOWED[from as PaymentStatus];
  if (!allowed) return false;
  return allowed.includes(to as PaymentStatus);
}

export function isTerminalPaymentStatus(status: string): boolean {
  return TERMINAL_PAYMENT_STATUSES.includes(status as PaymentStatus);
}

export function isSuccessfulPaymentStatus(status: string): boolean {
  return status === 'paid' || status === 'captured';
}
