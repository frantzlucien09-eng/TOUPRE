import { supabase } from './supabase';
import type { Product } from './types';

export async function listFavoriteProductIds(userId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('favorites')
    .select('product_id')
    .eq('user_id', userId)
    .is('deleted_at', null);
  if (error) throw error;
  return new Set((data ?? []).map((r) => r.product_id as string));
}

export async function listFavoriteProducts(userId: string): Promise<Product[]> {
  const { data: favs, error } = await supabase
    .from('favorites')
    .select('product_id')
    .eq('user_id', userId)
    .is('deleted_at', null);
  if (error) throw error;
  const ids = (favs ?? []).map((f) => f.product_id as string);
  if (ids.length === 0) return [];
  const { data: products, error: pErr } = await supabase
    .from('products')
    .select('*')
    .in('id', ids)
    .eq('active', true);
  if (pErr) throw pErr;
  return (products ?? []) as Product[];
}

export async function isFavorite(userId: string, productId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('favorites')
    .select('id')
    .eq('user_id', userId)
    .eq('product_id', productId)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) throw error;
  return !!data;
}

/** Toggle favorite using hard delete/insert so favorite_count triggers stay in sync. */
export async function toggleFavorite(userId: string, productId: string): Promise<boolean> {
  const { data: existing } = await supabase
    .from('favorites')
    .select('id')
    .eq('user_id', userId)
    .eq('product_id', productId)
    .is('deleted_at', null)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase.from('favorites').delete().eq('id', existing.id);
    if (error) {
      // Soft-delete fallback if hard delete blocked
      const { error: softErr } = await supabase
        .from('favorites')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', existing.id);
      if (softErr) throw softErr;
    }
    return false;
  }

  const { error } = await supabase.from('favorites').insert({
    user_id: userId,
    product_id: productId,
  });
  if (error) throw error;
  return true;
}
