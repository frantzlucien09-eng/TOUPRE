import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { formatHTG } from '@/lib/format';
import { Header } from '@/components/Header';
import { EmptyState } from '@/components/EmptyState';
import { SellerBadge } from '@/components/SellerBadge';
import { DateRangeFilter, getRangeStartDate, formatRangeLabel, type DateRangeKey } from '@/components/DateRangeFilter';
import {
  Wallet, TrendingUp, ClipboardList, Percent, Star,
  Clock, Loader2, Package, ShoppingBag,
} from 'lucide-react';

type DashboardData = {
  total_sales: number;
  total_orders: number;
  completed_orders: number;
  cancelled_orders: number;
  total_commission: number;
  vendor_revenue: number;
  available_balance: number;
  pending_balance: number;
  withdrawn_balance: number;
  total_earnings: number;
  pending_payout: number;
  average_rating: number;
  rating_count: number;
  ranking: number | null;
  seller_badge: string | null;
  today: { sales: number; orders: number };
  week: { sales: number; orders: number };
  month: { sales: number; orders: number };
};

export function VendorDashboardPage({ onBack }: { onBack: () => void }) {
  const { vendor } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRangeKey>('30d');

  const load = useCallback(async (range: DateRangeKey) => {
    if (!vendor) return;
    if (data) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      const startDate = getRangeStartDate(range);
      const { data: result, error: rpcError } = await supabase.rpc('get_vendor_dashboard', { p_vendor_id: vendor.id, p_start_date: startDate });
      if (rpcError) throw rpcError;
      if (result && !result.error) {
        const d = result as DashboardData;
        setData({
          ...d,
          today: d.today ?? { sales: 0, orders: 0 },
          week: d.week ?? { sales: 0, orders: 0 },
          month: d.month ?? { sales: 0, orders: 0 },
        });
      }
    } catch (err: any) {
      console.error('[vendor dashboard]', err);
      setError(err?.message ?? 'Erè, eseye ankò');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [vendor, data]);

  useEffect(() => {
    load(dateRange);
    if (!vendor) return;
    const channel = supabase
      .channel('vendor-dashboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `vendor_id=eq.${vendor.id}` }, () => load(dateRange))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vendor_stats', filter: `vendor_id=eq.${vendor.id}` }, () => load(dateRange))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'withdrawals', filter: `vendor_id=eq.${vendor.id}` }, () => load(dateRange))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [vendor]);

  const handleRangeChange = (range: DateRangeKey) => {
    setDateRange(range);
    load(range);
  };

  if (!vendor) return null;

  return (
    <div className="pb-24">
      <Header title="Tablo Bò" subtitle={`Statistik vandè · ${formatRangeLabel(dateRange)}`} onBack={onBack} />
      <div className="px-4 pt-4 space-y-4">
        <div className="flex items-center gap-2">
          {refreshing && <Loader2 size={14} className="animate-spin text-slate-400" />}
          <DateRangeFilter value={dateRange} onChange={handleRangeChange} compact />
        </div>

        {loading && !data ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="animate-spin text-emerald-500" size={28} /></div>
        ) : error && !data ? (
          <div className="text-center py-16 px-4">
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center mx-auto mb-3"><TrendingUp size={24} /></div>
            <p className="text-sm font-semibold text-slate-900">Done pa ka chaje</p>
            <p className="text-xs text-slate-500 mt-1">{error}</p>
            <button onClick={() => load(dateRange)} className="mt-4 px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold active:scale-95 transition">Eseye ankò</button>
          </div>
        ) : !data ? (
          <EmptyState icon={<TrendingUp size={24} />} title="Pa gen done toujou" message="Statistik yo ap parèt lè ou gen kòmand." />
        ) : (
          <>
            {data.seller_badge && (
              <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-5 text-white shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-slate-400">Nivo vandè ou</p>
                    <div className="mt-2"><SellerBadge badge={data.seller_badge} size="lg" /></div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-400">Klasman</p>
                    <p className="text-2xl font-bold mt-1">#{data.ranking ?? '—'}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-gradient-to-br from-emerald-600 to-emerald-700 rounded-2xl p-5 text-white shadow-sm">
              <div className="flex items-center gap-2 text-emerald-50 text-xs"><Wallet size={16} /> Revni total</div>
              <p className="text-3xl font-bold mt-1">{formatHTG(data.vendor_revenue)}</p>
              <div className="grid grid-cols-2 gap-3 mt-4">
                <div className="bg-white/10 rounded-xl p-3">
                  <p className="text-[11px] text-emerald-100">Balans disponib</p>
                  <p className="text-lg font-bold mt-0.5">{formatHTG(data.available_balance)}</p>
                </div>
                <div className="bg-white/10 rounded-xl p-3">
                  <p className="text-[11px] text-emerald-100">Balans an atant</p>
                  <p className="text-lg font-bold mt-0.5">{formatHTG(data.pending_balance)}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-2">
                <div className="bg-white/10 rounded-xl p-3">
                  <p className="text-[11px] text-emerald-100">Lajan retire</p>
                  <p className="text-lg font-bold mt-0.5">{formatHTG(data.withdrawn_balance)}</p>
                </div>
                <div className="bg-white/10 rounded-xl p-3">
                  <p className="text-[11px] text-emerald-100">Total revni</p>
                  <p className="text-lg font-bold mt-0.5">{formatHTG(data.total_earnings)}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <StatCard icon={<ClipboardList size={18} />} label="Kòmand total" value={String(data.total_orders)} color="text-slate-900" bg="bg-slate-100" />
              <StatCard icon={<ShoppingBag size={18} />} label="Kòmand fini" value={String(data.completed_orders)} color="text-emerald-600" bg="bg-emerald-50" />
              <StatCard icon={<Package size={18} />} label="Anile" value={String(data.cancelled_orders)} color="text-rose-500" bg="bg-rose-50" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center"><Percent size={18} /></div>
                  <div><p className="text-xs text-slate-500">Komisyon peye</p><p className="text-lg font-bold text-slate-900">{formatHTG(data.total_commission)}</p></div>
                </div>
              </div>
              <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-full bg-violet-50 text-violet-600 flex items-center justify-center"><Star size={18} /></div>
                  <div><p className="text-xs text-slate-500">Nòt mwayèn</p><p className="text-lg font-bold text-slate-900">{Number(data.average_rating).toFixed(1)} ({data.rating_count})</p></div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
              <h3 className="font-bold text-slate-900 text-sm mb-3 flex items-center gap-2"><TrendingUp size={16} className="text-emerald-600" /> Rapò pa peryòd</h3>
              <div className="space-y-2">
                <PeriodRow label="Jodi a" sales={data.today.sales} orders={data.today.orders} />
                <PeriodRow label="Semèn sa a" sales={data.week.sales} orders={data.week.orders} />
                <PeriodRow label="Mwa sa a" sales={data.month.sales} orders={data.month.orders} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
                <p className="text-xs text-slate-500">Vant total</p>
                <p className="text-xl font-bold text-slate-900 mt-1">{formatHTG(data.total_sales)}</p>
              </div>
              <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
                <p className="text-xs text-slate-500">Demann retire an atant</p>
                <p className="text-xl font-bold text-slate-900 mt-1">{formatHTG(data.pending_payout)}</p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color, bg }: { icon: React.ReactNode; label: string; value: string; color: string; bg: string }) {
  return (
    <div className="bg-white rounded-2xl p-3 border border-slate-100 shadow-sm text-center">
      <div className={`w-9 h-9 rounded-full ${bg} ${color} flex items-center justify-center mx-auto`}>{icon}</div>
      <p className="text-lg font-bold text-slate-900 mt-2">{value}</p>
      <p className="text-[10px] text-slate-500 mt-0.5">{label}</p>
    </div>
  );
}

function PeriodRow({ label, sales, orders }: { label: string; sales: number; orders: number }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
      <span className="text-sm text-slate-600 flex items-center gap-2"><Clock size={14} className="text-slate-400" /> {label}</span>
      <div className="text-right">
        <span className="font-bold text-slate-900 text-sm">{formatHTG(sales)}</span>
        <span className="text-xs text-slate-400 ml-2">{orders} kòmand</span>
      </div>
    </div>
  );
}
