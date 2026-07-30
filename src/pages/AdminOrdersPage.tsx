import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useAdminAuth } from '@/lib/adminAuth';
import { useToast } from '@/lib/toast';
import { formatHTG, formatDateTime, relativeTime } from '@/lib/format';
import type { Order, OrderItem, Customer, Vendor } from '@/lib/types';
import {
  Search, Loader2, ShoppingCart, ChevronRight, X, FileSpreadsheet,
  FileText, Truck, Store, CheckCircle2, XCircle, Clock, Package,
  Ban, Phone, Mail, MapPin, User, TrendingUp, Calendar,
} from 'lucide-react';

type OrderWithRelations = Order & {
  customer?: Pick<Customer, 'full_name' | 'phone' | 'email' | 'department' | 'city' | 'address'> | null;
  vendor?: Pick<Vendor, 'business_name' | 'phone' | 'email' | 'department' | 'city' | 'address'> | null;
};

type StatusFilter = 'all' | 'pending' | 'accepted' | 'preparing' | 'ready_pickup' | 'delivering' | 'delivered' | 'picked_up' | 'cancelled';

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'Tout' },
  { key: 'pending', label: 'Nouvo' },
  { key: 'accepted', label: 'Aksepte' },
  { key: 'preparing', label: 'An Preparasyon' },
  { key: 'ready_pickup', label: 'Pare pou Retire' },
  { key: 'delivering', label: 'Ap Livre' },
  { key: 'delivered', label: 'Livre' },
  { key: 'picked_up', label: 'Kliyan Retire l' },
  { key: 'cancelled', label: 'Anile' },
];

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  accepted: 'bg-blue-100 text-blue-700',
  preparing: 'bg-blue-100 text-blue-700',
  ready_pickup: 'bg-violet-100 text-violet-700',
  delivering: 'bg-indigo-100 text-indigo-700',
  delivered: 'bg-emerald-100 text-emerald-700',
  picked_up: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-rose-100 text-rose-700',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Nouvo',
  accepted: 'Aksepte',
  preparing: 'An Preparasyon',
  ready_pickup: 'Pare pou Retire',
  delivering: 'Ap Livre',
  delivered: 'Livre',
  picked_up: 'Kliyan Retire l',
  cancelled: 'Anile',
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  pending: <Clock size={12} />,
  accepted: <CheckCircle2 size={12} />,
  preparing: <Package size={12} />,
  ready_pickup: <Store size={12} />,
  delivering: <Truck size={12} />,
  delivered: <CheckCircle2 size={12} />,
  picked_up: <CheckCircle2 size={12} />,
  cancelled: <XCircle size={12} />,
};

