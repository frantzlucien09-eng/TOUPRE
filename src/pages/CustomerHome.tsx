import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/lib/toast';
import { Logo } from '@/components/Logo';
import { GoogleSignInButton } from '@/components/GoogleSignInButton';
import { ProductCard } from '@/components/ProductCard';
import { CustomerProductDetail } from '@/pages/CustomerProductDetail';
import { CustomerCartPage } from '@/pages/CustomerCartPage';
import { CustomerCheckoutPage } from '@/pages/CustomerCheckoutPage';
import { CustomerOrderDetail } from '@/pages/CustomerOrderDetail';
import { CustomerMessagesPage } from '@/pages/CustomerMessagesPage';
import { CustomerAddressesPanel } from '@/pages/CustomerAddressesPanel';
import { getCartCount } from '@/lib/cart';
import { listFavoriteProducts, toggleFavorite } from '@/lib/favorites';
import { listRecentProducts } from '@/lib/recentViews';
import { listFavoriteVendors, toggleFavoriteVendor } from '@/lib/vendorFavorites';
import { CATEGORIES, CATEGORY_ICON, CATEGORY_LABEL } from '@/lib/categories';
import { filterPublicCatalogProducts } from '@/lib/classifiedRules';
import {
  Package, MapPin, Phone, Loader2, LogOut, Store, MessageCircle, Bell,
  ExternalLink, Instagram, Music2, Facebook, Globe, ShoppingCart, Search, Heart, User, SlidersHorizontal,
} from 'lucide-react';
import type { Order, Product, Vendor as VendorType, SocialPlatform, Notification, ProductCategory, Customer } from '@/lib/types';
import { formatHTG } from '@/lib/format';
import { STATUS_LABELS_CUSTOMER, STATUS_STYLES, DONE_STATUSES, ACTIVE_STATUSES, NEW_STATUSES } from '@/lib/orderStatus';

const SOCIAL_ICONS: Record<string, { icon: typeof Globe; bg: string }> = {
  instagram: { icon: Instagram, bg: 'bg-gradient-to-br from-amber-400 via-pink-500 to-purple-600' },
  tiktok: { icon: Music2, bg: 'bg-slate-900' },
  facebook: { icon: Facebook, bg: 'bg-blue-600' },
  globe: { icon: Globe, bg: 'bg-slate-600' },
};

type Screen = 'main' | 'product' | 'cart' | 'checkout' | 'orderDetail' | 'wishlist';
type Tab = 'home' | 'orders' | 'messages' | 'profile';

