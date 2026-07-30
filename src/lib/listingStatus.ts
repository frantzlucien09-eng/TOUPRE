import type { AdPayment, Product } from './types';
import { isAdCategory } from './categories';

export type ListingDisplayStatus =
  | 'pending_payment'
  | 'pending_review'
  | 'active'
  | 'rejected'
  | 'expired'
  | 'sold';

export const LISTING_STATUS_LABELS: Record<ListingDisplayStatus, string> = {
  pending_payment: 'Pending Payment',
  pending_review: 'Pending Review',
  active: 'Active',
  rejected: 'Rejected',
  expired: 'Expired',
  sold: 'Vann/Lwe',
};

export const LISTING_STATUS_STYLES: Record<ListingDisplayStatus, string> = {
  pending_payment: 'bg-amber-100 text-amber-700',
  pending_review: 'bg-blue-100 text-blue-700',
  active: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-rose-100 text-rose-700',
  expired: 'bg-slate-200 text-slate-600',
  sold: 'bg-indigo-100 text-indigo-700',
};

export type AdPaymentLike = Pick<AdPayment, 'status'> & {
  waived?: boolean | null;
};

export function isListingExpired(product: Pick<Product, 'ad_status' | 'ad_expires_at'>): boolean {
  if (product.ad_status === 'expired') return true;
  if (product.ad_status === 'active' && product.ad_expires_at) {
    return new Date(product.ad_expires_at).getTime() <= Date.now();
  }
  return false;
}

/** Fee is satisfied when latest payment is paid or waived. */
export function isListingFeeSatisfied(payment: AdPaymentLike | null | undefined): boolean {
  if (!payment) return false;
  if (payment.waived) return true;
  return payment.status === 'paid';
}

/**
 * Resolve classified listing display status from product + latest ad_payment.
 * Expired listings stay in DB; they only leave public search.
 */
export function resolveListingDisplayStatus(
  product: Product,
  latestPayment?: AdPaymentLike | null
): ListingDisplayStatus {
  if (!isAdCategory(product.category)) {
    return product.active ? 'active' : 'pending_payment';
  }

  if (product.ad_status === 'sold') return 'sold';
  if (product.status === 'rejected') return 'rejected';
  if (isListingExpired(product)) return 'expired';
  if (product.ad_status === 'active' && !isListingExpired(product)) return 'active';

  if (isListingFeeSatisfied(latestPayment) || product.status === 'pending') {
    // Paid/waived but not yet active → awaiting admin review
    if (product.ad_status !== 'active') return 'pending_review';
  }

  return 'pending_payment';
}

/** Public marketplace visibility for classified ads. */
export function isClassifiedPubliclyVisible(product: Product): boolean {
  if (!isAdCategory(product.category)) return !!product.active;
  return (
    product.active === true &&
    product.ad_status === 'active' &&
    product.status === 'active' &&
    !isListingExpired(product)
  );
}

export function computeListingExpiry(from: Date, durationDays: number): Date {
  return new Date(from.getTime() + Math.max(1, durationDays) * 24 * 60 * 60 * 1000);
}
