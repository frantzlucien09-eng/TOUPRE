import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/lib/toast';
import { formatHTG } from '@/lib/format';
import { SellerBadge } from '@/components/SellerBadge';
import { DateRangeFilter, getRangeStartDate, formatRangeLabel, type DateRangeKey } from '@/components/DateRangeFilter';
import {
  DollarSign, TrendingUp, ShoppingCart, Users, Percent, Wallet,
  Trophy, Package, BarChart3, Loader2, Save, Crown, Medal, Award, Shield, Sparkles, Plus, Trash2,
} from 'lucide-react';

type Analytics = {
  platform_revenue: number;
  total_commission: number;
  vendor_payouts: number;
  total_orders: number;
  completed_orders: number;
  active_vendors: number;
  today: { revenue: number; orders: number };
  week: { revenue: number; orders: number };
  month: { revenue: number; orders: number };
  top_sellers: TopSeller[];
  top_products: TopProduct[];
  daily: PeriodPoint[];
  weekly: PeriodPoint[];
  monthly: PeriodPoint[];
};

type TopSeller = {
  vendor_id: string;
  business_name: string;
  avatar_url: string | null;
  total_sales: number;
  completed_orders: number;
  vendor_revenue: number;
  total_commission: number;
  average_rating: number;
  ranking: number | null;
  seller_badge: string | null;
};

type TopProduct = {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
  vendor_id: string;
  business_name: string;
  sales_count: number;
  search_count: number;
};

type PeriodPoint = {
  day?: string;
  week?: string;
  month?: string;
  orders: number;
  revenue: number;
  commission: number;
};

type CommissionTier = {
  id: string;
  label: string;
  min_order_amount: number;
  commission_rate: number;
  is_default: boolean;
  is_active: boolean;
  sort_order: number;
};

type BadgeThreshold = {
  id: string;
  badge_tier: string;
  label: string;
  min_total_sales: number;
  min_total_orders: number;
  min_avg_rating: number;
  min_vendor_revenue: number;
  sort_order: number;
  is_active: boolean;
};

const THRESHOLD_ICONS: Record<string, typeof Crown> = {
  crown: Crown, medal: Medal, award: Award, shield: Shield, sparkles: Sparkles,
};

const ICON_KEYS: Record<string, string> = {
  elite: 'crown', gold: 'medal', silver: 'award', bronze: 'shield', rising: 'sparkles',
};

