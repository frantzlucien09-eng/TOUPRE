/** Shared withdrawal status labels/styles (vendor + admin). */

export const WITHDRAWAL_STATUS_LABELS: Record<string, string> = {
  pending: 'An Atant',
  approved: 'Apwouve',
  processing: 'Ap Trete',
  paid: 'Peye',
  rejected: 'Rejte',
  cancelled: 'Anile',
};

export const WITHDRAWAL_STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  approved: 'bg-blue-100 text-blue-700',
  processing: 'bg-indigo-100 text-indigo-700',
  paid: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-rose-100 text-rose-700',
  cancelled: 'bg-slate-200 text-slate-600',
};
