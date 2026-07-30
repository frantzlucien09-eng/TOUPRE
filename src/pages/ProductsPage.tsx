import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/lib/toast';
import { useConfirm } from '@/lib/confirm';
import { formatHTG, formatDate } from '@/lib/format';
import { CATEGORY_ICON, CATEGORY_LABEL, isAdCategory } from '@/lib/categories';
import {
  fetchLatestAdPaymentsForProducts,
  softExpireListingIfNeeded,
  prepareListingRenewal,
} from '@/lib/listingActions';
import {
  LISTING_STATUS_LABELS,
  LISTING_STATUS_STYLES,
  resolveListingDisplayStatus,
  type ListingDisplayStatus,
} from '@/lib/listingStatus';
import {
  listingFeeForCategory,
  loadListingFeeSettings,
  type ListingFeeSettings,
} from '@/lib/listingSettings';
import type { AdPayment, Product, ProductCategory } from '@/lib/types';
import { Header } from '@/components/Header';
import { Modal } from '@/components/Modal';
import { EmptyState } from '@/components/EmptyState';
import { ProductForm } from '@/components/ProductForm';
import { ProductCard } from '@/components/ProductCard';
import { AdPaymentModal } from '@/components/AdPaymentModal';
import {
  Package, Plus, Trash2, Loader2, Image as ImageIcon, Pencil,
  AlertTriangle, Clock, Eye, EyeOff, BadgeCheck, Hourglass,
} from 'lucide-react';