export function AdminAnalyticsPage({ initialTab }: { initialTab?: 'overview' | 'sellers' | 'products' | 'reports' | 'commission' | 'badges' }) {
  const { toast } = useToast();
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'overview' | 'sellers' | 'products' | 'reports' | 'commission' | 'badges'>(initialTab ?? 'overview');
  const [dateRange, setDateRange] = useState<DateRangeKey>('30d');

  const [tiers, setTiers] = useState<CommissionTier[]>([]);
  const [tiersLoading, setTiersLoading] = useState(false);
  const [tierSaving, setTierSaving] = useState<string | null>(null);

  const [thresholds, setThresholds] = useState<BadgeThreshold[]>([]);
  const [thresholdsLoading, setThresholdsLoading] = useState(false);
  const [thresholdSaving, setThresholdSaving] = useState<string | null>(null);

  const load = useCallback(async (range: DateRangeKey) => {
    if (data) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      const startDate = getRangeStartDate(range);
      const { data: result, error: rpcError } = await supabase.rpc('get_admin_analytics', { p_start_date: startDate });
      if (rpcError) throw rpcError;
      if (result && !result.error) {
        const d = result as Analytics;
        setData({
          ...d,
          today: d.today ?? { revenue: 0, orders: 0 },
          week: d.week ?? { revenue: 0, orders: 0 },
          month: d.month ?? { revenue: 0, orders: 0 },
          top_sellers: d.top_sellers ?? [],
          top_products: d.top_products ?? [],
          daily: d.daily ?? [],
          weekly: d.weekly ?? [],
          monthly: d.monthly ?? [],
        });
      }
    } catch (err: unknown) {
      console.error('[admin analytics]', err);
      setError(err instanceof Error ? err.message : 'Erè, eseye ankò');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [data]);

  const loadTiers = useCallback(async () => {
    setTiersLoading(true);
    const { data } = await supabase.from('commission_config').select('*').order('sort_order', { ascending: true });
    setTiers((data ?? []) as CommissionTier[]);
    setTiersLoading(false);
  }, []);

  const loadThresholds = useCallback(async () => {
    setThresholdsLoading(true);
    const { data } = await supabase.from('seller_badge_thresholds').select('*').order('sort_order', { ascending: true });
    setThresholds((data ?? []) as BadgeThreshold[]);
    setThresholdsLoading(false);
  }, []);

  useEffect(() => {
    load(dateRange);
    loadTiers();
    loadThresholds();
  }, [loadTiers, loadThresholds]);

  const handleRangeChange = (range: DateRangeKey) => {
    setDateRange(range);
    load(range);
  };

  const saveTier = async (tier: CommissionTier) => {
    setTierSaving(tier.id);
    const { error } = await supabase
      .from('commission_config')
      .update({
        label: tier.label,
        min_order_amount: tier.min_order_amount,
        commission_rate: tier.commission_rate,
        is_active: tier.is_active,
        sort_order: tier.sort_order,
        updated_at: new Date().toISOString(),
      })
      .eq('id', tier.id);
    setTierSaving(null);
    if (error) toast('Erè, eseye ankò', 'error');
    else toast('To komisyon mete ajou', 'success');
  };

  const addTier = async () => {
    const { data, error } = await supabase
      .from('commission_config')
      .insert({
        label: 'Nivo nouvo',
        min_order_amount: 0,
        commission_rate: 10,
        is_active: true,
        sort_order: tiers.length,
      })
      .select('*')
      .single();
    if (error) toast('Erè, eseye ankò', 'error');
    else if (data) setTiers([...tiers, data as CommissionTier]);
  };

  const deleteTier = async (id: string) => {
    const { error } = await supabase.from('commission_config').delete().eq('id', id);
    if (error) toast('Pa ka efase nivo sa a', 'error');
    else { setTiers(tiers.filter((t) => t.id !== id)); toast('Nivo efase', 'success'); }
  };

  const saveThreshold = async (th: BadgeThreshold) => {
    setThresholdSaving(th.id);
    const { error } = await supabase
      .from('seller_badge_thresholds')
      .update({
        label: th.label,
        min_total_sales: th.min_total_sales,
        min_total_orders: th.min_total_orders,
        min_avg_rating: th.min_avg_rating,
        min_vendor_revenue: th.min_vendor_revenue,
        is_active: th.is_active,
        sort_order: th.sort_order,
        updated_at: new Date().toISOString(),
      })
      .eq('id', th.id);
    setThresholdSaving(null);
    if (error) toast('Erè, eseye ankò', 'error');
    else toast(`${th.label} mete ajou`, 'success');
  };

  const showFilter = tab === 'overview' || tab === 'sellers' || tab === 'products' || tab === 'reports';

  if (loading && !data) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="animate-spin text-emerald-500" size={28} /></div>;
  }
  if (error && !data) {
    return (
      <div className="text-center py-16 px-4">
        <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center mx-auto mb-3"><TrendingUp size={24} /></div>
        <p className="text-sm font-semibold text-slate-900">Done pa ka chaje</p>
        <p className="text-xs text-slate-500 mt-1">{error}</p>
        <button onClick={() => load(dateRange)} className="mt-4 px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold active:scale-95 transition">Eseye ankò</button>
      </div>
    );
  }
  if (!data) return <div className="text-center py-20 text-sm text-slate-400">Pa gen done toujou.</div>;

  const tabs = [
    { key: 'overview' as const, label: 'Rezime' },
    { key: 'sellers' as const, label: 'Top Vandè' },
    { key: 'products' as const, label: 'Top Pwodwi' },
    { key: 'reports' as const, label: 'Rapò' },
    { key: 'commission' as const, label: 'Komisyon' },
    { key: 'badges' as const, label: 'Badj' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto">
          {tabs.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex-1 whitespace-nowrap py-2 px-3 rounded-md text-xs font-semibold transition ${tab === t.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>
              {t.label}
            </button>
          ))}
        </div>
        {showFilter && (
          <div className="flex items-center gap-2 ml-auto">
            {refreshing && <Loader2 size={14} className="animate-spin text-slate-400" />}
            <DateRangeFilter value={dateRange} onChange={handleRangeChange} compact />
          </div>
        )}
      </div>

      {showFilter && (
        <p className="text-xs text-slate-400">
          Peryòd: <span className="font-semibold text-slate-600">{formatRangeLabel(dateRange)}</span>
        </p>
      )}

      {tab === 'overview' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <MetricCard icon={<DollarSign size={18} />} label="Revni Platfòm" value={formatHTG(data.platform_revenue)} color="text-emerald-600" bg="bg-emerald-50" />
            <MetricCard icon={<Percent size={18} />} label="Total Komisyon" value={formatHTG(data.total_commission)} color="text-amber-600" bg="bg-amber-50" />
            <MetricCard icon={<Wallet size={18} />} label="Peman Vandè" value={formatHTG(data.vendor_payouts)} color="text-blue-600" bg="bg-blue-50" />
            <MetricCard icon={<Users size={18} />} label="Vandè Aktif" value={String(data.active_vendors)} color="text-slate-900" bg="bg-slate-100" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <PeriodCard label="Jodi a" revenue={data.today.revenue} orders={data.today.orders} />
            <PeriodCard label="Semèn" revenue={data.week.revenue} orders={data.week.orders} />
            <PeriodCard label="Mwa" revenue={data.month.revenue} orders={data.month.orders} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <MetricCard icon={<ShoppingCart size={18} />} label="Total Kòmand" value={String(data.total_orders)} color="text-slate-900" bg="bg-slate-100" />
            <MetricCard icon={<ShoppingCart size={18} />} label="Kòmand Fini" value={String(data.completed_orders)} color="text-emerald-600" bg="bg-emerald-50" />
          </div>
        </div>
      )}

      {tab === 'sellers' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2"><Trophy size={18} className="text-amber-500" /><h2 className="font-bold text-slate-900 text-sm">Top Vandè</h2></div>
          {data.top_sellers.length === 0 ? <p className="text-sm text-slate-400 text-center py-8">Pa gen vandè toujou.</p> : (
            <div className="space-y-2">
              {data.top_sellers.map((s, i) => (
                <div key={s.vendor_id} className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl p-3">
                  <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${i === 0 ? 'bg-amber-100 text-amber-700' : i === 1 ? 'bg-slate-200 text-slate-700' : i === 2 ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-500'}`}>{i + 1}</span>
                  <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600 shrink-0 overflow-hidden">
                    {s.avatar_url ? <img src={s.avatar_url} alt="" className="w-full h-full object-cover" /> : s.business_name?.charAt(0) ?? '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900 text-sm truncate">{s.business_name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-slate-500">{formatHTG(s.total_sales)}</span>
                      <span className="text-xs text-slate-400">{s.completed_orders} kòmand</span>
                      {s.seller_badge && <SellerBadge badge={s.seller_badge} size="sm" />}
                    </div>
                  </div>
                  {s.ranking && <span className="text-xs font-bold text-slate-400 shrink-0">#{s.ranking}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'products' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2"><Package size={18} className="text-emerald-600" /><h2 className="font-bold text-slate-900 text-sm">Top Pwodwi</h2></div>
          {data.top_products.length === 0 ? <p className="text-sm text-slate-400 text-center py-8">Pa gen pwodwi toujou.</p> : (
            <div className="space-y-2">
              {data.top_products.map((p, i) => (
                <div key={p.id} className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl p-3">
                  <span className="w-7 h-7 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center text-xs font-bold shrink-0">{i + 1}</span>
                  <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 overflow-hidden">
                    {p.image_url ? <img src={p.image_url} alt="" className="w-full h-full object-cover" /> : <Package size={18} className="text-slate-300" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900 text-sm truncate">{p.name}</p>
                    <p className="text-xs text-slate-500">{p.business_name} · {formatHTG(p.price)}</p>
                  </div>
                  <div className="text-right shrink-0"><p className="font-bold text-slate-900 text-sm">{p.sales_count}</p><p className="text-[10px] text-slate-400">vant</p></div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'reports' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2"><BarChart3 size={18} className="text-emerald-600" /><h2 className="font-bold text-slate-900 text-sm">Rapò chak jou</h2></div>
          <ReportTable points={data.daily} periodKey="day" />
          <h2 className="font-bold text-slate-900 text-sm mt-4">Rapò chak semèn</h2>
          <ReportTable points={data.weekly} periodKey="week" />
          <h2 className="font-bold text-slate-900 text-sm mt-4">Rapò chak mwa</h2>
          <ReportTable points={data.monthly} periodKey="month" />
        </div>
      )}

      {tab === 'commission' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-1">
              <h2 className="font-bold text-slate-900 text-sm">To Komisyon Platfòm</h2>
              <button onClick={addTier} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs active:scale-95 transition">
                <Plus size={14} /> Nivo nouvo
              </button>
            </div>
            <p className="text-xs text-slate-500 mb-4">Konfigire to komisyon pa nivo. Sistèm nan chwazi pi wo nivo ki koresponn ak total kòmand. Ou kapab tou mete to espesyal pou chak vandè nan fichye vandè a.</p>
            {tiersLoading ? <div className="flex justify-center py-8"><Loader2 className="animate-spin text-slate-400" size={24} /></div> : (
              <div className="space-y-3">
                {tiers.map((tier) => (
                  <TierEditor key={tier.id} tier={tier} onSave={saveTier} onDelete={deleteTier} saving={tierSaving === tier.id} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'badges' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-5">
            <h2 className="font-bold text-slate-900 text-sm mb-1">Seuil yo pou Badj Vandè</h2>
            <p className="text-xs text-slate-500 mb-4">Konfigire kondisyon pou chak nivo badj. Yon vandè jwenn badj ki koresponn ak tout kondisyon yo. Chanjman yo afike automatikman.</p>
            {thresholdsLoading ? <div className="flex justify-center py-8"><Loader2 className="animate-spin text-slate-400" size={24} /></div> : (
              <div className="space-y-3">
                {thresholds.map((th) => (
                  <BadgeThresholdEditor key={th.id} threshold={th} onSave={saveThreshold} saving={thresholdSaving === th.id} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({ icon, label, value, color, bg }: { icon: React.ReactNode; label: string; value: string; color: string; bg: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3 lg:p-4">
      <div className={`w-9 h-9 rounded-full ${bg} ${color} flex items-center justify-center mb-2`}>{icon}</div>
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className={`text-lg lg:text-xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

function PeriodCard({ label, revenue, orders }: { label: string; revenue: number; orders: number }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3 text-center">
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className="text-base font-bold text-slate-900 mt-1">{formatHTG(revenue)}</p>
      <p className="text-[10px] text-slate-400 mt-0.5">{orders} kòmand</p>
    </div>
  );
}

function ReportTable({ points, periodKey }: { points: PeriodPoint[]; periodKey: 'day' | 'week' | 'month' }) {
  if (points.length === 0) return <p className="text-sm text-slate-400 text-center py-4">Pa gen done pou peryòd sa a.</p>;
  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <table className="w-full text-xs">
        <thead><tr className="bg-slate-50 text-slate-500">
          <th className="text-left px-3 py-2 font-semibold">Peryòd</th>
          <th className="text-right px-3 py-2 font-semibold">Kòmand</th>
          <th className="text-right px-3 py-2 font-semibold">Revni</th>
          <th className="text-right px-3 py-2 font-semibold">Komisyon</th>
        </tr></thead>
        <tbody>
          {points.map((p, i) => {
            const dateStr = p[periodKey] ?? '';
            const formatted = periodKey === 'day' || periodKey === 'week'
              ? new Date(dateStr).toLocaleDateString('fr-HT', { day: '2-digit', month: 'short' })
              : new Date(dateStr).toLocaleDateString('fr-HT', { month: 'short', year: 'numeric' });
            return (
              <tr key={i} className="border-t border-slate-50">
                <td className="px-3 py-2 text-slate-700">{formatted}</td>
                <td className="px-3 py-2 text-right text-slate-600">{p.orders}</td>
                <td className="px-3 py-2 text-right font-semibold text-slate-900">{formatHTG(p.revenue)}</td>
                <td className="px-3 py-2 text-right text-amber-600 font-semibold">{formatHTG(p.commission)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function TierEditor({ tier, onSave, onDelete, saving }: { tier: CommissionTier; onSave: (t: CommissionTier) => void; onDelete: (id: string) => void; saving: boolean }) {
  const [t, setT] = useState<CommissionTier>(tier);
  return (
    <div className="border border-slate-200 rounded-xl p-3">
      <div className="flex items-center gap-2 mb-3">
        <input type="text" value={t.label} onChange={(e) => setT({ ...t, label: e.target.value })}
          className="flex-1 px-2 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        {t.is_default && <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full font-semibold">Defo</span>}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] text-slate-500">Min Total Kòmand (G)</label>
          <input type="number" value={t.min_order_amount} onChange={(e) => setT({ ...t, min_order_amount: Number(e.target.value) })}
            className="w-full px-2 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        </div>
        <div>
          <label className="text-[10px] text-slate-500">To Komisyon (%)</label>
          <input type="number" step={0.5} value={t.commission_rate} onChange={(e) => setT({ ...t, commission_rate: Number(e.target.value) })}
            className="w-full px-2 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        </div>
      </div>
      <div className="flex items-center gap-2 mt-2">
        <label className="flex items-center gap-1.5 text-xs text-slate-600">
          <input type="checkbox" checked={t.is_active} onChange={(e) => setT({ ...t, is_active: e.target.checked })} className="rounded" />
          Aktif
        </label>
        <button onClick={() => onSave(t)} disabled={saving}
          className="ml-auto px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs flex items-center gap-1.5 active:scale-95 transition disabled:opacity-60">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Anrejistre
        </button>
        {!t.is_default && (
          <button onClick={() => onDelete(t.id)} className="px-2 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs active:scale-95 transition">
            <Trash2 size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

function BadgeThresholdEditor({ threshold, onSave, saving }: { threshold: BadgeThreshold; onSave: (th: BadgeThreshold) => void; saving: boolean }) {
  const [th, setTh] = useState<BadgeThreshold>(threshold);
  const iconKey = ICON_KEYS[th.badge_tier] ?? 'award';
  const Icon = THRESHOLD_ICONS[iconKey] ?? Award;
  return (
    <div className="border border-slate-200 rounded-xl p-3">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-400 to-slate-600 flex items-center justify-center text-white">
          <Icon size={16} />
        </div>
        <input type="text" value={th.label} onChange={(e) => setTh({ ...th, label: e.target.value })}
          className="flex-1 px-2 py-1 rounded-lg border border-slate-200 bg-slate-50 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] text-slate-500">Min Vant (G)</label>
          <input type="number" value={th.min_total_sales} onChange={(e) => setTh({ ...th, min_total_sales: Number(e.target.value) })}
            className="w-full px-2 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        </div>
        <div>
          <label className="text-[10px] text-slate-500">Min Revni (G)</label>
          <input type="number" value={th.min_vendor_revenue} onChange={(e) => setTh({ ...th, min_vendor_revenue: Number(e.target.value) })}
            className="w-full px-2 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        </div>
        <div>
          <label className="text-[10px] text-slate-500">Min Kòmand</label>
          <input type="number" value={th.min_total_orders} onChange={(e) => setTh({ ...th, min_total_orders: Number(e.target.value) })}
            className="w-full px-2 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        </div>
        <div>
          <label className="text-[10px] text-slate-500">Min Nòt</label>
          <input type="number" step={0.1} min={0} max={5} value={th.min_avg_rating} onChange={(e) => setTh({ ...th, min_avg_rating: Number(e.target.value) })}
            className="w-full px-2 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        </div>
      </div>
      <div className="flex items-center gap-2 mt-2">
        <label className="flex items-center gap-1.5 text-xs text-slate-600">
          <input type="checkbox" checked={th.is_active} onChange={(e) => setTh({ ...th, is_active: e.target.checked })} className="rounded" />
          Aktif
        </label>
        <button onClick={() => onSave(th)} disabled={saving}
          className="ml-auto px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs flex items-center gap-1.5 active:scale-95 transition disabled:opacity-60">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Anrejistre
        </button>
      </div>
    </div>
  );
}
