import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/lib/toast';
import { Logo } from '@/components/Logo';
import { GoogleSignInButton } from '@/components/GoogleSignInButton';
import { Package, MapPin, Phone, Loader2, LogOut, ShoppingBag, Store, MessageCircle, Bell, ExternalLink, Instagram, Music2, Facebook, Globe } from 'lucide-react';
import type { Order, Product, Vendor as VendorType, SocialPlatform, Notification } from '@/lib/types';
import { formatHTG } from '@/lib/format';
import { STATUS_LABELS_CUSTOMER, STATUS_STYLES } from '@/lib/orderStatus';

const SOCIAL_ICONS: Record<string, { icon: typeof Globe; bg: string }> = {
  instagram: { icon: Instagram, bg: 'bg-gradient-to-br from-amber-400 via-pink-500 to-purple-600' },
  tiktok: { icon: Music2, bg: 'bg-slate-900' },
  facebook: { icon: Facebook, bg: 'bg-blue-600' },
  globe: { icon: Globe, bg: 'bg-slate-600' },
};

export function CustomerHome() {
  const { user, customer, signOut } = useAuth();
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<(Order & { vendor?: Pick<VendorType, 'business_name'> | null })[]>([]);
  const [socials, setSocials] = useState<SocialPlatform[]>([]);
  const [loading, setLoading] = useState(true);
  const [notifOpen, setNotifOpen] = useState(false);
  const [tab, setTab] = useState<'home' | 'orders' | 'messages' | 'profile'>('home');

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data: prods } = await supabase
        .from('products')
        .select('*')
        .eq('active', true)
        .order('created_at', { ascending: false })
        .limit(12);
      setProducts((prods as Product[]) ?? []);

      const { data: ords } = await supabase
        .from('orders')
        .select('*, vendor:vendors(business_name)')
        .eq('customer_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);
      setOrders((ords as (Order & { vendor?: Pick<VendorType, 'business_name'> | null })[]) ?? []);
      setLoading(false);
    };
    load();

    const loadSocials = async () => {
      const { data } = await supabase
        .from('social_platforms')
        .select('*')
        .eq('active', true)
        .order('sort_order', { ascending: true });
      setSocials((data ?? []) as SocialPlatform[]);
    };
    loadSocials();
    const channel = supabase
      .channel('customer-social-platforms')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'social_platforms' }, loadSocials)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const handleSignOut = async () => {
    await signOut();
    toast('Ou dekonekte');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-slate-50">
        <Logo size="md" />
        <Loader2 className="animate-spin text-emerald-500" size={24} />
      </div>
    );
  }

  const displayName = customer?.full_name || user?.email?.split('@')[0] || 'Kliyan';

  return (
    <div className="min-h-screen bg-slate-50 max-w-md mx-auto relative pb-20">
      {/* Header */}
      <header className="bg-white border-b border-slate-100 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <Logo size="sm" />
          <span className="font-bold text-slate-900 text-sm">TOUPRE</span>
        </div>
        <button onClick={() => setNotifOpen(true)} className="relative w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 active:scale-90 transition">
          <Bell size={18} />
        </button>
      </header>

      {tab === 'home' && (
        <div className="space-y-4 px-4 py-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Byenveni, {displayName}!</h1>
            <p className="text-sm text-slate-500 mt-1">Mache TOUPRE — chache pwodwi, pase kòmand, swiv livrezon.</p>
          </div>

          {/* Categories placeholder */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { icon: Store, label: 'Kay' },
              { icon: Package, label: 'Machin' },
              { icon: ShoppingBag, label: 'Manje' },
              { icon: Store, label: 'Rad' },
            ].map((cat) => (
              <div key={cat.label} className="flex flex-col items-center gap-1.5 py-3 rounded-xl bg-white border border-slate-100">
                <cat.icon size={20} className="text-emerald-600" />
                <span className="text-[11px] text-slate-600 font-medium">{cat.label}</span>
              </div>
            ))}
          </div>

          {/* Products */}
          <div>
            <h2 className="font-bold text-slate-900 text-sm mb-2">Pwodwi disponib</h2>
            {products.length === 0 ? (
              <div className="text-center py-8 text-sm text-slate-400">
                Pa gen pwodwi disponib kounye a.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {products.map((p) => (
                  <div key={p.id} className="rounded-xl bg-white border border-slate-100 overflow-hidden">
                    {p.image_url ? (
                      <img src={p.image_url} alt={p.name} className="w-full h-28 object-cover" />
                    ) : (
                      <div className="w-full h-28 bg-slate-100 flex items-center justify-center">
                        <Package size={24} className="text-slate-300" />
                      </div>
                    )}
                    <div className="p-2.5">
                      <p className="text-xs font-semibold text-slate-900 truncate">{p.name}</p>
                      <p className="text-sm font-bold text-emerald-600 mt-0.5">{formatHTG(p.price)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Follow us on social media */}
          {socials.length > 0 && (
            <div>
              <h2 className="font-bold text-slate-900 text-sm mb-2">Swiv nou</h2>
              <div className="space-y-2">
                {socials.map((p) => {
                  const cfg = SOCIAL_ICONS[p.icon_key] ?? SOCIAL_ICONS.globe;
                  const Icon = cfg.icon;
                  return (
                    <button
                      key={p.id}
                      onClick={() => window.open(p.url, '_blank', 'noopener,noreferrer')}
                      className="w-full flex items-center gap-3 bg-white rounded-xl p-3 border border-slate-100 active:scale-95 transition"
                    >
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-white shrink-0 ${cfg.bg}`}>
                        <Icon size={20} />
                      </div>
                      <div className="flex-1 text-left min-w-0">
                        <p className="font-semibold text-slate-900 text-sm">{p.label}</p>
                        <p className="text-xs text-slate-400 truncate">{p.url.replace(/^https?:\/\//, '')}</p>
                      </div>
                      <ExternalLink size={14} className="text-emerald-600 shrink-0" />
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'orders' && (
        <div className="px-4 py-4 space-y-3">
          <h2 className="font-bold text-slate-900 text-lg mb-1">Kòmand mwen yo</h2>
          {orders.length === 0 ? (
            <div className="text-center py-12 text-sm text-slate-400">
              Ou pa gen kòmand ankò.
            </div>
          ) : (
            orders.map((o) => {
              const statusLabel = STATUS_LABELS_CUSTOMER[o.status] ?? o.status;
              const statusColor = STATUS_STYLES[o.status] ?? 'bg-slate-100 text-slate-600';
              return (
                <div key={o.id} className="rounded-xl bg-white border border-slate-100 p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-slate-500">{o.vendor?.business_name ?? 'Vandè'}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${statusColor}`}>
                      {statusLabel}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-slate-900">{formatHTG(o.total)}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {new Date(o.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              );
            })
          )}
        </div>
      )}

      {tab === 'messages' && (
        <div className="px-4 py-12 text-center text-sm text-slate-400">
          <MessageCircle size={32} className="mx-auto mb-2 text-slate-300" />
          Mesaj ou yo ap parèt isit la.
        </div>
      )}

      {tab === 'profile' && (
        <div className="px-4 py-4 space-y-4">
          <h2 className="font-bold text-slate-900 text-lg">Profild mwen</h2>
          <div className="rounded-xl bg-white border border-slate-100 p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-slate-400 w-20">Non:</span>
              <span className="text-slate-900 font-medium">{displayName}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-slate-400 w-20">Imèl:</span>
              <span className="text-slate-900 font-medium">{user?.email ?? '—'}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Phone size={14} className="text-slate-400" />
              <span className="text-slate-900 font-medium">{customer?.phone ?? 'Pa gen telefòn'}</span>
            </div>
            {customer?.address && (
              <div className="flex items-center gap-2 text-sm">
                <MapPin size={14} className="text-slate-400" />
                <span className="text-slate-900 font-medium">{customer.address}</span>
              </div>
            )}
          </div>

          {customer && !customer.phone && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-3">
              <p className="text-xs text-amber-700">Ajoute nimewo telefòn ou pou w ka resevwa apèl vandè yo.</p>
            </div>
          )}

          <button
            onClick={handleSignOut}
            className="w-full py-3 rounded-xl border border-slate-200 text-slate-700 font-semibold text-sm flex items-center justify-center gap-2 active:scale-95 transition"
          >
            <LogOut size={16} /> Dekonekte
          </button>

          <div className="pt-4 border-t border-slate-100">
            <p className="text-xs text-slate-400 text-center mb-3">Èske w gen yon biznis? Vin yon vandè TOUPRE.</p>
            <GoogleSignInButton context="vendor" label="Konekte kòm Vandè" />
          </div>
        </div>
      )}

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white border-t border-slate-100 px-2 py-1.5 flex items-center justify-around z-10">
        {[
          { key: 'home', icon: Store, label: 'Akèy' },
          { key: 'orders', icon: Package, label: 'Kòmand' },
          { key: 'messages', icon: MessageCircle, label: 'Mesaj' },
          { key: 'profile', icon: ShoppingBag, label: 'Profild' },
        ].map((item) => (
          <button
            key={item.key}
            onClick={() => setTab(item.key as typeof tab)}
            className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition ${tab === item.key ? 'text-emerald-600' : 'text-slate-400'}`}
          >
            <item.icon size={20} />
            <span className="text-[10px] font-medium">{item.label}</span>
          </button>
        ))}
      </nav>

      {notifOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex justify-end" onClick={() => setNotifOpen(false)}>
          <div className="w-full max-w-sm bg-white h-full overflow-y-auto p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-900">Notifikasyon</h3>
              <button onClick={() => setNotifOpen(false)} className="text-slate-400 text-sm">Fèmen</button>
            </div>
            <CustomerNotifications userId={user!.id} />
          </div>
        </div>
      )}
    </div>
  );
}

function CustomerNotifications({ userId }: { userId: string }) {
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20);
      setNotifs(data ?? []);
      setLoading(false);
    };
    load();
  }, [userId]);

  if (loading) return <div className="text-center py-8"><Loader2 className="animate-spin text-slate-300 mx-auto" size={20} /></div>;
  if (notifs.length === 0) return <p className="text-sm text-slate-400 text-center py-8">Pa gen notifikasyon.</p>;

  return (
    <div className="space-y-2">
      {notifs.map((n) => (
        <div key={n.id} className={`rounded-lg p-3 border ${n.read ? 'bg-white border-slate-100' : 'bg-emerald-50 border-emerald-100'}`}>
          <p className="text-sm font-semibold text-slate-900">{n.title}</p>
          {n.body && <p className="text-xs text-slate-500 mt-0.5">{n.body}</p>}
          <p className="text-[10px] text-slate-400 mt-1">{new Date(n.created_at).toLocaleString('fr-FR')}</p>
        </div>
      ))}
    </div>
  );
}
