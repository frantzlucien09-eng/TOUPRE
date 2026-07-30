import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/lib/toast';
import { formatHTG, formatDateTime, relativeTime } from '@/lib/format';
import type { Order } from '@/lib/types';
import { Header } from '@/components/Header';
import { Modal } from '@/components/Modal';
import { EmptyState } from '@/components/EmptyState';
import { StatusPill } from './HomePage';
import { isNew, isActive, isDone, isDelivered, isCancelled } from '@/lib/orderStatus';
import { orderStatusRpcFailed } from '@/lib/orderRpc';
import {
  Loader2, Truck, Package, Check, X, ChevronRight, MapPin, Phone, Clock,
} from 'lucide-react';

type Tab = 'new' | 'active' | 'done';

export function OrdersPage({ initialFilter, initialTab, onOpenOrder }: { initialFilter?: 'today' | 'new'; initialTab?: 'new' | 'active' | 'done'; onOpenOrder?: (order: Order) => void }) {
  const { vendor } = useAuth();
  const { toast } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>(initialTab ?? (initialFilter === 'today' ? 'new' : 'new'));
  const [detail, setDetail] = useState<Order | null>(null);
  const [rejecting, setRejecting] = useState<Order | null>(null);

  const load = async () => {
    if (!vendor) return;
    setLoading(true);
    const { data } = await supabase
      .from('orders')
      .select('*, customer:customers(full_name, phone, address, department, city)')
      .eq('vendor_id', vendor.id)
      .order('created_at', { ascending: false });
    setOrders((data ?? []) as unknown as Order[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    if (!vendor) return;
    const channel = supabase
      .channel('orders-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `vendor_id=eq.${vendor.id}` }, () => {
        load();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [vendor]);

  const accept = async (o: Order) => {
    const { data, error } = await supabase.rpc('update_order_status', {
      p_order_id: o.id,
      p_new_status: 'accepted',
    });
    const fail = orderStatusRpcFailed(error, data);
    if (fail) {
      toast(fail, 'error');
      return;
    }
    setOrders((list) => list.map((x) => (x.id === o.id ? { ...x, status: 'accepted' } : x)));
    toast('Kòmand aksepte');
    if (onOpenOrder) onOpenOrder({ ...o, status: 'accepted' });
  };

  const reject = async (o: Order, reason: string) => {
    const { data, error } = await supabase.rpc('update_order_status', {
      p_order_id: o.id,
      p_new_status: 'cancelled',
      p_note: reason || null,
    });
    const fail = orderStatusRpcFailed(error, data);
    if (fail) {
      toast(fail, 'error');
      return;
    }
    setOrders((list) => list.map((x) => (x.id === o.id ? { ...x, status: 'cancelled', reject_reason: reason } : x)));
    toast('Kòmand refize');
  };

  if (!vendor) return null;

  const newOrders = orders.filter((o) => isNew(o.status));
  const activeOrders = orders.filter((o) => isActive(o.status));
  const doneOrders = orders.filter((o) => isDone(o.status));

  const list = tab === 'new' ? newOrders : tab === 'active' ? activeOrders : doneOrders;

  return (
    <div className="pb-24">
      <Header title="Kòmand yo" subtitle="Jere tout kòmand kliyan" />

      <div className="px-4 pt-4">
        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-slate-100 rounded-xl mb-4">
          <TabBtn label={`Nouvo (${newOrders.length})`} active={tab === 'new'} onClick={() => setTab('new')} />
          <TabBtn label={`An kou (${activeOrders.length})`} active={tab === 'active'} onClick={() => setTab('active')} />
          <TabBtn label="Fini" active={tab === 'done'} onClick={() => setTab('done')} />
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="animate-spin text-slate-400" /></div>
        ) : list.length === 0 ? (
          <EmptyState
            icon={<Truck size={24} />}
            title={tab === 'new' ? 'Pa gen nouvo kòmand' : tab === 'active' ? 'Pa gen kòmand an kou' : 'Pa gen kòmand fini'}
            message="Kòmand yo ap parèt isit la otomatikman."
          />
        ) : (
          <div className="space-y-3">
            {list.map((o) => (
              <OrderCard
                key={o.id}
                order={o}
                onAccept={() => accept(o)}
                onReject={() => setRejecting(o)}
                onAdvance={() => { if (onOpenOrder) onOpenOrder(o); }}
                onOpen={() => setDetail(o)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Detail modal */}
      <Modal open={!!detail} onClose={() => setDetail(null)} title="Detay Kòmand">
        {detail && <OrderDetail order={detail} onAdvance={() => { const o = detail; setDetail(null); if (onOpenOrder) onOpenOrder(o); }} />}
      </Modal>

      {/* Reject modal */}
      <Modal open={!!rejecting} onClose={() => setRejecting(null)} title="Refize Kòmand">
        {rejecting && (
          <RejectForm
            onCancel={() => setRejecting(null)}
            onConfirm={async (reason) => {
              await reject(rejecting, reason);
              setRejecting(null);
            }}
          />
        )}
      </Modal>
    </div>
  );
}

function TabBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 py-2 rounded-lg text-xs font-semibold transition ${
        active ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
      }`}
    >
      {label}
    </button>
  );
}

function OrderCard({
  order, onAccept, onReject, onAdvance, onOpen,
}: {
  order: Order;
  onAccept: () => void;
  onReject: () => void;
  onAdvance: () => void;
  onOpen: () => void;
}) {
  const isNewOrder = isNew(order.status);
  const isDeliveredOrder = isDelivered(order.status);
  const isCancelledOrder = isCancelled(order.status);

  let advanceLabel = '';
  if (order.delivery_type === 'delivery') {
    if (order.status === 'accepted') advanceLabel = 'Kòmanse Preparasyon';
    else if (order.status === 'preparing') advanceLabel = 'Make kòm Ap Livre';
    else if (order.status === 'delivering') advanceLabel = 'Make kòm Livre';
  } else {
    if (order.status === 'accepted') advanceLabel = 'Kòmanse Preparasyon';
    else if (order.status === 'preparing') advanceLabel = 'Make kòm Pare pou Retire';
    else if (order.status === 'ready_pickup') advanceLabel = 'Make kòm Kliyan Retire l';
  }

  return (
    <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm">
      <button onClick={onOpen} className="w-full flex items-center gap-3 text-left active:scale-95 transition">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
          order.delivery_type === 'delivery' ? 'bg-blue-50 text-blue-600' : 'bg-violet-50 text-violet-600'
        }`}>
          {order.delivery_type === 'delivery' ? <Truck size={18} /> : <Package size={18} />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-900 text-sm truncate">
            {order.customer?.full_name ?? 'Kliyan'}
          </p>
          <p className="text-xs text-slate-500">
            {order.items?.length ?? 0} atik · {order.delivery_type === 'delivery' ? 'Livrezon' : 'Vin Pran l'} · {relativeTime(order.created_at)}
          </p>
        </div>
        <div className="text-right">
          <p className="font-bold text-slate-900 text-sm">{formatHTG(order.total)}</p>
          <StatusPill status={order.status} />
        </div>
      </button>

      {isNewOrder && (
        <div className="flex gap-2 mt-3">
          <button
            onClick={onReject}
            className="flex-1 py-2.5 rounded-lg border border-slate-200 text-slate-700 font-semibold text-xs flex items-center justify-center gap-1.5 hover:bg-slate-50 active:scale-95 transition"
          >
            <X size={14} /> Refize
          </button>
          <button
            onClick={onAccept}
            className="flex-1 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition"
          >
            <Check size={14} /> Aksepte
          </button>
        </div>
      )}

      {advanceLabel && (
        <button
          onClick={onAdvance}
          className="w-full mt-3 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition"
        >
          <Check size={14} /> {advanceLabel}
        </button>
      )}

      {(isDeliveredOrder || isCancelledOrder) && (
        <button
          onClick={onOpen}
          className="w-full mt-3 py-2 rounded-lg text-slate-500 font-medium text-xs flex items-center justify-center gap-1 hover:bg-slate-50 active:scale-95 transition"
        >
          Wè rezime <ChevronRight size={14} />
        </button>
      )}
    </div>
  );
}

function OrderDetail({ order, onAdvance }: { order: Order; onAdvance: () => void }) {
  let advanceLabel = '';
  if (order.delivery_type === 'delivery') {
    if (order.status === 'accepted') advanceLabel = 'Kòmanse Preparasyon';
    else if (order.status === 'preparing') advanceLabel = 'Make kòm Ap Livre';
    else if (order.status === 'delivering') advanceLabel = 'Make kòm Livre';
  } else {
    if (order.status === 'accepted') advanceLabel = 'Kòmanse Preparasyon';
    else if (order.status === 'preparing') advanceLabel = 'Make kòm Pare pou Retire';
    else if (order.status === 'ready_pickup') advanceLabel = 'Make kòm Kliyan Retire l';
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <StatusPill status={order.status} />
        <span className="text-xs text-slate-400">{formatDateTime(order.created_at)}</span>
      </div>

      <div className="bg-slate-50 rounded-xl p-3">
        <p className="text-xs font-semibold text-slate-500 mb-1">Kliyan</p>
        <p className="font-semibold text-slate-900 text-sm">{order.customer?.full_name ?? 'Kliyan'}</p>
        {order.customer?.phone && (
          <p className="text-xs text-slate-600 flex items-center gap-1 mt-1">
            <Phone size={12} /> {order.customer.phone}
          </p>
        )}
        {order.delivery_type === 'delivery' && order.customer?.address && (
          <p className="text-xs text-slate-600 flex items-start gap-1 mt-1">
            <MapPin size={12} className="mt-0.5 shrink-0" />
            <span>{order.customer.address}{order.customer.city ? `, ${order.customer.city}` : ''}</span>
          </p>
        )}
      </div>

      <div>
        <p className="text-xs font-semibold text-slate-500 mb-2">Atik yo</p>
        <div className="space-y-2">
          {(order.items ?? []).map((it, i) => (
            <div key={i} className="flex justify-between text-sm">
              <span className="text-slate-700">{it.qty}× {it.name}</span>
              <span className="font-medium text-slate-900">{formatHTG(it.price * it.qty)}</span>
            </div>
          ))}
        </div>
        <div className="flex justify-between mt-3 pt-3 border-t border-slate-100">
          <span className="font-semibold text-slate-900">Total</span>
          <span className="font-bold text-slate-900">{formatHTG(order.total)}</span>
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs text-slate-500">
        <Truck size={14} />
        <span>{order.delivery_type === 'delivery' ? 'Livrezon' : 'Vin Pran l (Pickup)'}</span>
      </div>

      {order.reject_reason && (
        <div className="bg-red-50 rounded-xl p-3 text-xs text-red-700">
          Rezon refi: {order.reject_reason}
        </div>
      )}

      {order.completed_at && (
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Clock size={14} /> Fen: {formatDateTime(order.completed_at)}
        </div>
      )}

      {advanceLabel && (
        <button
          onClick={onAdvance}
          className="w-full py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm active:scale-95 transition"
        >
          {advanceLabel}
        </button>
      )}
    </div>
  );
}

function RejectForm({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: (reason: string) => void }) {
  const [reason, setReason] = useState('');
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">Voule w mete yon rezon pou w refize kòmand sa a? (opsyonèl)</p>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={3}
        placeholder="Rezon..."
        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
      />
      <div className="flex gap-3">
        <button onClick={onCancel} className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-700 font-semibold text-sm hover:bg-slate-50 active:scale-95 transition">
          Anile
        </button>
        <button onClick={() => onConfirm(reason)} className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold text-sm active:scale-95 transition">
          Konfime refi
        </button>
      </div>
    </div>
  );
}
