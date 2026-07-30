import { supabase } from './supabase';
import type { Vendor } from './types';

export async function listFavoriteVendors(userId: string): Promise<Vendor[]> {
  const { data: favs, error } = await supabase
    .from('vendor_favorites')
    .select('vendor_id')
    .eq('user_id', userId)
    .is('deleted_at', null);
  if (error) throw error;
  const ids = (favs ?? []).map((f) => f.vendor_id as string);
  if (ids.length === 0) return [];

  const { data: vendors, error: vErr } = await supabase
    .from('vendors')
    .select('*')
    .in('id', ids)
    .is('deleted_at', null);
  if (vErr) throw vErr;
  return (vendors ?? []) as Vendor[];
}

export async function isFavoriteVendor(userId: string, vendorId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('vendor_favorites')
    .select('id')
    .eq('user_id', userId)
    .eq('vendor_id', vendorId)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) throw error;
  return !!data;
}

export async function toggleFavoriteVendor(userId: string, vendorId: string): Promise<boolean> {
  const { data: existing } = await supabase
    .from('vendor_favorites')
    .select('id')
    .eq('user_id', userId)
    .eq('vendor_id', vendorId)
    .is('deleted_at', null)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase.from('vendor_favorites').delete().eq('id', existing.id);
    if (error) {
      const { error: softErr } = await supabase
        .from('vendor_favorites')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', existing.id);
      if (softErr) throw softErr;
    }
    return false;
  }

  const { error } = await supabase.from('vendor_favorites').insert({
    user_id: userId,
    vendor_id: vendorId,
  });
  if (error) throw error;
  return true;
}
