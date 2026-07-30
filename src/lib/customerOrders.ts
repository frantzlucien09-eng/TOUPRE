import { supabase } from './supabase';
import { addToCart } from './cart';
import type { Order, OrderItem } from './types';

export type CancelOrderResult = {
  success: boolean;
  order_id?: string;
  error?: string;
};

export async function cancelCustomerOrder(
  orderId: string,
  reason?: string
): Promise<CancelOrderResult> {
  const { data, error } = await supabase.rpc('customer_cancel_order', {
    p_order_id: orderId,
    p_reason: reason ?? null,
  });
  if (error) {
    return { success: false, error: error.message || 'Erè, eseye ankò' };
  }
  const result = data as CancelOrderResult | null;
  if (!result || typeof result !== 'object') {
    return { success: false, error: 'Erè, eseye ankò' };
  }
  return result;
}

/** Normalize order line items across jsonb shapes used by place_order / legacy. */
export function normalizeOrderItems(order: Order): Array<{
  product_id: string;
  name: string;
  qty: number;
  price: number;
}> {
  const raw = Array.isArray(order.items) ? order.items : [];
  return raw
    .map((it) => {
      const row = it as OrderItem;
      const productId = row.product_id;
      if (!productId) return null;
      return {
        product_id: productId,
        name: row.name || row.product_name || 'Atik',
        qty: Number(row.qty ?? row.quantity ?? 1) || 1,
        price: Number(row.price ?? row.unit_price ?? 0) || 0,
      };
    })
    .filter((x): x is NonNullable<typeof x> => Boolean(x));
}

/** Re-add previous order items into the shopping cart. */
export async function reorderToCart(userId: string, order: Order): Promise<number> {
  const items = normalizeOrderItems(order);
  let added = 0;
  for (const it of items) {
    try {
      await addToCart(userId, it.product_id, it.qty);
      added += 1;
    } catch {
      // skip unavailable products
    }
  }
  return added;
}
