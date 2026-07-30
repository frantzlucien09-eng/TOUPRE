import { supabase } from './supabase';
import {
  computeListingExpiry,
  isListingFeeSatisfied,
  isListingExpired,
} from './listingStatus';
import { loadListingFeeSettings } from './listingSettings';
import type { AdPayment, Product } from './types';

export async function fetchLatestAdPayment(productId: string): Promise<AdPayment | null> {
  const { data, error } = await supabase
    .from('ad_payments')
    .select('*')
    .eq('product_id', productId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as AdPayment) ?? null;
}

export async function fetchLatestAdPaymentsForProducts(
  productIds: string[]
): Promise<Map<string, AdPayment>> {
  const map = new Map<string, AdPayment>();
  if (productIds.length === 0) return map;
  const { data, error } = await supabase
    .from('ad_payments')
    .select('*')
    .in('product_id', productIds)
    .order('created_at', { ascending: false });
  if (error) throw error;
  for (const row of (data ?? []) as AdPayment[]) {
    if (!map.has(row.product_id)) map.set(row.product_id, row);
  }
  return map;
}

/** Persist soft-expiry without deleting photos/history. */
export async function softExpireListingIfNeeded(product: Product): Promise<Product> {
  if (!isListingExpired(product) || product.ad_status === 'expired') return product;
  const { data } = await supabase
    .from('products')
    .update({
      ad_status: 'expired',
      active: false,
      updated_at: new Date().toISOString(),
    })
    .eq('id', product.id)
    .select('*')
    .maybeSingle();
  return (data as Product) ?? { ...product, ad_status: 'expired', active: false };
}

export async function verifyListingPayment(productId: string, adminUserId?: string | null): Promise<void> {
  const payment = await fetchLatestAdPayment(productId);
  if (!payment) throw new Error('Pa gen demann peman pou anons sa a');
  if (payment.status === 'paid' || payment.waived) {
    await supabase
      .from('products')
      .update({ status: 'pending', active: false, updated_at: new Date().toISOString() })
      .eq('id', productId);
    return;
  }

  const { error: payErr } = await supabase
    .from('ad_payments')
    .update({
      status: 'paid',
      paid_at: new Date().toISOString(),
      verified_at: new Date().toISOString(),
      verified_by: adminUserId ?? null,
    })
    .eq('id', payment.id);
  if (payErr) throw payErr;

  const { error: prodErr } = await supabase
    .from('products')
    .update({
      status: 'pending',
      ad_status: 'draft',
      active: false,
      updated_at: new Date().toISOString(),
    })
    .eq('id', productId);
  if (prodErr) throw prodErr;
}

export async function waiveListingFee(args: {
  productId: string;
  vendorId: string;
  category: string;
  adminUserId?: string | null;
  notes?: string;
}): Promise<void> {
  const now = new Date().toISOString();
  const { error: payErr } = await supabase.from('ad_payments').insert({
    vendor_id: args.vendorId,
    product_id: args.productId,
    amount: 0,
    category: args.category,
    status: 'paid',
    paid_at: now,
    waived: true,
    notes: args.notes ?? 'Admin waived listing fee',
    verified_at: now,
    verified_by: args.adminUserId ?? null,
  });
  if (payErr) throw payErr;

  const { error: prodErr } = await supabase
    .from('products')
    .update({
      status: 'pending',
      ad_status: 'draft',
      active: false,
      updated_at: now,
    })
    .eq('id', args.productId);
  if (prodErr) throw prodErr;
}

export async function approveClassifiedListing(productId: string): Promise<void> {
  const payment = await fetchLatestAdPayment(productId);
  if (!isListingFeeSatisfied(payment)) {
    throw new Error('Verifye oswa waive frè anons lan anvan ou apwouve');
  }

  const settings = await loadListingFeeSettings();
  const now = new Date();
  const expires = computeListingExpiry(now, settings.listingDurationDays);

  const { error } = await supabase
    .from('products')
    .update({
      status: 'active',
      ad_status: 'active',
      active: true,
      ad_paid_at: payment?.paid_at ?? now.toISOString(),
      ad_expires_at: expires.toISOString(),
      updated_at: now.toISOString(),
    })
    .eq('id', productId);
  if (error) throw error;
}

export async function rejectClassifiedListing(productId: string): Promise<void> {
  const { error } = await supabase
    .from('products')
    .update({
      status: 'rejected',
      active: false,
      updated_at: new Date().toISOString(),
    })
    .eq('id', productId);
  if (error) throw error;
}

/** Prepare expired listing for renew — keep photos/history, require fee again. */
export async function prepareListingRenewal(productId: string): Promise<void> {
  const { error } = await supabase
    .from('products')
    .update({
      ad_status: 'draft',
      status: 'draft',
      active: false,
      // Keep ad_expires_at / ad_paid_at history fields; new cycle overwrites on approve
      updated_at: new Date().toISOString(),
    })
    .eq('id', productId);
  if (error) throw error;
}
