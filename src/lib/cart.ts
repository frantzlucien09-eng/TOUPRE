import { supabase } from './supabase';
import { assertCanAddProductToCart } from './classifiedRules';
import type { Cart, CartItem, Product } from './types';

export type CartItemWithProduct = CartItem & { product: Product | null };

async function getOrCreateCart(userId: string): Promise<Cart> {
  const { data: existing, error: selErr } = await supabase
    .from('carts')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (selErr) throw selErr;
  if (existing) return existing as Cart;

  const { data: created, error: insErr } = await supabase
    .from('carts')
    .insert({ user_id: userId })
    .select('*')
    .single();
  if (insErr) throw insErr;
  return created as Cart;
}

export async function fetchCartItems(userId: string): Promise<CartItemWithProduct[]> {
  const cart = await getOrCreateCart(userId);
  const { data, error } = await supabase
    .from('cart_items')
    .select('*, product:products(*)')
    .eq('cart_id', cart.id)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as CartItemWithProduct[];
}

export async function getCartCount(userId: string): Promise<number> {
  const items = await fetchCartItems(userId);
  return items.reduce((sum, it) => sum + (it.quantity || 0), 0);
}

export async function addToCart(userId: string, productId: string, qty = 1): Promise<void> {
  const { data: product, error: prodErr } = await supabase
    .from('products')
    .select('id, category')
    .eq('id', productId)
    .maybeSingle();
  if (prodErr) throw prodErr;
  if (!product) throw new Error('Pwodwi pa jwenn');
  assertCanAddProductToCart(product as Product);

  const cart = await getOrCreateCart(userId);
  const { data: existing } = await supabase
    .from('cart_items')
    .select('id, quantity')
    .eq('cart_id', cart.id)
    .eq('product_id', productId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from('cart_items')
      .update({
        quantity: existing.quantity + qty,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id);
    if (error) throw error;
    return;
  }

  const { error } = await supabase.from('cart_items').insert({
    cart_id: cart.id,
    product_id: productId,
    quantity: qty,
  });
  if (error) throw error;
}

export async function updateCartItemQty(itemId: string, quantity: number): Promise<void> {
  if (quantity <= 0) {
    const { error } = await supabase.from('cart_items').delete().eq('id', itemId);
    if (error) throw error;
    return;
  }
  const { error } = await supabase
    .from('cart_items')
    .update({ quantity, updated_at: new Date().toISOString() })
    .eq('id', itemId);
  if (error) throw error;
}

export async function removeCartItem(itemId: string): Promise<void> {
  const { error } = await supabase.from('cart_items').delete().eq('id', itemId);
  if (error) throw error;
}

export async function clearCart(userId: string): Promise<void> {
  const cart = await getOrCreateCart(userId);
  const { error } = await supabase.from('cart_items').delete().eq('cart_id', cart.id);
  if (error) throw error;
}

export function groupCartByVendor(items: CartItemWithProduct[]): Map<string, CartItemWithProduct[]> {
  const map = new Map<string, CartItemWithProduct[]>();
  for (const item of items) {
    const vendorId = item.product?.vendor_id;
    if (!vendorId) continue;
    const list = map.get(vendorId) ?? [];
    list.push(item);
    map.set(vendorId, list);
  }
  return map;
}
