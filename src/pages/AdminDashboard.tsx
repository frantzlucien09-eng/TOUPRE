import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAdminAuth } from '@/lib/adminAuth';
import { useToast } from '@/lib/toast';
import { formatHTG, relativeTime } from '@/lib/format';
import {
  LayoutDashboard, Users, BadgeCheck, ShoppingCart, Send, Trophy,
  Shield, Lock, Settings, Share2, ToggleRight, Wallet, FileText,
  LogOut, Menu, X, Activity, DollarSign, Loader2,
} from 'lucide-react';
import { AdminKycPage } from '@/pages/AdminKycPage';
import { AdminOrdersPage } from '@/pages/AdminOrdersPage';
import { AdminProductsPage } from '@/pages/AdminProductsPage';
import { AdminAnalyticsPage } from '@/pages/AdminAnalyticsPage';
import { AdminWithdrawalsPage } from '@/pages/AdminWithdrawalsPage';
import { AdminVendorsPage } from '@/pages/AdminVendorsPage';
import { AdminSocialPage } from '@/pages/AdminSocialPage';
import { AdminBroadcastPage } from '@/pages/AdminBroadcastPage';
import { AdminIntegrationsPage } from '@/pages/AdminIntegrationsPage';
import { AdminPermissionsPage } from '@/pages/AdminPermissionsPage';
import { AdminSecurityPage } from '@/pages/AdminSecurityPage';
import { AdminCleanupPage } from '@/pages/AdminCleanupPage';
import { DateRangeFilter, getRangeStartDate, formatRangeLabel, type DateRangeKey } from '@/components/DateRangeFilter';

type Section =
  | 'dashboard' | 'vendors' | 'kyc' | 'orders' | 'withdrawals'
  | 'top' | 'broadcast' | 'social' | 'integrations' | 'finance'
  | 'permissions' | 'security' | 'reports' | 'cleanup' | 'activity';

const NAV: { key: Section; label: string; icon: React.ReactNode }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={15} /> },
  { key: 'kyc', label: 'KYC / Apwobasyon', icon: <BadgeCheck size={15} /> },
  { key: 'orders', label: 'Kòmand', icon: <ShoppingCart size={15} /> },
  { key: 'withdrawals', label: 'Retire Lajan', icon: <Wallet size={15} /> },
  { key: 'vendors', label: 'Vandè', icon: <Users size={15} /> },
  { key: 'top', label: 'Top Vandè', icon: <Trophy size={15} /> },
  { key: 'social', label: 'Rezo Sosyal', icon: <Share2 size={15} /> },
  { key: 'integrations', label: 'Entegrasyon / Apps', icon: <ToggleRight size={15} /> },
  { key: 'broadcast', label: 'Mesaj Mas', icon: <Send size={15} /> },
  { key: 'reports', label: 'Rapò Pwodwi', icon: <FileText size={15} /> },
  { key: 'permissions', label: 'Pèmisyon', icon: <Shield size={15} /> },
  { key: 'security', label: 'Sekirite', icon: <Lock size={15} /> },
  { key: 'finance', label: 'Paramèt Finansye', icon: <DollarSign size={15} /> },
  { key: 'activity', label: 'Aktivite', icon: <Activity size={15} /> },
  { key: 'cleanup', label: 'Netwayaj Done', icon: <Settings size={15} /> },
];