export function CustomerHome() {
  const { user, customer, signOut } = useAuth();
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<(Order & { vendor?: Pick<VendorType, 'business_name'> | null })[]>([]);
  const [socials, setSocials] = useState<SocialPlatform[]>([]);
  const [wishlist, setWishlist] = useState<Product[]>([]);
  const [recentProducts, setRecentProducts] = useState<Product[]>([]);
  const [favVendors, setFavVendors] = useState<VendorType[]>([]);
  const [loading, setLoading] = useState(true);
  const [notifOpen, setNotifOpen] = useState(false);
  const [unreadNotifs, setUnreadNotifs] = useState(0);
  const [tab, setTab] = useState<Tab>('home');
  const [screen, setScreen] = useState<Screen>('main');
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [cartCount, setCartCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<ProductCategory | null>(null);
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [orderFilter, setOrderFilter] = useState<'all' | 'active' | 'history'>('all');
  const [msgVendorId, setMsgVendorId] = useState<string | null>(null);
  const [msgProductId, setMsgProductId] = useState<string | null>(null);
  const [profileDraft, setProfileDraft] = useState({
    full_name: '',
    phone: '',
    department: '',
    city: '',
    address: '',
  });
  const [profileSaving, setProfileSaving] = useState(false);
  const [localCustomer, setLocalCustomer] = useState<Customer | null>(null);

  useEffect(() => {
    if (!customer) return;
    setLocalCustomer(customer);
    setProfileDraft({
      full_name: customer.full_name ?? '',
      phone: customer.phone ?? '',
      department: customer.department ?? '',
      city: customer.city ?? '',
      address: customer.address ?? '',
    });
  }, [customer]);

  const refreshCartCount = useCallback(async () => {
    if (!user) return;
    try {
      setCartCount(await getCartCount(user.id));
    } catch {
      // cart table may be unavailable until migration applied
    }
  }, [user]);

  const reloadOrders = useCallback(async () => {
    if (!user) return;
    const { data: ords } = await supabase
      .from('orders')
      .select('*, vendor:vendors(business_name)')
      .eq('customer_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);
    setOrders((ords as (Order & { vendor?: Pick<VendorType, 'business_name'> | null })[]) ?? []);
  }, [user]);

  const reloadWishlist = useCallback(async () => {
    if (!user) return;
    try {
      setWishlist(await listFavoriteProducts(user.id));
    } catch {
      setWishlist([]);
    }
  }, [user]);

  const reloadRecent = useCallback(async () => {
    if (!user) return;
    try {
      setRecentProducts(await listRecentProducts(user.id, 8));
    } catch {
      setRecentProducts([]);
    }
  }, [user]);

  const reloadFavVendors = useCallback(async () => {
    if (!user) return;
    try {
      setFavVendors(await listFavoriteVendors(user.id));
    } catch {
      setFavVendors([]);
    }
  }, [user]);

  const refreshUnreadNotifs = useCallback(async () => {
    if (!user) return;
    const { count } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('read', false);
    setUnreadNotifs(count ?? 0);
  }, [user]);

  const loadProducts = useCallback(async (
    q: string,
    cat: ProductCategory | null,
    minPrice: string,
    maxPrice: string,
  ) => {
    let query = supabase
      .from('products')
      .select('*')
      .eq('active', true)
      .order('created_at', { ascending: false })
      .limit(48);

    if (cat) query = query.eq('category', cat);
    if (q.trim()) query = query.ilike('name', `%${q.trim()}%`);
    const min = Number(minPrice);
    const max = Number(maxPrice);
    if (minPrice.trim() && !Number.isNaN(min)) query = query.gte('price', min);
    if (maxPrice.trim() && !Number.isNaN(max)) query = query.lte('price', max);

    const { data: prods } = await query;
    // Classifieds: only live approved ads; marketplace goods unchanged
    setProducts(filterPublicCatalogProducts((prods as Product[]) ?? []));

    if (q.trim() && prods && prods.length > 0) {
      const visible = filterPublicCatalogProducts(prods as Product[]);
      for (const p of visible.slice(0, 8)) {
        void supabase.rpc('increment_product_search', { p_product_id: p.id });
      }
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      await loadProducts('', null, '', '');
      await reloadOrders();
      await refreshCartCount();
      await reloadWishlist();
      await reloadRecent();
      await reloadFavVendors();
      await refreshUnreadNotifs();
      setLoading(false);
    };
    void load();

    const loadSocials = async () => {
      const { data } = await supabase
        .from('social_platforms')
        .select('*')
        .eq('active', true)
        .order('sort_order', { ascending: true });
      setSocials((data ?? []) as SocialPlatform[]);
    };
    void loadSocials();
    const channel = supabase
      .channel('customer-social-platforms')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'social_platforms' }, () => { void loadSocials(); })
      .subscribe();
    const notifChannel = supabase
      .channel('customer-notif-badge')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, () => {
        void refreshUnreadNotifs();
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
      void supabase.removeChannel(notifChannel);
    };
  }, [user, loadProducts, reloadOrders, refreshCartCount, reloadWishlist, reloadRecent, reloadFavVendors, refreshUnreadNotifs]);

  useEffect(() => {
    if (!user || loading) return;
    const t = window.setTimeout(() => {
      void loadProducts(searchQuery, categoryFilter, priceMin, priceMax);
    }, 250);
    return () => window.clearTimeout(t);
  }, [searchQuery, categoryFilter, priceMin, priceMax, user, loading, loadProducts]);

  const openProduct = (id: string) => {
    setSelectedProductId(id);
    setScreen('product');
  };

  const openMessageVendor = (vendorId: string, productId?: string) => {
    setMsgVendorId(vendorId);
    setMsgProductId(productId ?? null);
    setScreen('main');
    setSelectedProductId(null);
    setSelectedOrderId(null);
    setTab('messages');
  };

  const handleSignOut = async () => {
    await signOut();
    toast('Ou dekonekte');
  };

  const saveProfile = async () => {
    if (!user || !localCustomer) return;
    if (!profileDraft.full_name.trim()) {
      toast('Antre non ou', 'error');
      return;
    }
    setProfileSaving(true);
    const payload = {
      full_name: profileDraft.full_name.trim(),
      phone: profileDraft.phone.trim() || null,
      department: profileDraft.department.trim() || null,
      city: profileDraft.city.trim() || null,
      address: profileDraft.address.trim() || null,
    };
    const { data, error } = await supabase
      .from('customers')
      .update(payload)
      .eq('id', localCustomer.id)
      .select('*')
      .maybeSingle();
    setProfileSaving(false);
    if (error) {
      toast(error.message || 'Erè, eseye ankò', 'error');
      return;
    }
    if (data) setLocalCustomer(data as Customer);
    toast('Profild mete ajou');
  };

  const removeFromWishlist = async (productId: string) => {
    if (!user) return;
    try {
      await toggleFavorite(user.id, productId);
      await reloadWishlist();
      toast('Retire nan favori');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Erè', 'error');
    }
  };

  const filteredLabel = useMemo(() => {
    const bits: string[] = [];
    if (categoryFilter) bits.push(CATEGORY_LABEL[categoryFilter]);
    if (searchQuery.trim()) bits.push(`“${searchQuery.trim()}”`);
    if (priceMin || priceMax) bits.push('filtè pri');
    if (bits.length === 0) return 'Pwodwi disponib';
    return `Rezilta: ${bits.join(' · ')}`;
  }, [categoryFilter, searchQuery, priceMin, priceMax]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-slate-50">
        <Logo size="md" />
        <Loader2 className="animate-spin text-emerald-500" size={24} />
      </div>
    );
  }

  if (screen === 'product' && selectedProductId) {
    return (
      <div className="min-h-screen bg-slate-50 max-w-md mx-auto relative">
        <CustomerProductDetail
          productId={selectedProductId}
          onBack={() => { setScreen('main'); setSelectedProductId(null); void reloadRecent(); void reloadFavVendors(); }}
          onAddedToCart={() => { void refreshCartCount(); }}
          onMessageVendor={(vendorId, productId) => openMessageVendor(vendorId, productId)}
        />
      </div>
    );
  }

  if (screen === 'cart') {
    return (
      <div className="min-h-screen bg-slate-50 max-w-md mx-auto relative">
        <CustomerCartPage
          onBack={() => { setScreen('main'); void refreshCartCount(); }}
          onCheckout={() => setScreen('checkout')}
        />
      </div>
    );
  }

  if (screen === 'checkout') {
    return (
      <div className="min-h-screen bg-slate-50 max-w-md mx-auto relative">
        <CustomerCheckoutPage
          onBack={() => setScreen('cart')}
          onSuccess={() => {
            void refreshCartCount();
            void reloadOrders();
            setTab('orders');
            setScreen('main');
          }}
        />
      </div>
    );
  }

  if (screen === 'orderDetail' && selectedOrderId) {
    return (
      <div className="min-h-screen bg-slate-50 max-w-md mx-auto relative">
        <CustomerOrderDetail
          orderId={selectedOrderId}
          onBack={() => { setScreen('main'); setSelectedOrderId(null); void reloadOrders(); }}
          onMessageVendor={(vendorId) => openMessageVendor(vendorId)}
          onReordered={() => {
            void refreshCartCount();
            setScreen('cart');
          }}
        />
      </div>
    );
  }

  if (screen === 'wishlist') {
    return (
      <div className="min-h-screen bg-slate-50 max-w-md mx-auto relative pb-6">
        <div className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-slate-100 px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => { setScreen('main'); void reloadFavVendors(); }}
            className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center active:scale-90 transition"
            aria-label="Retounen"
          >
            <Heart size={18} className="text-rose-500" />
          </button>
          <h1 className="font-bold text-slate-900 text-base flex-1">Favori mwen</h1>
        </div>
        <div className="px-4 py-4 space-y-6">
          <div>
            <h2 className="font-bold text-slate-900 text-sm mb-2">Pwodwi</h2>
            {wishlist.length === 0 ? (
              <div className="text-center py-8 text-sm text-slate-400">
                Pa gen pwodwi favori ankò.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {wishlist.map((p) => (
                  <div key={p.id} className="relative">
                    <ProductCard product={p} onClick={() => openProduct(p.id)} />
                    <button
                      type="button"
                      onClick={() => void removeFromWishlist(p.id)}
                      className="absolute top-2 right-2 w-8 h-8 rounded-full bg-white/90 border border-slate-100 flex items-center justify-center text-rose-500 shadow-sm"
                      aria-label="Retire"
                    >
                      <Heart size={14} className="fill-rose-500" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div>
            <h2 className="font-bold text-slate-900 text-sm mb-2">Vandè favori</h2>
            {favVendors.length === 0 ? (
              <div className="text-center py-6 text-sm text-slate-400">
                Pa gen vandè favori ankò.
              </div>
            ) : (
              <div className="space-y-2">
                {favVendors.map((v) => (
                  <div key={v.id} className="flex items-center gap-3 bg-white rounded-xl p-3 border border-slate-100">
                    <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center overflow-hidden">
                      {v.avatar_url || v.logo_url ? (
                        <img src={v.avatar_url || v.logo_url || ''} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <Store size={18} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-900 text-sm truncate">{v.business_name}</p>
                      <p className="text-[11px] text-slate-400 truncate">{[v.city, v.department].filter(Boolean).join(', ') || 'Vandè TOUPRE'}</p>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!user) return;
                        await toggleFavoriteVendor(user.id, v.id);
                        await reloadFavVendors();
                      }}
                      className="w-8 h-8 rounded-full bg-rose-50 flex items-center justify-center text-rose-500"
                      aria-label="Retire"
                    >
                      <Heart size={14} className="fill-rose-500" />
                    </button>
                    <button
                      type="button"
                      onClick={() => openMessageVendor(v.id)}
                      className="text-xs font-semibold text-emerald-700"
                    >
                      Mesaj
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  const displayName = localCustomer?.full_name || customer?.full_name || user?.email?.split('@')[0] || 'Kliyan';

  return (
    <div className="min-h-screen bg-slate-50 max-w-md mx-auto relative pb-20">
      <header className="bg-white border-b border-slate-100 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <Logo size="sm" />
          <span className="font-bold text-slate-900 text-sm">TOUPRE</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { void reloadWishlist(); setScreen('wishlist'); }}
            className="relative w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 active:scale-90 transition"
            aria-label="Favori"
          >
            <Heart size={18} />
            {wishlist.length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">
                {wishlist.length > 9 ? '9+' : wishlist.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setScreen('cart')}
            className="relative w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 active:scale-90 transition"
            aria-label="Panye"
          >
            <ShoppingCart size={18} />
            {cartCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-emerald-600 text-white text-[10px] font-bold flex items-center justify-center">
                {cartCount > 9 ? '9+' : cartCount}
              </span>
            )}
          </button>
          <button onClick={() => { setNotifOpen(true); void refreshUnreadNotifs(); }} className="relative w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 active:scale-90 transition">
            <Bell size={18} />
            {unreadNotifs > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-emerald-600 text-white text-[10px] font-bold flex items-center justify-center">
                {unreadNotifs > 9 ? '9+' : unreadNotifs}
              </span>
            )}
          </button>
        </div>
      </header>

      {tab === 'home' && (
        <div className="space-y-4 px-4 py-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Byenveni, {displayName}!</h1>
            <p className="text-sm text-slate-500 mt-1">Mache TOUPRE — chache pwodwi, pase kòmand, swiv livrezon.</p>
          </div>

          <div className="relative flex gap-2">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Chache yon pwodwi..."
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <button
              type="button"
              onClick={() => setShowFilters((v) => !v)}
              className={`w-11 h-11 rounded-xl border flex items-center justify-center ${showFilters || priceMin || priceMax ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-white border-slate-200 text-slate-500'}`}
              aria-label="Filtè"
            >
              <SlidersHorizontal size={16} />
            </button>
          </div>

          {showFilters && (
            <div className="grid grid-cols-2 gap-2 bg-white border border-slate-100 rounded-xl p-3">
              <input
                value={priceMin}
                onChange={(e) => setPriceMin(e.target.value.replace(/[^\d.]/g, ''))}
                placeholder="Pri min (HTG)"
                inputMode="decimal"
                className="px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <input
                value={priceMax}
                onChange={(e) => setPriceMax(e.target.value.replace(/[^\d.]/g, ''))}
                placeholder="Pri max (HTG)"
                inputMode="decimal"
                className="px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              {(priceMin || priceMax) && (
                <button
                  type="button"
                  onClick={() => { setPriceMin(''); setPriceMax(''); }}
                  className="col-span-2 text-xs font-semibold text-slate-500 py-1"
                >
                  Efase filtè pri
                </button>
              )}
            </div>
          )}

          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            <button
              type="button"
              onClick={() => setCategoryFilter(null)}
              className={`shrink-0 px-3 py-2 rounded-xl text-xs font-semibold border transition ${
                !categoryFilter ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-600 border-slate-100'
              }`}
            >
              Tout
            </button>
            {CATEGORIES.map((cat) => (
              <button
                key={cat.key}
                type="button"
                onClick={() => setCategoryFilter(cat.key === categoryFilter ? null : cat.key)}
                className={`shrink-0 px-3 py-2 rounded-xl text-xs font-semibold border transition flex items-center gap-1 ${
                  categoryFilter === cat.key ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-600 border-slate-100'
                }`}
              >
                <span>{CATEGORY_ICON[cat.key]}</span>
                <span>{cat.label.split(' / ')[0]}</span>
              </button>
            ))}
          </div>

          <div className="grid grid-cols-4 gap-2">
            {CATEGORIES.slice(0, 4).map((cat) => (
              <button
                key={cat.key}
                type="button"
                onClick={() => setCategoryFilter(cat.key === categoryFilter ? null : cat.key)}
                className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border transition ${
                  categoryFilter === cat.key ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-100'
                }`}
              >
                <Store size={20} className="text-emerald-600" />
                <span className="text-[11px] text-slate-600 font-medium">{cat.label.split(' / ')[0]}</span>
              </button>
            ))}
          </div>

          <div>
            <h2 className="font-bold text-slate-900 text-sm mb-2">{filteredLabel}</h2>
            {products.length === 0 ? (
              <div className="text-center py-8 text-sm text-slate-400">
                Pa gen pwodwi disponib kounye a.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {products.map((p) => (
                  <ProductCard
                    key={p.id}
                    product={p}
                    onClick={() => openProduct(p.id)}
                  />
                ))}
              </div>
            )}
          </div>

          {recentProducts.length > 0 && !searchQuery && !categoryFilter && (
            <div>
              <h2 className="font-bold text-slate-900 text-sm mb-2">Ou te gade dènyèman</h2>
              <div className="grid grid-cols-2 gap-3">
                {recentProducts.map((p) => (
                  <ProductCard key={`recent-${p.id}`} product={p} onClick={() => openProduct(p.id)} />
                ))}
              </div>
            </div>
          )}

          {favVendors.length > 0 && !searchQuery && (
            <div>
              <h2 className="font-bold text-slate-900 text-sm mb-2">Vandè favori</h2>
              <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                {favVendors.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => openMessageVendor(v.id)}
                    className="shrink-0 w-28 rounded-xl bg-white border border-slate-100 p-3 text-center active:scale-95 transition"
                  >
                    <div className="w-10 h-10 mx-auto rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center overflow-hidden mb-2">
                      {v.avatar_url || v.logo_url ? (
                        <img src={v.avatar_url || v.logo_url || ''} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <Store size={16} />
                      )}
                    </div>
                    <p className="text-[11px] font-semibold text-slate-800 truncate">{v.business_name}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

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
          <div className="flex gap-2">
            {([
              { key: 'all' as const, label: 'Tout' },
              { key: 'active' as const, label: 'Aktif' },
              { key: 'history' as const, label: 'Istwa' },
            ]).map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setOrderFilter(f.key)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
                  orderFilter === f.key
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-white text-slate-600 border-slate-100'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          {orders.filter((o) => {
            if (orderFilter === 'active') {
              return NEW_STATUSES.includes(o.status) || ACTIVE_STATUSES.includes(o.status);
            }
            if (orderFilter === 'history') {
              return DONE_STATUSES.includes(o.status);
            }
            return true;
          }).length === 0 ? (
            <div className="text-center py-12 text-sm text-slate-400">
              Ou pa gen kòmand ankò.
            </div>
          ) : (
            orders
              .filter((o) => {
                if (orderFilter === 'active') {
                  return NEW_STATUSES.includes(o.status) || ACTIVE_STATUSES.includes(o.status);
                }
                if (orderFilter === 'history') {
                  return DONE_STATUSES.includes(o.status);
                }
                return true;
              })
              .map((o) => {
              const statusLabel = STATUS_LABELS_CUSTOMER[o.status] ?? o.status;
              const statusColor = STATUS_STYLES[o.status] ?? 'bg-slate-100 text-slate-600';
              return (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => { setSelectedOrderId(o.id); setScreen('orderDetail'); }}
                  className="w-full text-left rounded-xl bg-white border border-slate-100 p-3 active:scale-95 transition"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-slate-500">{o.vendor?.business_name ?? 'Vandè'}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${statusColor}`}>
                      {statusLabel}
                    </span>
                  </div>
                  <p className="text-sm font-bold text-slate-900">{formatHTG(o.total)}</p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    {o.order_number ? `${o.order_number} · ` : ''}
                    {o.payment_status === 'paid' ? 'Peye' : 'Pa peye'} · {new Date(o.created_at).toLocaleString('fr-FR')}
                  </p>
                </button>
              );
            })
          )}
        </div>
      )}

      {tab === 'messages' && (
        <CustomerMessagesPage
          initialVendorId={msgVendorId}
          initialProductId={msgProductId}
          onClearInitial={() => { setMsgVendorId(null); setMsgProductId(null); }}
        />
      )}

      {tab === 'profile' && (
        <div className="px-4 py-4 space-y-4">
          <h2 className="font-bold text-slate-900 text-lg">Profild mwen</h2>
          <div className="rounded-xl bg-white border border-slate-100 p-4 space-y-3">
            <label className="block">
              <span className="text-xs text-slate-500">Non konplè</span>
              <input
                value={profileDraft.full_name}
                onChange={(e) => setProfileDraft((d) => ({ ...d, full_name: e.target.value }))}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </label>
            <label className="block">
              <span className="text-xs text-slate-500 flex items-center gap-1"><Phone size={12} /> Telefòn</span>
              <input
                value={profileDraft.phone}
                onChange={(e) => setProfileDraft((d) => ({ ...d, phone: e.target.value }))}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="+509 ..."
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="text-xs text-slate-500">Depatman</span>
                <input
                  value={profileDraft.department}
                  onChange={(e) => setProfileDraft((d) => ({ ...d, department: e.target.value }))}
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </label>
              <label className="block">
                <span className="text-xs text-slate-500">Vil</span>
                <input
                  value={profileDraft.city}
                  onChange={(e) => setProfileDraft((d) => ({ ...d, city: e.target.value }))}
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </label>
            </div>
            <label className="block">
              <span className="text-xs text-slate-500 flex items-center gap-1"><MapPin size={12} /> Adrès</span>
              <textarea
                value={profileDraft.address}
                onChange={(e) => setProfileDraft((d) => ({ ...d, address: e.target.value }))}
                rows={2}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
              />
            </label>
            <div className="flex items-center gap-2 text-sm pt-1">
              <span className="text-slate-400 w-16">Imèl:</span>
              <span className="text-slate-900 font-medium truncate">{user?.email ?? '—'}</span>
            </div>
            <button
              type="button"
              onClick={() => void saveProfile()}
              disabled={profileSaving}
              className="w-full py-2.5 rounded-xl bg-emerald-600 text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95 transition"
            >
              {profileSaving ? <Loader2 size={16} className="animate-spin" /> : null}
              Sove chanjman
            </button>
          </div>

          <CustomerAddressesPanel />

          {!profileDraft.phone && (
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

      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white border-t border-slate-100 px-2 py-1.5 flex items-center justify-around z-10">
        {[
          { key: 'home' as const, icon: Store, label: 'Akèy' },
          { key: 'orders' as const, icon: Package, label: 'Kòmand' },
          { key: 'messages' as const, icon: MessageCircle, label: 'Mesaj' },
          { key: 'profile' as const, icon: User, label: 'Profild' },
        ].map((item) => (
          <button
            key={item.key}
            onClick={() => { setTab(item.key); setScreen('main'); }}
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
              <h3 className="font-bold text-slate-900">Sant Notifikasyon</h3>
              <button onClick={() => setNotifOpen(false)} className="text-slate-400 text-sm">Fèmen</button>
            </div>
            <CustomerNotifications
              userId={user!.id}
              onChanged={() => { void refreshUnreadNotifs(); }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function CustomerNotifications({ userId, onChanged }: { userId: string; onChanged?: () => void }) {
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<'all' | 'order' | 'other'>('all');

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(40);
    setNotifs((data ?? []) as Notification[]);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void load();
    const channel = supabase
      .channel(`customer-notifs-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, () => { void load(); })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [userId, load]);

  const markRead = async (id: string) => {
    await supabase
      .from('notifications')
      .update({ read: true, is_read: true, read_at: new Date().toISOString() })
      .eq('id', id);
    setNotifs((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    onChanged?.();
  };

  const markAllRead = async () => {
    await supabase
      .from('notifications')
      .update({ read: true, is_read: true, read_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('read', false);
    setNotifs((prev) => prev.map((n) => ({ ...n, read: true })));
    onChanged?.();
  };

  if (loading) return <div className="text-center py-8"><Loader2 className="animate-spin text-slate-300 mx-auto" size={20} /></div>;
  if (notifs.length === 0) return <p className="text-sm text-slate-400 text-center py-8">Pa gen notifikasyon.</p>;

  const unread = notifs.some((n) => !n.read);
  const filtered = notifs.filter((n) => {
    if (typeFilter === 'order') return n.type === 'order';
    if (typeFilter === 'other') return n.type !== 'order';
    return true;
  });

  return (
    <div className="space-y-2">
      <div className="flex gap-2 mb-2">
        {([
          { key: 'all' as const, label: 'Tout' },
          { key: 'order' as const, label: 'Kòmand' },
          { key: 'other' as const, label: 'Lòt' },
        ]).map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setTypeFilter(f.key)}
            className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
              typeFilter === f.key ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-600 border-slate-100'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>
      {unread && (
        <button
          type="button"
          onClick={() => void markAllRead()}
          className="w-full mb-2 text-xs font-semibold text-emerald-700 py-2 rounded-lg bg-emerald-50 border border-emerald-100"
        >
          Make tout yo li
        </button>
      )}
      {filtered.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-6">Pa gen notifikasyon nan kategori sa a.</p>
      ) : (
        filtered.map((n) => (
          <button
            key={n.id}
            type="button"
            onClick={() => { if (!n.read) void markRead(n.id); }}
            className={`w-full text-left rounded-lg p-3 border ${n.read ? 'bg-white border-slate-100' : 'bg-emerald-50 border-emerald-100'}`}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-slate-900">{n.title}</p>
              <span className="text-[10px] text-slate-400 shrink-0">{n.type}</span>
            </div>
            {n.body && <p className="text-xs text-slate-500 mt-0.5">{n.body}</p>}
            <p className="text-[10px] text-slate-400 mt-1">{new Date(n.created_at).toLocaleString('fr-FR')}</p>
          </button>
        ))
      )}
    </div>
  );
}