export function ProductsPage() {
  const { vendor } = useAuth();
  const { toast } = useToast();
  const { confirm } = useConfirm();
  const [products, setProducts] = useState<Product[]>([]);
  const [paymentsByProduct, setPaymentsByProduct] = useState<Map<string, AdPayment>>(new Map());
  const [listingSettings, setListingSettings] = useState<ListingFeeSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Product | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [detail, setDetail] = useState<Product | null>(null);
  const [payForProduct, setPayForProduct] = useState<{ id: string; category: 'kay' | 'machin' } | null>(null);

  const load = async () => {
    if (!vendor) return;
    setLoading(true);
    const [{ data }, settings] = await Promise.all([
      supabase
        .from('products')
        .select('*')
        .eq('vendor_id', vendor.id)
        .order('created_at', { ascending: false }),
      loadListingFeeSettings(),
    ]);
    setListingSettings(settings);

    let list = (data ?? []) as Product[];
    // Soft-expire without deleting — keep photos/history for Renew
    list = await Promise.all(
      list.map(async (p) => (isAdCategory(p.category) ? softExpireListingIfNeeded(p) : p))
    );
    setProducts(list);

    const adIds = list.filter((p) => isAdCategory(p.category)).map((p) => p.id);
    try {
      setPaymentsByProduct(await fetchLatestAdPaymentsForProducts(adIds));
    } catch {
      setPaymentsByProduct(new Map());
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [vendor]);

  const toggleActive = async (p: Product) => {
    if (isAdCategory(p.category)) {
      toast('Anons Kay/Machin gen pwòp estati yo. Wè detay pou jere l.', 'info');
      return;
    }
    const newVal = !p.active;
    setProducts((list) => list.map((x) => (x.id === p.id ? { ...x, active: newVal } : x)));
    const { error } = await supabase.from('products').update({ active: newVal, updated_at: new Date().toISOString() }).eq('id', p.id);
    if (error) {
      setProducts((list) => list.map((x) => (x.id === p.id ? { ...x, active: !newVal } : x)));
      toast('Erè, eseye ankò', 'error');
    } else {
      toast(newVal ? 'Pwodwi aktif' : 'Pwodwi fini');
    }
  };

  const deleteProduct = async (p: Product) => {
    const ok = await confirm({
      title: 'Efase pwodwi',
      message: `Ou si vle efase "${p.name}"? Aksyon sa a pa ka defè.`,
      confirmText: 'Efase',
      danger: true,
    });
    if (!ok) return;
    const { error } = await supabase.from('products').delete().eq('id', p.id);
    if (error) {
      toast('Erè, eseye ankò', 'error');
    } else {
      setProducts((list) => list.filter((x) => x.id !== p.id));
      setEditing(null);
      setDetail(null);
      toast('Pwodwi efase');
    }
  };

  const markSold = async (p: Product) => {
    const ok = await confirm({
      title: 'Make kòm Vann/Lwe',
      message: 'Anons sa a ap disparèt nan lis piblik la. Ou ka repibliye l pita si sa nesesè.',
      confirmText: 'Konfime',
    });
    if (!ok) return;
    const { error } = await supabase.from('products').update({
      ad_status: 'sold', active: false, updated_at: new Date().toISOString(),
    }).eq('id', p.id);
    if (error) {
      toast('Erè, eseye ankò', 'error');
    } else {
      toast('Anons make kòm Vann/Lwe');
      load();
      setDetail(null);
    }
  };

  const relistAd = async (p: Product) => {
    setDetail(null);
    if (p.ad_status === 'expired' || p.ad_status === 'sold') {
      try {
        await prepareListingRenewal(p.id);
      } catch {
        // still open payment modal
      }
    }
    setPayForProduct({ id: p.id, category: p.category as 'kay' | 'machin' });
  };

  if (!vendor) return null;
  const active = products.filter((p) => {
    if (!isAdCategory(p.category)) return p.active;
    return resolveListingDisplayStatus(p, paymentsByProduct.get(p.id)) === 'active';
  }).length;
  const finished = products.length - active;
  const defaultFee = listingSettings
    ? listingFeeForCategory(listingSettings, 'kay')
    : 2500;

  return (
    <div className="pb-24">
      <Header title="Pwodwi mwen yo" subtitle={`${products.length} total · ${active} aktif · ${finished} fini`} />

      <div className="px-4 pt-4">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="animate-spin text-slate-400" /></div>
        ) : products.length === 0 ? (
          <EmptyState
            icon={<Package size={24} />}
            title="Pa gen pwodwi toujou"
            message="Klike bouton anba a pou ajoute premye pwodwi ou."
          />
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {products.map((p) => {
              const isAd = isAdCategory(p.category);
              const displayStatus = isAd
                ? resolveListingDisplayStatus(p, paymentsByProduct.get(p.id))
                : null;
              return (
                <div key={p.id} className="flex flex-col">
                  <ProductCard product={p} onClick={() => setDetail(p)} />
                  <div className="flex items-center justify-between mt-1.5 px-1">
                    {isAd && displayStatus ? (
                      <AdStatusPill status={displayStatus} />
                    ) : (
                      <button
                        onClick={() => toggleActive(p)}
                        className={`w-3.5 h-3.5 rounded-full shrink-0 transition active:scale-90 ${p.active ? 'bg-emerald-500' : 'bg-slate-300'}`}
                        title={p.active ? 'Aktif' : 'Fini'}
                      />
                    )}
                    <span className="text-[10px] text-slate-400">{isAd ? 'Anons' : `Stok: ${p.stock}`}</span>
                    <button onClick={() => setEditing(p)} className="text-slate-400 hover:text-emerald-600 active:scale-90 transition" title="Modifye">
                      <Pencil size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="fixed bottom-20 left-0 right-0 px-4 z-30">
        <button
          onClick={() => setShowForm(true)}
          className="w-full max-w-md mx-auto py-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-lg active:scale-95 transition"
        >
          <Plus size={18} /> Ajoute yon pwodwi
        </button>
      </div>

      {/* Detail modal */}
      <Modal open={!!detail} onClose={() => setDetail(null)} title="Detay Pwodwi">
        {detail && (
          <ProductDetailView
            product={detail}
            displayStatus={
              isAdCategory(detail.category)
                ? resolveListingDisplayStatus(detail, paymentsByProduct.get(detail.id))
                : null
            }
            listingFee={
              isAdCategory(detail.category) && listingSettings
                ? listingFeeForCategory(listingSettings, detail.category as 'kay' | 'machin')
                : defaultFee
            }
            onEdit={() => { setEditing(detail); setDetail(null); }}
            onDelete={() => deleteProduct(detail)}
            onMarkSold={() => markSold(detail)}
            onRelist={() => void relistAd(detail)}
          />
        )}
      </Modal>

      {/* Edit modal */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title="Modifye Pwodwi">
        {editing && (
          <ProductForm
            product={editing}
            onSave={async (vals) => {
              const { error } = await supabase
                .from('products')
                .update({ ...vals, updated_at: new Date().toISOString() })
                .eq('id', editing.id);
              if (error) {
                toast('Erè, eseye ankò', 'error');
              } else {
                toast('Chanjman anrejistre');
                setEditing(null);
                load();
              }
            }}
            onDelete={() => deleteProduct(editing)}
          />
        )}
      </Modal>

      {/* Add modal */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title="Nouvo Pwodwi">
        <ProductForm
          product={null}
          onSave={async (vals) => {
            const isAd = isAdCategory(vals.category);
            const insertVals: Record<string, unknown> = {
              ...vals,
              vendor_id: vendor.id,
              active: isAd ? false : true,
              ad_status: isAd ? 'draft' : null,
              status: isAd ? 'draft' : 'active',
            };
            const { data, error } = await supabase.from('products').insert(insertVals).select('id, category').single();
            if (error) {
              toast('Erè, eseye ankò', 'error');
              return;
            }
            if (isAd) {
              toast('Anons sove kòm brouyon. Ou dwe peye pou pibliye l.', 'info');
              setShowForm(false);
              setPayForProduct({ id: data.id, category: data.category as 'kay' | 'machin' });
            } else {
              setShowForm(false);
              load();

              // Check if this is the vendor's first product in this category
              const { count: catCount } = await supabase
                .from('products')
                .select('id', { count: 'exact', head: true })
                .eq('vendor_id', vendor.id)
                .eq('category', vals.category)
                .neq('id', data.id);
              const isFirstInCategory = (catCount ?? 0) === 0;
              const catLabel = CATEGORY_LABEL[vals.category as ProductCategory] ?? vals.category;

              // Get current rank
              const { data: rank } = await supabase
                .from('vendor_rankings')
                .select('zone_rank, national_rank')
                .eq('vendor_id', vendor.id)
                .maybeSingle();

              let msg = `Pwodwi ou pibliye ak siksè nan kategori ${catLabel}.`;
              if (isFirstInCategory) msg += ` Sa se premye ${catLabel} ou poste!`;
              if (rank?.zone_rank) msg += ` Ou kounye a nan pozisyon #${rank.zone_rank} nan zòn ou.`;
              toast(msg, 'success', 5000);
            }
          }}
        />
      </Modal>

      {/* Ad payment modal */}
      {payForProduct && (
        <AdPaymentModal
          open={!!payForProduct}
          onClose={() => setPayForProduct(null)}
          productId={payForProduct.id}
          category={payForProduct.category}
          onPaid={() => { setPayForProduct(null); load(); }}
        />
      )}
    </div>
  );
}

function AdStatusPill({ status }: { status: ListingDisplayStatus }) {
  const iconMap: Record<ListingDisplayStatus, typeof Clock> = {
    pending_payment: Hourglass,
    pending_review: Clock,
    active: Eye,
    rejected: EyeOff,
    expired: Clock,
    sold: BadgeCheck,
  };
  const Icon = iconMap[status] ?? Clock;
  return (
    <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${LISTING_STATUS_STYLES[status]}`}>
      <Icon size={9} /> {LISTING_STATUS_LABELS[status]}
    </span>
  );
}

function ProductDetailView({
  product, displayStatus, listingFee, onEdit, onDelete, onMarkSold, onRelist,
}: {
  product: Product;
  displayStatus: ListingDisplayStatus | null;
  listingFee: number;
  onEdit: () => void;
  onDelete: () => void;
  onMarkSold: () => void;
  onRelist: () => void;
}) {
  const photos = product.photos ?? [];
  const cover = photos[product.cover_index] ?? photos[0] ?? product.image_url;
  const isAd = isAdCategory(product.category);

  return (
    <div className="space-y-4">
      {photos.length > 0 ? (
        <div>
          <div className="aspect-video rounded-xl overflow-hidden bg-slate-100">
            <img src={cover} alt={product.name} className="w-full h-full object-cover" />
          </div>
          {photos.length > 1 && (
            <div className="flex gap-2 mt-2 overflow-x-auto no-scrollbar">
              {photos.map((ph, i) => (
                <div key={i} className={`w-14 h-14 rounded-lg overflow-hidden shrink-0 border-2 ${i === product.cover_index ? 'border-emerald-500' : 'border-transparent'}`}>
                  <img src={ph} alt="" className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="aspect-video rounded-xl bg-slate-100 flex items-center justify-center text-slate-300">
          <ImageIcon size={28} />
        </div>
      )}

      {product.video_url && (
        <div className="rounded-xl overflow-hidden bg-slate-900">
          <video src={product.video_url} controls className="w-full" />
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        {product.category && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold">
            {CATEGORY_ICON[product.category]} {CATEGORY_LABEL[product.category]}
          </span>
        )}
        {isAd && displayStatus && <AdStatusPill status={displayStatus} />}
      </div>

      <div>
        <h3 className="font-bold text-slate-900 text-base">{product.name}</h3>
        <p className="text-lg font-bold text-emerald-600 mt-0.5">
          {product.price_on_request ? 'Pri sou Demand' : formatHTG(product.price)}
        </p>
        {!isAd && <p className="text-xs text-slate-500 mt-1">Stok: {product.stock} · {product.active ? 'Aktif' : 'Fini'}</p>}
      </div>

      {product.description && (
        <div>
          <p className="text-xs font-semibold text-slate-500 mb-1">Deskripsyon</p>
          <p className="text-sm text-slate-700 whitespace-pre-wrap">{product.description}</p>
        </div>
      )}

      {(product.details?.department || product.details?.city) && (
        <div>
          <p className="text-xs font-semibold text-slate-500 mb-1">Kote pwodwi a ye</p>
          <p className="text-sm text-slate-700">
            {[product.details?.city, product.details?.department].filter(Boolean).join(', ')}
          </p>
        </div>
      )}

      <CategoryDetails product={product} />

      {isAd && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-1.5 text-xs">
          <div className="flex items-start gap-2 text-amber-800">
            <AlertTriangle size={16} className="shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              Pwodwi sa a se yon <b>anons</b> — TOUPRE pa jere tranzaksyon acha a. Kliyan kontakte w dirèkteman (Contact Seller).
            </p>
          </div>
          {product.ad_paid_at && (
            <p className="text-slate-500">Peye / verifye: {formatDate(product.ad_paid_at)}</p>
          )}
          {product.ad_expires_at && displayStatus === 'active' && (
            <p className="text-slate-500">Ekspire sou: {formatDate(product.ad_expires_at)}</p>
          )}
          {displayStatus === 'expired' && (
            <p className="text-slate-500">Anons ekspire — foto ak istwa yo rete. Ou ka renouvle.</p>
          )}
        </div>
      )}

      <div className="space-y-2 pt-1">
        {isAd && displayStatus === 'active' && (
          <button onClick={onMarkSold} className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm flex items-center justify-center gap-2 active:scale-95 transition">
            <BadgeCheck size={18} /> Make kòm Vann/Lwe
          </button>
        )}
        {isAd && (displayStatus === 'expired' || displayStatus === 'sold') && (
          <button onClick={onRelist} className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm flex items-center justify-center gap-2 active:scale-95 transition">
            <Plus size={18} /> Renouvle anons ({formatHTG(listingFee)})
          </button>
        )}
        {isAd && displayStatus === 'pending_payment' && (
          <button onClick={onRelist} className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm flex items-center justify-center gap-2 active:scale-95 transition">
            Peye {formatHTG(listingFee)} pou pibliye
          </button>
        )}
        {isAd && displayStatus === 'pending_review' && (
          <p className="text-center text-xs text-blue-700 bg-blue-50 border border-blue-100 rounded-xl py-2.5">
            Anons nan Pending Review — admin ap verifye.
          </p>
        )}
        {isAd && displayStatus === 'rejected' && (
          <button onClick={onRelist} className="w-full py-3 rounded-xl border border-amber-200 text-amber-800 font-semibold text-sm active:scale-95 transition">
            Soumèt ankò (peye frè)
          </button>
        )}
        <div className="flex gap-3">
          <button onClick={onDelete} className="px-4 py-3 rounded-xl border border-red-200 text-red-600 font-semibold text-sm flex items-center gap-2 hover:bg-red-50 active:scale-95 transition">
            <Trash2 size={16} /> Efase
          </button>
          <button onClick={onEdit} className="flex-1 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm flex items-center justify-center gap-2 active:scale-95 transition">
            <Pencil size={16} /> Modifye
          </button>
        </div>
      </div>
    </div>
  );
}

function CategoryDetails({ product }: { product: Product }) {
  const d = product.details ?? {};
  const rows: { label: string; value: string }[] = [];

  if (product.category === 'kay') {
    if (d.listing_type) rows.push({ label: 'Tip anons', value: d.listing_type });
    if (d.kay_type) rows.push({ label: 'Tip kay', value: d.kay_type });
    if (d.rooms) rows.push({ label: 'Chanm', value: d.rooms });
    if (d.bathrooms) rows.push({ label: 'Twalèt', value: d.bathrooms });
    if (d.area) rows.push({ label: 'Sipèfisi', value: `${d.area} m²` });
    if (d.floor) rows.push({ label: 'Etaj', value: d.floor });
    if (d.address) rows.push({ label: 'Adrès', value: d.address });
    const feats = [
      d.has_electricity && 'Gen Kouran',
      d.has_water && 'Gen Dlo',
      d.has_garage && 'Gen Garaj',
      d.has_ac && 'Klimatize',
      d.is_fenced && 'Kay Klotire',
    ].filter(Boolean);
    if (feats.length) rows.push({ label: 'Ekipman', value: feats.join(', ') });
  } else if (product.category === 'machin') {
    if (d.make) rows.push({ label: 'Mak', value: d.make });
    if (d.model) rows.push({ label: 'Modèl', value: d.model });
    if (d.year) rows.push({ label: 'Ane', value: d.year });
    if (d.mileage) rows.push({ label: 'Kilomtraj', value: `${d.mileage} km` });
    if (d.fuel) rows.push({ label: 'Motè', value: d.fuel });
    if (d.transmission) rows.push({ label: 'Transmisyon', value: d.transmission });
    if (d.color) rows.push({ label: 'Koulè', value: d.color });
    if (d.condition) rows.push({ label: 'Kondisyon', value: d.condition });
    rows.push({ label: 'Gen papye/plak', value: d.has_papers ? 'Wi' : 'Non' });
  } else if (product.category === 'manje') {
    if (d.food_type) rows.push({ label: 'Tip manje', value: d.food_type });
    if (d.portion) rows.push({ label: 'Pòsyon', value: d.portion });
    if (d.ingredients) rows.push({ label: 'Engredyan', value: d.ingredients });
    if (d.availability) rows.push({ label: 'Disponiblite', value: d.availability });
    if (d.prep_time) rows.push({ label: 'Tan preparasyon', value: d.prep_time });
  } else if (product.category === 'rad') {
    if (d.clothing_type) rows.push({ label: 'Tip rad', value: d.clothing_type });
    if (d.sizes?.length) rows.push({ label: 'Mezi', value: d.sizes.join(', ') });
    if (d.colors) rows.push({ label: 'Koulè', value: d.colors });
    if (d.material) rows.push({ label: 'Materyèl', value: d.material });
    if (d.sex) rows.push({ label: 'Sèks', value: d.sex });
  } else if (product.category === 'soulye') {
    if (d.brand) rows.push({ label: 'Mak', value: d.brand });
    if (d.model) rows.push({ label: 'Modèl', value: d.model });
    if (d.sizes?.length) rows.push({ label: 'Pwentiraj', value: d.sizes.join(', ') });
    if (d.color) rows.push({ label: 'Koulè', value: d.color });
    if (d.condition) rows.push({ label: 'Kondisyon', value: d.condition });
  }

  if (rows.length === 0) return null;
  return (
    <div>
      <p className="text-xs font-semibold text-slate-500 mb-2">Detay espesifik</p>
      <div className="bg-slate-50 rounded-xl p-3 space-y-1.5">
        {rows.map((r, i) => (
          <div key={i} className="flex justify-between text-sm">
            <span className="text-slate-500">{r.label}</span>
            <span className="font-medium text-slate-900 text-right">{r.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
