import { supabase } from './supabase';
import type { Product } from './types';

const MAX_RECENT = 20;

export async function recordProductView(userId: string, productId: string): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await supabase.from('recent_views').upsert(
    {
      user_id: userId,
      product_id: productId,
      viewed_at: now,
    },
    { onConflict: 'user_id,product_id' }
  );
  if (error) throw error;
  void supabase.rpc('increment_product_view', { p_product_id: productId });
}

export async function listRecentProducts(userId: string, limit = 12): Promise<Product[]> {
  const { data: views, error } = await supabase
    .from('recent_views')
    .select('product_id, viewed_at')
    .eq('user_id', userId)
    .order('viewed_at', { ascending: false })
    .limit(Math.min(limit, MAX_RECENT));
  if (error) throw error;
  const ids = (views ?? []).map((v) => v.product_id as string);
  if (ids.length === 0) return [];

  const { data: products, error: pErr } = await supabase
    .from('products')
    .select('*')
    .in('id', ids)
    .eq('active', true);
  if (pErr) throw pErr;

  const map = new Map(((products ?? []) as Product[]).map((p) => [p.id, p]));
  return ids.map((id) => map.get(id)).filter((p): p is Product => Boolean(p));
}