export function AdminDashboard() {
  const { admin, signOut } = useAdminAuth();
  const { toast } = useToast();
  const [section, setSection] = useState<Section>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [stats, setStats] = useState({
    vendors: 0,
    activeVendors: 0,
    ordersToday: 0,
    revenueToday: 0,
    pendingKyc: 0,
    pendingWithdrawals: 0,
    periodRevenue: 0,
    periodOrders: 0,
  });
  const [recentActivity, setRecentActivity] = useState<ActivityEntry[]>([]);
  const [dateRange, setDateRange] = useState<DateRangeKey>('30d');
  const [refreshing, setRefreshing] = useState(false);

  const loadStats = async (range?: DateRangeKey) => {
    const r = range ?? dateRange;
    if (stats.vendors > 0) setRefreshing(true);
    const { count: vendors } = await supabase.from('vendors').select('id', { count: 'exact', head: true });
    const { count: activeVendors } = await supabase.from('vendors').select('id', { count: 'exact', head: true }).eq('status', 'active');
    const { count: pendingKyc } = await supabase.from('vendor_kyc').select('id', { count: 'exact', head: true }).eq('status', 'pending');
    const { count: pendingWithdrawals } = await supabase.from('withdrawals').select('id', { count: 'exact', head: true }).eq('status', 'pending');

    const startToday = new Date();
    startToday.setHours(0, 0, 0, 0);
    const { data: todayOrders } = await supabase
      .from('orders')
      .select('total, status')
      .gte('created_at', startToday.toISOString());
    const ordersToday = todayOrders?.length ?? 0;
    const revenueToday = (todayOrders ?? []).filter((o) => o.status === 'delivered' || o.status === 'picked_up').reduce((s, o) => s + Number(o.total), 0);

    let periodRevenue = 0;
    let periodOrders = 0;
    const startDate = getRangeStartDate(r);
    if (startDate) {
      const { data: periodData, count } = await supabase
        .from('orders')
        .select('total', { count: 'exact' })
        .gte('created_at', startDate);
      periodOrders = count ?? 0;
      periodRevenue = (periodData ?? []).reduce((s, o) => s + Number(o.total), 0);
    } else {
      const { count } = await supabase.from('orders').select('id', { count: 'exact', head: true });
      periodOrders = count ?? 0;
      const { data: allData } = await supabase.from('orders').select('total');
      periodRevenue = (allData ?? []).reduce((s, o) => s + Number(o.total), 0);
    }

    setStats({
      vendors: vendors ?? 0,
      activeVendors: activeVendors ?? 0,
      ordersToday,
      revenueToday,
      pendingKyc: pendingKyc ?? 0,
      pendingWithdrawals: pendingWithdrawals ?? 0,
      periodRevenue,
      periodOrders,
    });
    setRefreshing(false);
  };

  const loadActivity = async () => {
    const { data, error } = await supabase
      .from('activity_log')
      .select('id, action, actor_name, created_at')
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) {
      const { data: d2 } = await supabase
        .from('activity_logs')
        .select('id, action, actor_name, created_at')
        .order('created_at', { ascending: false })
        .limit(50);
      setRecentActivity((d2 ?? []) as ActivityEntry[]);
      return;
    }
    setRecentActivity((data ?? []) as ActivityEntry[]);
  };

  useEffect(() => {
    loadStats(dateRange);
    loadActivity();

    const channel = supabase
      .channel('admin-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vendors' }, () => { loadStats(); loadActivity(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => { loadStats(); loadActivity(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => { loadActivity(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'withdrawals' }, () => { loadStats(); loadActivity(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => { loadActivity(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vendor_kyc' }, () => { loadStats(); loadActivity(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activity_log' }, () => { loadActivity(); })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleRangeChange = (range: DateRangeKey) => {
    setDateRange(range);
    loadStats(range);
  };

  const handleSignOut = async () => {
    await signOut();
    toast('Dekonekte');
  };

  return (
    <div className="min-h-screen bg-[#f8f9fa] flex">
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-[200px] bg-[#111] flex-col transition-transform duration-200 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0 lg:flex ${sidebarOpen ? 'flex' : 'hidden lg:flex'}`}
      >
        <div className="flex items-center gap-1.5 px-3 py-4">
          <img src="/toupre_vande_logo.png" alt="TOUPRE" className="w-7 h-7 object-contain shrink-0" />
          <span className="font-bold text-sm text-white">TOUPRE Admin</span>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-slate-400 hover:text-white ml-auto"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5">
          {NAV.map((item) => {
            const isActive = section === item.key;
            const badge =
              item.key === 'kyc' && stats.pendingKyc > 0 ? stats.pendingKyc
                : item.key === 'withdrawals' && stats.pendingWithdrawals > 0 ? stats.pendingWithdrawals
                  : 0;
            return (
              <button
                key={item.key}
                onClick={() => { setSection(item.key); setSidebarOpen(false); }}
                className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-[12.5px] transition ${
                  isActive
                    ? 'bg-emerald-500 text-black font-semibold'
                    : 'text-slate-300 hover:bg-white/5 hover:text-white'
                }`}
              >
                {item.icon}
                <span className="flex-1 text-left">{item.label}</span>
                {badge > 0 && (
                  <span className="bg-red-500 text-white text-[10px] px-1.5 rounded-full font-semibold leading-4">
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="px-3 py-3 border-t border-white/10">
          <div className="flex items-center gap-2 px-1 mb-2">
            <div className="w-7 h-7 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 text-[10px] font-bold">
              {(admin?.full_name ?? admin?.email ?? 'A')[0].toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-white truncate">{admin?.full_name ?? 'Admin'}</p>
              <p className="text-[9px] text-slate-500 truncate">{admin?.email}</p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-[12px] text-slate-400 hover:bg-white/5 hover:text-white transition"
          >
            <LogOut size={15} />
            Dekonekte
          </button>
        </div>
      </aside>

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="flex-1 lg:ml-[200px] min-w-0">
        <header className="sticky top-0 z-20 bg-white border-b border-slate-200 px-4 lg:px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600"
            >
              <Menu size={20} />
            </button>
            <div>
              <h1 className="text-base font-bold text-slate-900">
                {section === 'dashboard' ? 'Dashboard' : NAV.find((n) => n.key === section)?.label ?? 'Dashboard'}
              </h1>
              {section === 'dashboard' && (
                <p className="text-xs text-slate-400">Rezime jeneral · {formatRangeLabel(dateRange)}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {section === 'dashboard' && refreshing && <Loader2 size={14} className="animate-spin text-slate-400" />}
            {section === 'dashboard' && <DateRangeFilter value={dateRange} onChange={handleRangeChange} compact />}
            <span className="text-xs text-slate-400 hidden sm:block">
              {admin?.role === 'super_admin' ? 'Soupèt Admin' : 'Admin'}
            </span>
          </div>
        </header>

        <main className="p-4 lg:p-5 max-w-5xl">
          {section === 'dashboard' && <DashboardView stats={stats} recentActivity={recentActivity} dateRange={dateRange} />}
          {section === 'activity' && <ActivityView recentActivity={recentActivity} onRefresh={loadActivity} />}
          {section === 'kyc' && <AdminKycPage />}
          {section === 'orders' && <AdminOrdersPage />}
          {section === 'withdrawals' && <AdminWithdrawalsPage />}
          {section === 'vendors' && <AdminVendorsPage />}
          {section === 'social' && <AdminSocialPage />}
          {section === 'broadcast' && <AdminBroadcastPage />}
          {section === 'integrations' && <AdminIntegrationsPage />}
          {section === 'permissions' && <AdminPermissionsPage />}
          {section === 'security' && <AdminSecurityPage />}
          {section === 'cleanup' && <AdminCleanupPage />}
          {section === 'reports' && <AdminProductsPage />}
          {section === 'top' && <AdminAnalyticsPage initialTab="sellers" />}
          {section === 'finance' && <AdminAnalyticsPage initialTab="commission" />}
        </main>
      </div>
      <div className="text-center text-xs text-slate-400 py-3 px-4">
        Kontak Sipò: <a href="mailto:toupreed@gmail.com" className="text-emerald-600 hover:underline">toupreed@gmail.com</a>
      </div>
    </div>
  );
}

type ActivityEntry = {
  id: string;
  action: string;
  actor_name: string | null;
  created_at: string;
};

function activityColor(action: string): string {
  if (action.includes('cancel') || action.includes('reject')) return 'bg-rose-500';
  if (action.includes('pending') || action.includes('new') || action.includes('submit')) return 'bg-amber-500';
  if (action.includes('paid') || action.includes('withdraw') || action.includes('revenue') || action.includes('order')) return 'bg-blue-500';
  return 'bg-emerald-500';
}

function DashboardView({ stats, recentActivity }: {
  stats: { vendors: number; activeVendors: number; ordersToday: number; revenueToday: number; pendingKyc: number; pendingWithdrawals: number; periodRevenue: number; periodOrders: number };
  recentActivity: ActivityEntry[];
  dateRange?: DateRangeKey;
}) {
  const cards = [
    { label: 'Total Vandè', value: String(stats.vendors), color: 'text-slate-900' },
    { label: 'Kòmand Jodi a', value: String(stats.ordersToday), color: 'text-slate-900' },
    { label: 'Lajan Jodi a', value: formatHTG(stats.revenueToday), color: 'text-emerald-600' },
    { label: 'KYC An Atant', value: String(stats.pendingKyc), color: stats.pendingKyc > 0 ? 'text-amber-500' : 'text-slate-900' },
    { label: 'Retire An Atant', value: String(stats.pendingWithdrawals), color: stats.pendingWithdrawals > 0 ? 'text-amber-500' : 'text-slate-900' },
    { label: 'Vandè Aktif', value: String(stats.activeVendors), color: 'text-slate-900' },
  ];
  const periodCards = [
    { label: 'Revni Peryòd', value: formatHTG(stats.periodRevenue), color: 'text-emerald-600' },
    { label: 'Kòmand Peryòd', value: String(stats.periodOrders), color: 'text-slate-900' },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2.5 lg:gap-3">
        {cards.map((c) => (
          <div key={c.label} className="bg-white border border-slate-200 rounded-xl p-3 lg:p-4">
            <p className="text-[11px] text-slate-500 mb-1.5">{c.label}</p>
            <p className={`text-lg lg:text-xl font-bold ${c.color}`}>{c.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2.5 lg:gap-3">
        {periodCards.map((c) => (
          <div key={c.label} className="bg-white border border-slate-200 rounded-xl p-3 lg:p-4">
            <p className="text-[11px] text-slate-500 mb-1.5">{c.label}</p>
            <p className={`text-lg lg:text-xl font-bold ${c.color}`}>{c.value}</p>
          </div>
        ))}
      </div>

      <div>
        <h2 className="text-sm font-bold text-slate-900 mb-2">Aktivite Resan</h2>
        <div className="space-y-1.5">
          {recentActivity.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-6 text-center">
              <p className="text-sm text-slate-400">Pa gen aktivite anrejistre toujou.</p>
            </div>
          ) : (
            recentActivity.slice(0, 20).map((a) => (
              <div
                key={a.id}
                className="flex items-center gap-2.5 bg-white border border-slate-200 rounded-xl px-3 py-2.5"
              >
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${activityColor(a.action)}`} />
                <p className="text-xs text-slate-700 flex-1 truncate">{a.action}</p>
                <span className="text-[11px] text-slate-400 shrink-0">{relativeTime(a.created_at)}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function ActivityView({ recentActivity, onRefresh }: { recentActivity: ActivityEntry[]; onRefresh: () => void }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100">
        <Activity size={18} className="text-emerald-600" />
        <h2 className="font-bold text-slate-900 text-sm flex-1">Rejis Aktivite Konplè</h2>
        <button
          onClick={onRefresh}
          className="text-[11px] font-semibold text-emerald-600 hover:underline"
        >
          Rafrechi
        </button>
      </div>
      {recentActivity.length === 0 ? (
        <p className="px-5 py-12 text-sm text-slate-400 text-center">Pa gen aktivite anrejistre toujou.</p>
      ) : (
        <div className="divide-y divide-slate-50">
          {recentActivity.map((a) => (
            <div key={a.id} className="flex items-center gap-3 px-5 py-3">
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${activityColor(a.action)}`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-900 font-medium">{a.action}</p>
                <p className="text-xs text-slate-400">{a.actor_name ?? 'Sistèm'}</p>
              </div>
              <p className="text-xs text-slate-400 shrink-0">{relativeTime(a.created_at)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
