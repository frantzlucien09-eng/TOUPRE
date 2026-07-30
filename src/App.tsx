import { lazy, Suspense, useEffect, useState } from 'react';
import { AuthProvider, useAuth } from '@/lib/auth';
import { AdminAuthProvider, useAdminAuth } from '@/lib/adminAuth';
import { supabase } from '@/lib/supabase';
import { ToastProvider } from '@/lib/toast';
import { ConfirmProvider } from '@/lib/confirm';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { BottomNav, type Page } from '@/components/BottomNav';
import { NotificationsPanel } from '@/components/NotificationsPanel';
import { Loader2 } from 'lucide-react';
import type { Order } from '@/lib/types';
import { vendorInboxOrFilter, vendorMessageRealtimeFilters } from '@/lib/vendorIds';

const AuthPage = lazy(() => import('@/pages/AuthPage').then((m) => ({ default: m.AuthPage })));
const CustomerHome = lazy(() => import('@/pages/CustomerHome').then((m) => ({ default: m.CustomerHome })));
const HomePage = lazy(() => import('@/pages/HomePage').then((m) => ({ default: m.HomePage })));
const ProductsPage = lazy(() => import('@/pages/ProductsPage').then((m) => ({ default: m.ProductsPage })));
const OrdersPage = lazy(() => import('@/pages/OrdersPage').then((m) => ({ default: m.OrdersPage })));
const MessagesPage = lazy(() => import('@/pages/MessagesPage').then((m) => ({ default: m.MessagesPage })));
const ProfilePage = lazy(() => import('@/pages/ProfilePage').then((m) => ({ default: m.ProfilePage })));
const WithdrawPage = lazy(() => import('@/pages/WithdrawPage').then((m) => ({ default: m.WithdrawPage })));
const SettingsPage = lazy(() => import('@/pages/SettingsPage').then((m) => ({ default: m.SettingsPage })));
const FollowTouprePage = lazy(() => import('@/pages/FollowTouprePage').then((m) => ({ default: m.FollowTouprePage })));
const KycOnboardingPage = lazy(() => import('@/pages/KycOnboardingPage').then((m) => ({ default: m.KycOnboardingPage })));
const OrderPreparingPage = lazy(() => import('@/pages/OrderPreparingPage').then((m) => ({ default: m.OrderPreparingPage })));
const OrderDeliveringPage = lazy(() => import('@/pages/OrderDeliveringPage').then((m) => ({ default: m.OrderDeliveringPage })));
const VendorDashboardPage = lazy(() => import('@/pages/VendorDashboardPage').then((m) => ({ default: m.VendorDashboardPage })));
const AdminLogin = lazy(() => import('@/pages/AdminLogin').then((m) => ({ default: m.AdminLogin })));
const AdminDashboard = lazy(() => import('@/pages/AdminDashboard').then((m) => ({ default: m.AdminDashboard })));

function RouteFallback() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-slate-50">
      <img src="/toupre_vande_logo.png" alt="TOUPRE VANDE" className="w-14 h-14 object-contain animate-pulse" />
      <Loader2 className="animate-spin text-emerald-500" size={22} />
    </div>
  );
}

