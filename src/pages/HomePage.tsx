import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { formatHTG, isToday, relativeTime } from '@/lib/format';
import type { Order, Notification, Product } from '@/lib/types';
import { Header } from '@/components/Header';
import { EmptyState } from '@/components/EmptyState';
import { ProductCard } from '@/components/ProductCard';
import { TrendingUp, Wallet, ClipboardList, ChevronRight, Truck, Package, Flame, BarChart3 } from 'lucide-react';

type Props = {
  onOpenNotifications: () => void;
  onOpenOrder: (order: Order) => void;
  onGoOrders: (filter: 'today' | 'new') => void;
  onGoTopVendors: () => void;
  onGoBalance: () => void;
  onGoProducts: () => void;
  onGoDashboard: () => void;
};

export function HomePage({ onOpenNotifications, onOpenOrder, onGoOrders, onGoTopVendors, onGoBalance, onGoProducts, onGoDashboard }: Props) {
  const { vendor, user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [todayRevenue, setTodayRevenue] = useState(0);
  const [todayCount, setTodayCount] = useState(0);
  const [zoneRank, setZoneRank] = useState<number | null>(null);
  const [nationalRank, setNationalRank] = useState<number | null>(null);
  const [unread, setUnread] = useState(0);
  const [myProducts, setMyProducts] = useState<Product[]>([]);

  useEffect(() => {
    if (!vendor) return;
    const load = async () => {
      const { data: ords } = await supabase
        .from('orders')
        .select('*, customer:customers(full_name, phone)')
        .eq('vendor_id', vendor.id)
        .order('created_at', { ascending: false })
        .limit(20);
      const list = (ords ?? []) as unknown as Order[];
      setOrders(list);
      const todays = list.filter((o) => isToday(o.created_at));
      setTodayCount(todays.length);
      setTodayRevenue(todays.reduce((s, o) => s + Number(o.total), 0));

      const { data: rank } = await supabase
        .from('vendor_rankings')
        .select('zone_rank, national_rank, score')
        .eq('vendor_id', vendor.id)
        .maybeSingle();
      setZoneRank(rank?.zone_rank ?? null);
      setNationalRank(rank?.national_rank ?? null);

      const { count } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', vendor.id)
        .eq('read', false);
      setUnread(count ?? 0);

      const { data: prods } = await supabase
        .from('products')
        .select('*')
        .eq('vendor_id', vendor.id)
        .order('created_at', { ascending: false })
        .limit(4);
      setMyProducts((prods ?? []) as Product[]);
    };
    load();

    const channel = supabase
      .channel('home-rankings')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vendor_rankings', filter: `vendor_id=eq.${vendor.id}` }, (payload) => {
        const r = payload.new as { zone_rank?: number; national_rank?: number };
        setZoneRank(r.zone_rank ?? null);
        setNationalRank(r.national_rank ?? null);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [vendor]);

  if (!vendor) return null;

  const incoming = orders.slice(0, 5);

  return (
    <div className="pb-24">
      <Header
        title={`Byenveni, ${vendor.business_name}`}
        subtitle="Akèy vandè"
        notificationCount={unread}
        onNotifications={onOpenNotifications}
      />

      <div className="px-4 pt-4 space-y-4">
        {/* Metric cards */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={onGoBalance}
            className="text-left bg-gradient-to-br from-emerald-600 to-emerald-700 rounded-2xl p-4 text-white shadow-sm active:scale-95 transition"
          >
            <div className="flex items-center justify-between">
              <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
                <Wallet size={18} />
              </div>
            </div>
            <p className="text-emerald-50 text-xs mt-3">Kòb jodi a</p>
            <p className="text-xl font-bold mt-0.5">{formatHTG(todayRevenue)}</p>
          </button>

          <button
            onClick={() => onGoOrders('today')}
            className="text-left bg-white rounded-2xl p-4 border border-slate-100 shadow-sm active:scale-95 transition"
          >
            <div className="w-9 h-9 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <ClipboardList size={18} />
            </div>
            <p className="text-slate-500 text-xs mt-3">Kòmand jodi a</p>
            <p className="text-xl font-bold text-slate-900 mt-0.5">{todayCount}</p>
          </button>
        </div>

        {/* Top position banner */}
        <button
          onClick={onGoTopVendors}
          className="w-full flex items-center gap-3 bg-white rounded-2xl p-4 border border-slate-100 shadow-sm active:scale-95 transition"
        >
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <TrendingUp size={20} />
          </div>
          <div className="flex-1 text-left">
            <p className="text-xs text-slate-500">Pozisyon ou mwa sa a</p>
            <p className="text-sm font-semibold text-slate-900">
              {nationalRank ? `Top Nasyonal #${nationalRank}` : 'Pa gen klasman toujou'}
              {zoneRank ? ` · Top Zòn #${zoneRank}` : ''}
            </p>
          </div>
          <ChevronRight size={18} className="text-slate-300" />
        </button>

        {/* My products preview */}
        {myProducts.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                <Flame size={16} className="text-rose-500" /> Pwodwi mwen yo
              </h2>
              <button onClick={onGoProducts} className="text-xs text-emerald-600 font-semibold">
                Wè tout
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {myProducts.map((p) => (
                <ProductCard key={p.id} product={p} onClick={onGoProducts} />
              ))}
            </div>
          </div>
        )}

        {/* Vendor Dashboard shortcut */}
        <button
          onClick={onGoDashboard}
          className="w-full flex items-center gap-3 bg-white rounded-2xl p-4 border border-slate-100 shadow-sm active:scale-95 transition"
        >
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <BarChart3 size={20} />
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-semibold text-slate-900">Tablo Bò Vandè</p>
            <p className="text-xs text-slate-500">Wè statistik, revni, komisyon, ak badj ou</p>
          </div>
          <ChevronRight size={18} className="text-slate-300" />
        </button>

        {/* Incoming orders */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-bold text-slate-900 text-sm">Kòmand k ap antre</h2>
            <button onClick={() => onGoOrders('new')} className="text-xs text-emerald-600 font-semibold">
            Wè tout
            </button>
          </div>

          {incoming.length === 0 ? (
            <EmptyState
              icon={<ClipboardList size={24} />}
              title="Pa gen kòmand toujou"
              message="Lè kliyan pase kòmand, yo parèt isit la."
            />
          ) : (
            <div className="space-y-2">
              {incoming.map((o) => (
                <button
                  key={o.id}
                  onClick={() => onOpenOrder(o)}
                  className="w-full flex items-center gap-3 bg-white rounded-xl p-3 border border-slate-100 shadow-sm active:scale-95 transition text-left"
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    o.delivery_type === 'delivery' ? 'bg-blue-50 text-blue-600' : 'bg-violet-50 text-violet-600'
                  }`}>
                    {o.delivery_type === 'delivery' ? <Truck size={18} /> : <Package size={18} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900 text-sm truncate">
                      {o.customer?.full_name ?? 'Kliyan'}
                    </p>
                    <p className="text-xs text-slate-500">
                      {o.delivery_type === 'delivery' ? 'Livrezon' : 'Vin Pran l'} · {relativeTime(o.created_at)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-slate-900 text-sm">{formatHTG(o.total)}</p>
                    <StatusPill status={o.status} />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function StatusPill({ status }: { status: string }) {
  const labels: Record<string, string> = {
    pending: 'Nouvo',
    accepted: 'Aksepte',
    preparing: 'An Preparasyon',
    ready_pickup: 'Pare pou Retire',
    delivering: 'Ap Livre',
    delivered: 'Livre',
    picked_up: 'Kliyan Retire l',
    cancelled: 'Anile',
  };
  const styles: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-700',
    accepted: 'bg-blue-100 text-blue-700',
    preparing: 'bg-blue-100 text-blue-700',
    ready_pickup: 'bg-violet-100 text-violet-700',
    delivering: 'bg-indigo-100 text-indigo-700',
    delivered: 'bg-emerald-100 text-emerald-700',
    picked_up: 'bg-emerald-100 text-emerald-700',
    cancelled: 'bg-slate-200 text-slate-600',
  };
  const label = labels[status] ?? status;
  const cls = styles[status] ?? 'bg-slate-100 text-slate-600';
  return <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${cls}`}>{label}</span>;
}
