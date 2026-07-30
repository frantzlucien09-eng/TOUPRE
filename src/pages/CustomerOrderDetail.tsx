import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/lib/toast';
import { formatHTG, formatDateTime } from '@/lib/format';
import {
  STATUS_LABELS_CUSTOMER, STATUS_STYLES, ACTIVE_STATUSES, DONE_STATUSES, NEW_STATUSES,
} from '@/lib/orderStatus';
import { cancelCustomerOrder, normalizeOrderItems, reorderToCart } from '@/lib/customerOrders';
import type { Order, Vendor } from '@/lib/types';
import {
  ArrowLeft, Loader2, MapPin, Package, Truck, CheckCircle2, Clock, XCircle, RotateCcw,
} from 'lucide-react';

type OrderWithVendor = Order & { vendor?: Pick<Vendor, 'business_name' | 'phone' | 'city'> | null };

type Props = {
  orderId: string;
  onBack: () => void;
  onMessageVendor?: (vendorId: string) => void;
  onReordered?: () => void;
};

const DELIVERY_STEPS = ['pending', 'accepted', 'preparing', 'delivering', 'delivered'] as const;
const PICKUP_STEPS = ['pending', 'accepted', 'preparing', 'ready_pickup', 'picked_up'] as const;

export function CustomerOrderDetail({ orderId, onBack, onMessageVendor, onReordered }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [order, setOrder] = useState<OrderWithVendor | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [reordering, setReordering] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('orders')
      .select('*, vendor:vendors(business_name, phone, city)')
      .eq('id', orderId)
      .maybeSingle();
    setOrder((data as OrderWithVendor) ?? null);
    setLoading(false);
  };

  useEffect(() => {
    void load();
    const channel = supabase
      .channel(`customer-order-${orderId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `id=eq.${orderId}` }, () => { void load(); })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  const steps = useMemo(() => {
    if (!order) return [] as string[];
    return order.delivery_type === 'pickup' ? [...PICKUP_STEPS] : [...DELIVERY_STEPS];
  }, [order]);

  const currentIdx = useMemo(() => {
    if (!order) return -1;
    if (order.status === 'cancelled') return -1;
    const idx = steps.indexOf(order.status);
    return idx >= 0 ? idx : 0;
  }, [order, steps]);

  const handleCancel = async () => {
    if (!order || order.status !== 'pending') return;
    if (!window.confirm('Ou sèten ou vle anile kòmand sa a?')) return;
    setCancelling(true);
    const result = await cancelCustomerOrder(order.id, 'Kliyan anile');
    setCancelling(false);
    if (!result.success) {
      toast(result.error || 'Pa t kapab anile', 'error');
      return;
    }
    toast('Kòmand anile');
    await load();
  };

  const handleReorder = async () => {
    if (!user || !order) return;
    setReordering(true);
    try {
      const added = await reorderToCart(user.id, order);
      if (added === 0) {
        toast('Pa gen atik disponib pou rekòmande', 'error');
      } else {
        toast(`${added} atik ajoute nan panye`);
        onReordered?.();
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Erè, eseye ankò', 'error');
    } finally {
      setReordering(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-emerald-500" /></div>;
  }
  if (!order) {
    return (
      <div className="px-4 py-10 text-center">
        <p className="text-sm text-slate-500">Kòmand pa jwenn.</p>
        <button onClick={onBack} className="mt-3 text-sm text-emerald-600 font-semibold">Retounen</button>
      </div>
    );
  }

  const statusLabel = STATUS_LABELS_CUSTOMER[order.status] ?? order.status;
  const statusColor = STATUS_STYLES[order.status] ?? 'bg-slate-100 text-slate-600';
  const addr = order.shipping_address as Record<string, string | null> | null;
  const items = normalizeOrderItems(order);
  const canCancel = order.status === 'pending';
  const canReorder = items.length > 0;

  return (
    <div className="pb-24">
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-slate-100 px-4 py-3 flex items-center gap-3">
        <button onClick={onBack} className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center active:scale-90 transition" aria-label="Retounen">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="font-bold text-slate-900 text-sm truncate">Detay kòmand</h1>
          <p className="text-[11px] text-slate-400 truncate">{order.order_number ?? order.id.slice(0, 8)}</p>
        </div>
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${statusColor}`}>{statusLabel}</span>
      </div>

      <div className="px-4 pt-4 space-y-4">
        {order.status === 'cancelled' ? (
          <div className="bg-slate-100 rounded-xl p-4 flex items-start gap-3">
            <XCircle size={20} className="text-slate-500 mt-0.5" />
            <div>
              <p className="font-semibold text-slate-800 text-sm">Kòmand anile</p>
              {order.reject_reason && <p className="text-xs text-slate-500 mt-1">{order.reject_reason}</p>}
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-100 p-4 space-y-3">
            <p className="text-xs font-semibold text-slate-500">Swivi an tan reyèl</p>
            {steps.map((step, i) => {
              const done = i <= currentIdx;
              const active = i === currentIdx;
              const label = STATUS_LABELS_CUSTOMER[step] ?? step;
              return (
                <div key={step} className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${done ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
                    {done && i < currentIdx ? <CheckCircle2 size={16} /> : active ? <Clock size={16} /> : <Package size={14} />}
                  </div>
                  <div className="flex-1">
                    <p className={`text-sm font-semibold ${done ? 'text-slate-900' : 'text-slate-400'}`}>{label}</p>
                    {active && <p className="text-[11px] text-slate-400">{formatDateTime(order.updated_at)}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="bg-white rounded-xl border border-slate-100 p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Vandè</span>
            <span className="font-semibold text-slate-900">{order.vendor?.business_name ?? '—'}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Livrezon</span>
            <span className="font-semibold text-slate-900 flex items-center gap-1">
              {order.delivery_type === 'pickup' ? <Package size={14} /> : <Truck size={14} />}
              {order.delivery_type === 'pickup' ? 'Pickup' : 'Livrezon'}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Peman</span>
            <span className="font-semibold text-slate-900">
              {order.payment_status === 'paid' ? 'Peye' : 'Pa peye'}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Total</span>
            <span className="font-bold text-emerald-600">{formatHTG(order.total)}</span>
          </div>
        </div>

        {addr && (addr.address || addr.city) && (
          <div className="bg-white rounded-xl border border-slate-100 p-4">
            <p className="text-xs font-semibold text-slate-500 mb-1 flex items-center gap-1"><MapPin size={12} /> Adrès</p>
            <p className="text-sm text-slate-700">
              {[addr.address, addr.city, addr.department].filter(Boolean).join(', ')}
            </p>
            {addr.phone && <p className="text-xs text-slate-500 mt-1">{addr.phone}</p>}
          </div>
        )}

        {items.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-100 p-4 space-y-2">
            <p className="text-xs font-semibold text-slate-500">Atik</p>
            {items.map((it, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span className="text-slate-700 truncate mr-2">{it.name} × {it.qty}</span>
                <span className="font-semibold text-slate-900 shrink-0">{formatHTG(Number(it.price) * Number(it.qty))}</span>
              </div>
            ))}
          </div>
        )}

        {order.delivery_proof_url && (
          <div className="bg-white rounded-xl border border-slate-100 p-4">
            <p className="text-xs font-semibold text-slate-500 mb-2">Prèv livrezon</p>
            <img src={order.delivery_proof_url} alt="prèv" className="w-full rounded-lg object-cover max-h-56" />
          </div>
        )}

        <div className="space-y-2">
          {canCancel && (
            <button
              type="button"
              disabled={cancelling}
              onClick={() => void handleCancel()}
              className="w-full py-3 rounded-xl border border-rose-200 text-rose-700 font-semibold text-sm flex items-center justify-center gap-2 active:scale-95 transition disabled:opacity-50"
            >
              {cancelling ? <Loader2 size={16} className="animate-spin" /> : <XCircle size={16} />}
              Anile kòmand
            </button>
          )}
          {canReorder && (
            <button
              type="button"
              disabled={reordering}
              onClick={() => void handleReorder()}
              className="w-full py-3 rounded-xl bg-emerald-600 text-white font-semibold text-sm flex items-center justify-center gap-2 active:scale-95 transition disabled:opacity-50"
            >
              {reordering ? <Loader2 size={16} className="animate-spin" /> : <RotateCcw size={16} />}
              Rekòmande
            </button>
          )}
          {order.vendor_id && onMessageVendor && !DONE_STATUSES.includes(order.status) && (
            <button
              type="button"
              onClick={() => onMessageVendor(order.vendor_id)}
              className="w-full py-3 rounded-xl border border-emerald-200 text-emerald-700 font-semibold text-sm active:scale-95 transition"
            >
              Kontakte vandè a
            </button>
          )}
        </div>

        {(NEW_STATUSES.includes(order.status) || ACTIVE_STATUSES.includes(order.status)) && (
          <p className="text-[11px] text-center text-slate-400">Estati a mete ajou an tan reyèl.</p>
        )}
      </div>
    </div>
  );
}
