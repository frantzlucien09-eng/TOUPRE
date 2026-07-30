import { supabase } from './supabase';

export type PlaceOrderItem = {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
};

export type PlaceOrderArgs = {
  customerId: string;
  vendorId: string;
  items: PlaceOrderItem[];
  subtotal: number;
  shippingCost?: number;
  total: number;
  deliveryType?: 'delivery' | 'pickup';
  shippingAddress?: Record<string, unknown> | null;
  notes?: string | null;
  /** Phase 1: unpaid until MonCash is wired */
  paymentStatus?: 'unpaid' | 'pending' | 'paid';
};

export type PlaceOrderResult = {
  success: boolean;
  order_id?: string;
  order_number?: string;
  error?: string;
};

export async function placeOrder(args: PlaceOrderArgs): Promise<PlaceOrderResult> {
  const { data, error } = await supabase.rpc('place_order', {
    p_customer_id: args.customerId,
    p_vendor_id: args.vendorId,
    p_items: args.items,
    p_subtotal: args.subtotal,
    p_shipping_cost: args.shippingCost ?? 0,
    p_total: args.total,
    p_delivery_type: args.deliveryType ?? 'delivery',
    p_shipping_address: args.shippingAddress ?? null,
    p_notes: args.notes ?? null,
    p_payment_status: args.paymentStatus ?? 'unpaid',
  });

  if (error) {
    return { success: false, error: error.message || 'Erè, eseye ankò' };
  }

  const result = data as PlaceOrderResult | null;
  if (!result || typeof result !== 'object') {
    return { success: false, error: 'Erè, eseye ankò' };
  }
  return result;
}
