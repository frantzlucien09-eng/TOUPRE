import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/lib/toast';
import { addToCart } from '@/lib/cart';
import { isFavorite, toggleFavorite } from '@/lib/favorites';
import { formatHTG } from '@/lib/format';
import { CATEGORY_ICON, CATEGORY_LABEL, isAdCategory } from '@/lib/categories';
import type { Product, Vendor } from '@/lib/types';
import { ArrowLeft, Heart, Image as ImageIcon, Loader2, MessageCircle, ShoppingCart, Store } from 'lucide-react';

type Props = {
  productId: string;
  onBack: () => void;
  onAddedToCart?: () => void;
  onMessageVendor?: (vendorId: string, productId: string) => void;
};

export function CustomerProductDetail({ productId, onBack, onAddedToCart, onMessageVendor }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [product, setProduct] = useState<Product | null>(null);
  const [vendor, setVendor] = useState<Pick<Vendor, 'id' | 'business_name' | 'city' | 'department'> | null>(null);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [photoIdx, setPhotoIdx] = useState(0);
  const [favorited, setFavorited] = useState(false);
  const [favBusy, setFavBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('products')
        .select('*, vendor:vendors(id, business_name, city, department)')
        .eq('id', productId)
        .maybeSingle();
      if (cancelled) return;
      if (error || !data) {
        toast('Pwodwi pa jwenn', 'error');
        setLoading(false);
        return;
      }
      const row = data as Product & { vendor?: typeof vendor };
      setProduct(row);
      setVendor(row.vendor ?? null);
      setPhotoIdx(row.cover_index ?? 0);
      setLoading(false);
      void supabase.rpc('increment_product_view', { p_product_id: productId });
    };
    load();
    return () => { cancelled = true; };
  }, [productId, toast]);

  useEffect(() => {
    if (!user?.id || !productId) {
      setFavorited(false);
      return;
    }
    void isFavorite(user.id, productId).then(setFavorited).catch(() => setFavorited(false));
  }, [user?.id, productId]);

  const handleAdd = async () => {
    if (!user || !product) return;
    if (product.price_on_request) {
      toast('Pri sou demand — kontakte vandè a dirèkteman.', 'info');
      return;
    }
    if (isAdCategory(product.category)) {
      toast('Anons sa a se pou kontak dirèk — pa nan panye.', 'info');
      return;
    }
    if (!product.active || (typeof product.stock === 'number' && product.stock <= 0)) {
      toast('Pwodwi sa a pa disponib.', 'error');
      return;
    }
    setAdding(true);
    try {
      await addToCart(user.id, product.id, 1);
      toast('Ajoute nan panye');
      onAddedToCart?.();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Erè, eseye ankò', 'error');
    } finally {
      setAdding(false);
    }
  };

  const handleFavorite = async () => {
    if (!user || !product) return;
    setFavBusy(true);
    try {
      const next = await toggleFavorite(user.id, product.id);
      setFavorited(next);
      toast(next ? 'Ajoute nan favori' : 'Retire nan favori');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Erè favori', 'error');
    } finally {
      setFavBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-emerald-500" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="px-4 py-10 text-center">
        <p className="text-sm text-slate-500">Pwodwi pa disponib.</p>
        <button onClick={onBack} className="mt-4 text-sm text-emerald-600 font-semibold">Retounen</button>
      </div>
    );
  }

  const photos = (product.photos?.length ? product.photos : (product.image_url ? [product.image_url] : []));
  const cover = photos[Math.min(photoIdx, Math.max(photos.length - 1, 0))] ?? null;
  const canAdd = !product.price_on_request && !isAdCategory(product.category) && product.active;

  return (
    <div className="pb-24">
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-slate-100 px-4 py-3 flex items-center gap-3">
        <button onClick={onBack} className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center active:scale-90 transition" aria-label="Retounen">
          <ArrowLeft size={18} />
        </button>
        <h1 className="font-bold text-slate-900 text-sm truncate flex-1">{product.name}</h1>
        {user && (
          <button
            type="button"
            onClick={() => void handleFavorite()}
            disabled={favBusy}
            className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 active:scale-90 transition disabled:opacity-50"
            aria-label={favorited ? 'Retire nan favori' : 'Ajoute nan favori'}
          >
            <Heart size={18} className={favorited ? 'fill-rose-500 text-rose-500' : ''} />
          </button>
        )}
      </div>

      <div className="px-4 pt-4 space-y-4">
        <div className="aspect-square rounded-2xl overflow-hidden bg-slate-100">
          {cover ? (
            <img src={cover} alt={product.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-slate-300">
              <ImageIcon size={36} />
            </div>
          )}
        </div>
        {photos.length > 1 && (
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {photos.map((ph, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setPhotoIdx(i)}
                className={`w-14 h-14 rounded-lg overflow-hidden shrink-0 border-2 ${i === photoIdx ? 'border-emerald-500' : 'border-transparent'}`}
              >
                <img src={ph} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}

        {product.category && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold">
            {CATEGORY_ICON[product.category]} {CATEGORY_LABEL[product.category]}
          </span>
        )}

        <div>
          <h2 className="font-bold text-slate-900 text-lg">{product.name}</h2>
          <p className="text-xl font-bold text-emerald-600 mt-1">
            {product.price_on_request ? 'Pri sou Demand' : formatHTG(product.price)}
          </p>
          {!isAdCategory(product.category) && (
            <p className="text-xs text-slate-500 mt-1">Stok: {product.stock}</p>
          )}
        </div>

        {vendor && (
          <div className="flex items-center gap-2 text-sm text-slate-600 bg-white border border-slate-100 rounded-xl p-3">
            <Store size={16} className="text-emerald-600" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-slate-900 truncate">{vendor.business_name}</p>
              {(vendor.city || vendor.department) && (
                <p className="text-xs text-slate-500">{[vendor.city, vendor.department].filter(Boolean).join(', ')}</p>
              )}
            </div>
          </div>
        )}

        {product.description && (
          <div>
            <p className="text-xs font-semibold text-slate-500 mb-1">Deskripsyon</p>
            <p className="text-sm text-slate-700 whitespace-pre-wrap">{product.description}</p>
          </div>
        )}

        <div className="space-y-2">
          <button
            type="button"
            disabled={!canAdd || adding}
            onClick={handleAdd}
            className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm flex items-center justify-center gap-2 active:scale-95 transition disabled:opacity-50"
          >
            {adding ? <Loader2 size={18} className="animate-spin" /> : <ShoppingCart size={18} />}
            {canAdd ? 'Ajoute nan panye' : 'Pa disponib pou achte'}
          </button>
          {vendor && onMessageVendor && (
            <button
              type="button"
              onClick={() => onMessageVendor(vendor.id, product.id)}
              className="w-full py-3 rounded-xl border border-emerald-200 text-emerald-700 font-semibold text-sm flex items-center justify-center gap-2 active:scale-95 transition"
            >
              <MessageCircle size={18} />
              Kontakte vandè
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