function useHashRoute() {
  const [hash, setHash] = useState(() => window.location.hash.replace(/^#\/?/, ''));
  useEffect(() => {
    const onHash = () => setHash(window.location.hash.replace(/^#\/?/, ''));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  return hash;
}

type Screen = 'main' | 'withdraw' | 'settings' | 'follow' | 'preparing' | 'delivering' | 'dashboard';

function Shell() {
  const route = useHashRoute();
  if (route === 'admin' || route.startsWith('admin/')) {
    return (
      <AdminAuthProvider>
        <Suspense fallback={<RouteFallback />}>
          <AdminShell />
        </Suspense>
      </AdminAuthProvider>
    );
  }
  if (route.startsWith('legal/')) {
    const raw = route.replace(/^legal\//, '');
    const allowed = new Set([
      'privacy', 'terms', 'vendor-terms', 'classified-policy', 'payment-policy', 'refund-policy',
    ]);
    const key = (allowed.has(raw) ? raw : 'terms') as
      | 'privacy' | 'terms' | 'vendor-terms' | 'classified-policy' | 'payment-policy' | 'refund-policy';
    const LegalPage = lazy(() => import('@/pages/LegalPage').then((m) => ({ default: m.LegalPage })));
    return (
      <Suspense fallback={<RouteFallback />}>
        <LegalPage docKey={key} />
      </Suspense>
    );
  }
  if (route.startsWith('payment/return')) {
    const PaymentReturnPage = lazy(() =>
      import('@/pages/PaymentReturnPage').then((m) => ({ default: m.PaymentReturnPage }))
    );
    return (
      <Suspense fallback={<RouteFallback />}>
        <PaymentReturnPage />
      </Suspense>
    );
  }
  return (
    <Suspense fallback={<RouteFallback />}>
      <VendorShell />
    </Suspense>
  );
}

function VendorShell() {
  const { vendor, customer, loading, refreshVendor } = useAuth();
  const [page, setPage] = useState<Page>('home');
  const [screen, setScreen] = useState<Screen>('main');
  const [orderFilter, setOrderFilter] = useState<'today' | 'new' | 'done' | undefined>(undefined);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifTick, setNotifTick] = useState(0);
  const [ordersBadge, setOrdersBadge] = useState(0);
  const [messagesBadge, setMessagesBadge] = useState(0);
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [messageCustomerId, setMessageCustomerId] = useState<string | null>(null);

  useEffect(() => {
    if (!vendor) return;
    const load = async () => {
      const { count } = await supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('vendor_id', vendor.id)
        .in('status', ['pending']);
      setOrdersBadge(count ?? 0);
    };
    load();
    const loadMsgs = async () => {
      const { count } = await supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .or(vendorInboxOrFilter(vendor))
        .eq('read', false);
      setMessagesBadge(count ?? 0);
    };
    loadMsgs();
    let channel = supabase
      .channel('orders-badge')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `vendor_id=eq.${vendor.id}` }, load);
    for (const filter of vendorMessageRealtimeFilters(vendor)) {
      channel = channel.on('postgres_changes', filter, () => { loadMsgs(); });
    }
    channel.subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [vendor]);

  useEffect(() => {
    if (!vendor) return;
    const channel = supabase
      .channel(`vendor-self-${vendor.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'vendors', filter: `id=eq.${vendor.id}` }, () => {
        refreshVendor();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [vendor?.id, refreshVendor]);

  if (loading) return <RouteFallback />;

  if (!vendor && !customer) return <AuthPage />;
  if (!vendor && customer) return <CustomerHome />;
  if (!vendor) return <AuthPage />;

  if (vendor.status === 'pending' || vendor.status === 'pending_review') {
    return <KycOnboardingPage />;
  }

  if (vendor.status === 'suspended') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 px-6 text-center bg-slate-50">
        <img src="/toupre_vande_logo.png" alt="TOUPRE" className="w-16 h-16 object-contain" />
        <p className="font-bold text-slate-900">Kont ou sispann</p>
        <p className="text-sm text-slate-500">Tanpri kontakte sipò pou èd.</p>
        <a href="mailto:toupreed@gmail.com" className="mt-2 inline-flex items-center gap-2 text-sm text-emerald-600 font-semibold hover:underline">
          toupreed@gmail.com
        </a>
        <p className="text-xs text-slate-400 mt-1">Voye nou yon imèl, n ap reponn ou pi vit posib.</p>
      </div>
    );
  }

  const navigate = (p: Page) => {
    setPage(p);
    setScreen('main');
    setOrderFilter(undefined);
  };

  return (
    <div className="min-h-screen bg-slate-50 max-w-md mx-auto relative pb-20">
      {screen === 'main' && page === 'home' && (
        <HomePage
          onOpenNotifications={() => setNotifOpen(true)}
          onOpenOrder={(o) => { setActiveOrder(o); setScreen('preparing'); }}
          onGoOrders={(f) => { setPage('orders'); setOrderFilter(f); setScreen('main'); }}
          onGoTopVendors={() => setScreen('dashboard')}
          onGoBalance={() => setScreen('withdraw')}
          onGoProducts={() => setPage('products')}
          onGoDashboard={() => setScreen('dashboard')}
          notifTick={notifTick}
        />
      )}
      {screen === 'main' && page === 'products' && <ProductsPage />}
      {screen === 'main' && page === 'orders' && (
        <OrdersPage
          initialFilter={orderFilter === 'done' ? 'new' : orderFilter}
          initialTab={orderFilter === 'done' ? 'done' : undefined}
          onOpenOrder={(o) => { setActiveOrder(o); setScreen('preparing'); }}
        />
      )}
      {screen === 'main' && page === 'messages' && (
        <MessagesPage initialCustomerId={messageCustomerId} onClearInitial={() => setMessageCustomerId(null)} />
      )}
      {screen === 'main' && page === 'profile' && (
        <ProfilePage
          onGoOrdersDone={() => { setPage('orders'); setScreen('main'); setOrderFilter(undefined); }}
          onGoSettings={() => setScreen('settings')}
          onGoWithdraw={() => setScreen('withdraw')}
          onGoFollow={() => setScreen('follow')}
        />
      )}
      {screen === 'dashboard' && <VendorDashboardPage onBack={() => setScreen('main')} />}
      {screen === 'withdraw' && <WithdrawPage onBack={() => setScreen('main')} />}
      {screen === 'settings' && <SettingsPage onBack={() => setScreen('main')} />}
      {screen === 'follow' && <FollowTouprePage onBack={() => setScreen('main')} />}

      {screen === 'preparing' && activeOrder && (
        <OrderPreparingPage
          order={activeOrder}
          onBack={() => { setScreen('main'); setPage('orders'); setActiveOrder(null); }}
          onDelivering={() => {
            const nextStatus = activeOrder.delivery_type === 'pickup' ? 'ready_pickup' : 'delivering';
            setActiveOrder({ ...activeOrder, status: nextStatus });
            setScreen('delivering');
          }}
          onStatusChange={(newStatus) => setActiveOrder({ ...activeOrder, status: newStatus as Order['status'] })}
          onMessage={(cid) => { setMessageCustomerId(cid); setPage('messages'); setScreen('main'); }}
        />
      )}

      {screen === 'delivering' && activeOrder && (
        <OrderDeliveringPage
          order={activeOrder}
          onBack={() => { setScreen('main'); setPage('orders'); setOrderFilter('done'); setActiveOrder(null); }}
          onMessage={(cid) => { setMessageCustomerId(cid); setPage('messages'); setScreen('main'); }}
        />
      )}

      <BottomNav current={screen === 'main' ? page : 'profile'} onNavigate={navigate} orderBadge={ordersBadge} messageBadge={messagesBadge} />

      <NotificationsPanel
        open={notifOpen}
        onClose={() => { setNotifOpen(false); setNotifTick((t) => t + 1); }}
      />
    </div>
  );
}

function AdminShell() {
  const { admin, loading } = useAdminAuth();
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center gap-4">
        <img src="/toupre_vande_logo.png" alt="TOUPRE VANDE" className="w-16 h-16 object-contain animate-pulse" />
        <Loader2 className="animate-spin text-emerald-500" size={28} />
      </div>
    );
  }
  if (!admin) return <AdminLogin />;
  return <AdminDashboard />;
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ToastProvider>
          <ConfirmProvider>
            <Shell />
          </ConfirmProvider>
        </ToastProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
