import { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from '@/lib/auth';
import { AdminAuthProvider, useAdminAuth } from '@/lib/adminAuth';
import { supabase } from '@/lib/supabase';
import { ToastProvider } from '@/lib/toast';
import { ConfirmProvider } from '@/lib/confirm';
import { AuthPage } from '@/pages/AuthPage';
import { CustomerHome } from '@/pages/CustomerHome';
import { HomePage } from '@/pages/HomePage';
import { ProductsPage } from '@/pages/ProductsPage';
import { OrdersPage } from '@/pages/OrdersPage';
import { MessagesPage } from '@/pages/MessagesPage';
import { ProfilePage } from '@/pages/ProfilePage';
import { WithdrawPage } from '@/pages/WithdrawPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { FollowTouprePage } from '@/pages/FollowTouprePage';
import { KycOnboardingPage } from '@/pages/KycOnboardingPage';
import { OrderPreparingPage } from '@/pages/OrderPreparingPage';
import { OrderDeliveringPage } from '@/pages/OrderDeliveringPage';
import { AdminLogin } from '@/pages/AdminLogin';
import { AdminDashboard } from '@/pages/AdminDashboard';
import { VendorDashboardPage } from '@/pages/VendorDashboardPage';
import { BottomNav, type Page } from '@/components/BottomNav';
import { NotificationsPanel } from '@/components/NotificationsPanel';
import { Logo } from '@/components/Logo';
import { Loader2 } from 'lucide-react';
import type { Order } from '@/lib/types';
import { vendorInboxOrFilter, vendorMessageRealtimeFilters } from '@/lib/vendorIds';

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
  if (route === 'admin') return <AdminShell />;
  return <VendorShell />;
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

  // Auto-refresh vendor status when admin approves KYC
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

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-slate-50">
        <img src="/toupre_vande_logo.png" alt="TOUPRE VANDE" className="w-16 h-16 object-contain animate-pulse" />
        <Loader2 className="animate-spin text-emerald-500" size={24} />
      </div>
    );
  }

  if (!vendor && !customer) return <AuthPage />;
  if (!vendor && customer) return <CustomerHome />;
  if (!vendor) return <AuthPage />;

  // Pending KYC review — vendor must complete onboarding before using the app
  if (vendor.status === 'pending' || vendor.status === 'pending_review') {
    return <KycOnboardingPage />;
  }

  // Suspended account guard
  if (vendor.status === 'suspended') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 px-6 text-center bg-slate-50">
        <Logo size="md" />
        <p className="font-bold text-slate-900">Kont ou sispann</p>
        <p className="text-sm text-slate-500">Tanpri kontakte sipò pou èd.</p>
        <a href="mailto:toupreed@gmail.com" className="mt-2 inline-flex items-center gap-2 text-sm text-emerald-600 font-semibold hover:underline">
          toupreed@gmail.com
        </a>
        <p className="text-xs text-slate-400 mt-1">Voye nou yon imèl, n ap reponn ou pi vit posib.</p>
      </div>
    );
  }

  const goOrders = (filter: 'today' | 'new') => {
    setOrderFilter(filter);
    setPage('orders');
    setScreen('main');
  };

  const navigate = (p: Page) => {
    setPage(p);
    setScreen('main');
    if (p !== 'orders') setOrderFilter(undefined);
  };

  return (
    <div className="min-h-screen bg-slate-50 max-w-md mx-auto relative">
      {screen === 'main' && page === 'home' && (
        <HomePage
          notifTick={notifTick}
          onOpenNotifications={() => setNotifOpen(true)}
          onOpenOrder={() => { setPage('orders'); setScreen('main'); }}
          onGoOrders={goOrders}
          onGoTopVendors={() => { setPage('profile'); setScreen('main'); }}
          onGoBalance={() => setScreen('withdraw')}
          onGoProducts={() => { setPage('products'); setScreen('main'); }}
          onGoDashboard={() => setScreen('dashboard')}
        />
      )}
      {screen === 'main' && page === 'products' && <ProductsPage />}
      {screen === 'main' && page === 'orders' && <OrdersPage initialFilter={orderFilter === 'done' ? 'new' : orderFilter} initialTab={orderFilter === 'done' ? 'done' : undefined} onOpenOrder={(o) => { setActiveOrder(o); setScreen('preparing'); }} />}
      {screen === 'main' && page === 'messages' && <MessagesPage initialCustomerId={messageCustomerId} onClearInitial={() => setMessageCustomerId(null)} />}
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
    <AuthProvider>
      <AdminAuthProvider>
        <ToastProvider>
          <ConfirmProvider>
            <Shell />
          </ConfirmProvider>
        </ToastProvider>
      </AdminAuthProvider>
    </AuthProvider>
  );
}