export function AdminOrdersPage() {
  const { toast } = useToast();
  const [orders, setOrders] = useState<OrderWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<OrderWithRelations | null>(null);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('orders')
      .select(`
        *,
        customer:customers(full_name, phone, email, department, city, address),
        vendor:vendors(business_name, phone, email, department, city, address)
      `)
      .order('created_at', { ascending: false });

    if (filter !== 'all') {
      query = query.eq('status', filter);
    }

    const { data, error } = await query.limit(200);
    if (error) {
      toast('Erè lè w ap chaje kòmand yo', 'error');
      setLoading(false);
      return;
    }

    let list = (data ?? []) as unknown as OrderWithRelations[];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((o) =>
        o.id.toLowerCase().includes(q) ||
        (o.customer?.full_name ?? '').toLowerCase().includes(q) ||
        (o.vendor?.business_name ?? '').toLowerCase().includes(q)
      );
    }
    setOrders(list);
    setLoading(false);
  }, [filter, search, toast]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  useEffect(() => {
    const channel = supabase
      .channel('admin-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => loadOrders())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadOrders]);

  // Summary calculations
  const summary = useMemo(() => {
    const now = new Date();
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startWeek = new Date(startToday);
    startWeek.setDate(startWeek.getDate() - startWeek.getDay());
    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    let todayCount = 0, weekCount = 0, monthCount = 0;
    let todayRevenue = 0, weekRevenue = 0, monthRevenue = 0;

    for (const o of orders) {
      const d = new Date(o.created_at);
      const rev = (o.status === 'delivered' || o.status === 'picked_up') ? Number(o.total) : 0;
      if (d >= startToday) { todayCount++; todayRevenue += rev; }
      if (d >= startWeek) { weekCount++; weekRevenue += rev; }
      if (d >= startMonth) { monthCount++; monthRevenue += rev; }
    }
    return { todayCount, weekCount, monthCount, todayRevenue, weekRevenue, monthRevenue };
  }, [orders]);

  const handleExportExcel = () => {
    const rows = orders.map((o) => ({
      ID: o.id.slice(0, 8),
      Dat: formatDateTime(o.created_at),
      Kliyan: o.customer?.full_name ?? '—',
      TelefonKliyan: o.customer?.phone ?? '—',
      Vandè: o.vendor?.business_name ?? '—',
      TelefonVandè: o.vendor?.phone ?? '—',
      TipLivrezon: o.delivery_type === 'delivery' ? 'Livrezon' : 'Vin Pran l',
      Estati: STATUS_LABELS[o.status] ?? o.status,
      Peman: o.payment_status === 'paid' ? 'Paye' : 'An Atant',
      Total: Number(o.total),
      Atik: (o.items ?? []).map((i: OrderItem) => `${i.name} x${i.qty}`).join('; '),
    }));

    const headers = Object.keys(rows[0] ?? { ID: '' });
    const csv = [
      headers.join(','),
      ...rows.map((r) => headers.map((h) => `"${String((r as Record<string, string | number>)[h] ?? '').replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kòmand_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast('Ekspòtasyon Excel/CSV telechaje');
  };

  const handleExportPdf = () => {
    const win = window.open('', '_blank');
    if (!win) {
      toast('Bloke pop-up — pèmèt pop-up pou w ekspòte PDF', 'error');
      return;
    }
    const rowsHtml = orders.map((o, idx) => `
      <tr style="background:${idx % 2 ? '#f8fafc' : '#fff'}">
        <td style="padding:6px 8px;border:1px solid #e2e8f0;font-size:11px">${o.id.slice(0, 8)}</td>
        <td style="padding:6px 8px;border:1px solid #e2e8f0;font-size:11px">${formatDateTime(o.created_at)}</td>
        <td style="padding:6px 8px;border:1px solid #e2e8f0;font-size:11px">${o.customer?.full_name ?? '—'}</td>
        <td style="padding:6px 8px;border:1px solid #e2e8f0;font-size:11px">${o.vendor?.business_name ?? '—'}</td>
        <td style="padding:6px 8px;border:1px solid #e2e8f0;font-size:11px">${o.delivery_type === 'delivery' ? 'Livrezon' : 'Vin Pran l'}</td>
        <td style="padding:6px 8px;border:1px solid #e2e8f0;font-size:11px">${STATUS_LABELS[o.status] ?? o.status}</td>
        <td style="padding:6px 8px;border:1px solid #e2e8f0;font-size:11px">${o.payment_status === 'paid' ? 'Paye' : 'An Atant'}</td>
        <td style="padding:6px 8px;border:1px solid #e2e8f0;font-size:11px;text-align:right">${formatHTG(o.total)}</td>
      </tr>
    `).join('');

    win.document.write(`
      <html><head><title>Kòmand TOUPRE — ${new Date().toLocaleDateString('fr-HT')}</title>
      <style>body{font-family:system-ui,sans-serif;padding:20px}h1{font-size:18px}table{width:100%;border-collapse:collapse;margin-top:12px}th{background:#0f172a;color:#fff;padding:8px;font-size:11px;text-align:left}</style>
      </head><body>
      <h1>Rele Kòmand TOUPRE</h1>
      <p style="font-size:12px;color:#64748b">Ekspòte: ${formatDateTime(new Date().toISOString())} · Total: ${orders.length} kòmand</p>
      <table><thead><tr>
        <th>ID</th><th>Dat</th><th>Kliyan</th><th>Vandè</th><th>Tip</th><th>Estati</th><th>Peman</th><th>Total</th>
      </tr></thead><tbody>${rowsHtml}</tbody></table>
      <script>window.onload=()=>window.print()</script>
      </body></html>
    `);
    win.document.close();
    toast('Ekspòtasyon PDF louvri');
  };

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <SummaryCard label="Jodi a" count={summary.todayCount} revenue={summary.todayRevenue} icon={<Calendar size={16} />} color="bg-blue-500" />
        <SummaryCard label="Semèn nan" count={summary.weekCount} revenue={summary.weekRevenue} icon={<TrendingUp size={16} />} color="bg-emerald-500" />
        <SummaryCard label="Mwa a" count={summary.monthCount} revenue={summary.monthRevenue} icon={<ShoppingCart size={16} />} color="bg-amber-500" />
      </div>

      {/* Filters + search + export */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex gap-1 p-1 bg-white rounded-xl border border-slate-200 overflow-x-auto no-scrollbar">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                filter === f.key ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Chache pa ID, kliyan, oswa vandè..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 bg-white text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleExportExcel}
          className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition active:scale-95"
        >
          <FileSpreadsheet size={16} />
          Ekspòte Excel
        </button>
        <button
          onClick={handleExportPdf}
          className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold transition active:scale-95"
        >
          <FileText size={16} />
          Ekspòte PDF
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="animate-spin text-slate-400" size={24} />
        </div>
      ) : orders.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center">
          <img src="/toupre_vande_logo.png" alt="TOUPRE" className="w-7 h-7 mx-auto mb-3 opacity-40 object-contain" />
          <p className="text-sm text-slate-400">Pa gen kòmand nan filt sa a.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {orders.map((o) => (
            <button
              key={o.id}
              onClick={() => setSelected(o)}
              className="w-full bg-white rounded-2xl border border-slate-200 p-4 shadow-sm hover:shadow-md hover:border-slate-300 transition text-left active:scale-[0.99]"
            >
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 shrink-0">
                  {o.delivery_type === 'delivery' ? <Truck size={20} /> : <Store size={20} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-slate-900 text-sm">#{o.id.slice(0, 8)}</p>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold flex items-center gap-1 ${STATUS_STYLES[o.status]}`}>
                      {STATUS_ICONS[o.status]}
                      {STATUS_LABELS[o.status] ?? o.status}
                    </span>
                    {o.payment_status === 'paid' && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-600">Paye</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 truncate mt-0.5">
                    {o.customer?.full_name ?? 'Kliyan'} → {o.vendor?.business_name ?? 'Vandè'}
                  </p>
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-xs text-slate-400">{relativeTime(o.created_at)}</p>
                    <p className="text-sm font-bold text-slate-900">{formatHTG(o.total)}</p>
                  </div>
                </div>
                <ChevronRight size={18} className="text-slate-300 shrink-0 mt-1" />
              </div>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <OrderDetailModal order={selected} onClose={() => setSelected(null)} onChanged={loadOrders} />
      )}
    </div>
  );
}

function SummaryCard({ label, count, revenue, icon, color }: {
  label: string; count: number; revenue: number; icon: React.ReactNode; color: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-3 sm:p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-7 h-7 rounded-lg ${color} text-white flex items-center justify-center`}>{icon}</div>
        <p className="text-xs font-semibold text-slate-500">{label}</p>
      </div>
      <p className="text-xl font-bold text-slate-900">{count}</p>
      <p className="text-xs text-slate-400">{formatHTG(revenue)}</p>
    </div>
  );
}

function OrderDetailModal({ order, onClose, onChanged }: {
  order: OrderWithRelations;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { admin } = useAdminAuth();
  const { toast } = useToast();
  const [history, setHistory] = useState<{ id: string; status: string; created_at: string; changed_by: string | null }[]>([]);
  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    supabase
      .from('order_status_history')
      .select('id, status, created_at, changed_by')
      .eq('order_id', order.id)
      .order('created_at', { ascending: true })
      .then(({ data }) => setHistory((data ?? []) as typeof history));
  }, [order.id]);

  const handleCancel = async () => {
    if (!admin) return;
    if (!cancelReason.trim()) {
      toast('Ou dwe bay yon rezon pou anile kòmand sa a', 'error');
      return;
    }
    setCancelling(true);
    try {
      const { error } = await supabase.rpc('admin_cancel_order', {
        p_order_id: order.id,
        p_reason: cancelReason,
        p_reviewer_id: admin.id,
      });
      if (error) throw error;
      toast('Kòmand anile pa Admin');
      setShowCancel(false);
      onClose();
      onChanged();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erè pandan anilasyon';
      toast(msg, 'error');
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="bg-white w-full max-w-2xl rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[92vh] flex flex-col animate-slide-up" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <img src="/toupre_vande_logo.png" alt="TOUPRE" className="w-5 h-5 object-contain" />
            <h2 className="font-bold text-slate-900 text-base">Kòmand #{order.id.slice(0, 8)}</h2>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold flex items-center gap-1 ${STATUS_STYLES[order.status]}`}>
              {STATUS_ICONS[order.status]}
              {STATUS_LABELS[order.status] ?? order.status}
            </span>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 active:scale-90 transition">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Items */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">Atik yo</h3>
            <div className="bg-slate-50 rounded-xl divide-y divide-slate-100">
              {(order.items ?? []).map((item: OrderItem, i: number) => (
                <div key={i} className="flex items-center justify-between px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{item.name}</p>
                    <p className="text-xs text-slate-400">{item.qty} × {formatHTG(item.price)}</p>
                  </div>
                  <p className="text-sm font-semibold text-slate-900">{formatHTG(item.qty * item.price)}</p>
                </div>
              ))}
              <div className="flex items-center justify-between px-3 py-3 bg-slate-100 rounded-b-xl">
                <p className="text-sm font-bold text-slate-900">Total</p>
                <p className="text-lg font-bold text-emerald-600">{formatHTG(order.total)}</p>
              </div>
            </div>
          </div>

          {/* Delivery info */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">Livrezon</h3>
            <div className="bg-slate-50 rounded-xl p-3 space-y-2">
              <div className="flex items-center gap-2 text-sm">
                {order.delivery_type === 'delivery' ? <Truck size={16} className="text-slate-400" /> : <Store size={16} className="text-slate-400" />}
                <span className="font-medium text-slate-900">
                  {order.delivery_type === 'delivery' ? 'Livrezon' : 'Vin Pran l'}
                </span>
              </div>
              {order.delivery_note && (
                <div className="flex items-start gap-2 text-sm">
                  <MapPin size={16} className="text-slate-400 mt-0.5 shrink-0" />
                  <span className="text-slate-600">{order.delivery_note}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-sm">
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                  order.payment_status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                }`}>
                  MonCash: {order.payment_status === 'paid' ? 'Paye' : 'An Atant'}
                </span>
              </div>
            </div>
          </div>

          {/* Customer */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">Kliyan</h3>
            <div className="bg-slate-50 rounded-xl p-3 space-y-1.5">
              <InfoRow icon={<User size={14} />} label="Non" value={order.customer?.full_name ?? '—'} />
              <InfoRow icon={<Phone size={14} />} label="Telefon" value={order.customer?.phone ?? '—'} href={order.customer?.phone ? `tel:${order.customer.phone}` : undefined} />
              <InfoRow icon={<Mail size={14} />} label="Imèl" value={order.customer?.email ?? '—'} />
              <InfoRow icon={<MapPin size={14} />} label="Lokalizasyon" value={[
                order.customer?.department,
                order.customer?.city,
                order.customer?.address,
              ].filter(Boolean).join(', ') || '—'} />
            </div>
          </div>

          {/* Vendor */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">Vandè</h3>
            <div className="bg-slate-50 rounded-xl p-3 space-y-1.5">
              <InfoRow icon={<Store size={14} />} label="Biznis" value={order.vendor?.business_name ?? '—'} />
              <InfoRow icon={<Phone size={14} />} label="Telefon" value={order.vendor?.phone ?? '—'} href={order.vendor?.phone ? `tel:${order.vendor.phone}` : undefined} />
              <InfoRow icon={<Mail size={14} />} label="Imèl" value={order.vendor?.email ?? '—'} />
              <InfoRow icon={<MapPin size={14} />} label="Lokalizasyon" value={[
                order.vendor?.department,
                order.vendor?.city,
                order.vendor?.address,
              ].filter(Boolean).join(', ') || '—'} />
            </div>
          </div>

          {/* Status history */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">Istorik Estati</h3>
            <div className="bg-slate-50 rounded-xl p-3">
              {history.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-2">Pa gen istorik toujou.</p>
              ) : (
                <div className="space-y-3">
                  {history.map((h, i) => (
                    <div key={h.id} className="flex items-start gap-3">
                      <div className="flex flex-col items-center">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white ${STATUS_STYLES[h.status] ?? 'bg-slate-300'}`}>
                          {STATUS_ICONS[h.status] ?? <Clock size={12} />}
                        </div>
                        {i < history.length - 1 && <div className="w-0.5 h-5 bg-slate-200" />}
                      </div>
                      <div className="flex-1 pb-1">
                        <p className="text-sm font-medium text-slate-900">{STATUS_LABELS[h.status] ?? h.status}</p>
                        <p className="text-xs text-slate-400">{formatDateTime(h.created_at)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {order.reject_reason && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3">
              <p className="text-xs font-semibold text-rose-700 mb-1">Rezon Anilasyon</p>
              <p className="text-sm text-rose-600">{order.reject_reason}</p>
            </div>
          )}
        </div>

        {/* Admin cancel action */}
        {order.status !== 'cancelled' && order.status !== 'delivered' && order.status !== 'picked_up' && (
          <div className="px-5 py-4 border-t border-slate-100">
            {showCancel ? (
              <div className="space-y-3">
                <textarea
                  placeholder="Rezon pou anile kòmand sa a (dispit, pwoblèm, elatriye)..."
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  rows={2}
                  className="w-full p-3 rounded-xl border border-slate-200 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowCancel(false)}
                    className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition"
                  >
                    Anile
                  </button>
                  <button
                    onClick={handleCancel}
                    disabled={cancelling}
                    className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold flex items-center justify-center gap-2 transition disabled:opacity-50"
                  >
                    {cancelling ? <Loader2 size={16} className="animate-spin" /> : <Ban size={16} />}
                    Konfime Anilasyon
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowCancel(true)}
                className="w-full py-2.5 rounded-xl border border-rose-200 text-rose-600 text-sm font-semibold hover:bg-rose-50 transition flex items-center justify-center gap-2"
              >
                <Ban size={16} />
                Anile Kòmand (Admin)
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function InfoRow({ icon, label, value, href }: { icon: React.ReactNode; label: string; value: string; href?: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-slate-400 shrink-0">{icon}</span>
      <span className="text-slate-500 shrink-0">{label}:</span>
      {href ? (
        <a href={href} className="text-emerald-600 font-medium truncate hover:underline">{value}</a>
      ) : (
        <span className="text-slate-900 font-medium truncate">{value}</span>
      )}
    </div>
  );
}
