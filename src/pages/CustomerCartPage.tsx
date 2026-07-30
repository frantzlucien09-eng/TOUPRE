import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/lib/toast';
import {
  fetchCartItems,
  updateCartItemQty,
  removeCartItem,
  type CartItemWithProduct,
} from '@/lib/cart';
import { formatHTG } from '@/lib/format';
import { ArrowLeft, Loader2, Minus, Plus, ShoppingCart, Trash2 } from 'lucide-react';

type Props = {
  onBack: () => void;
  onCheckout: () => void;
};

export function CustomerCartPage({ onBack, onCheckout }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState<CartItemWithProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await fetchCartItems(user.id);
      setItems(data.filter((i) => i.product));
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Erè chaje panye', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const subtotal = useMemo(
    () => items.reduce((s, it) => s + Number(it.product?.price ?? 0) * it.quantity, 0),
    [items]
  );

  const changeQty = async (item: CartItemWithProduct, next: number) => {
    setBusyId(item.id);
    try {
      await updateCartItemQty(item.id, next);
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Erè, eseye ankò', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (itemId: string) => {
    setBusyId(itemId);
    try {
      await removeCartItem(itemId);
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Erè, eseye ankò', 'error');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="pb-28">
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-slate-100 px-4 py-3 flex items-center gap-3">
        <button onClick={onBack} className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center active:scale-90 transition" aria-label="Retounen">
          <ArrowLeft size={18} />
        </button>
        <h1 className="font-bold text-slate-900 text-base flex-1">Panye mwen</h1>
        <ShoppingCart size={18} className="text-emerald-600" />
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-emerald-500" /></div>
      ) : items.length === 0 ? (
        <div className="px-4 py-16 text-center text-sm text-slate-400">
          Panye ou vid. Ajoute pwodwi pou kontinye.
        </div>
      ) : (
        <div className="px-4 pt-4 space-y-3">
          {items.map((it) => {
            const p = it.product!;
            const line = Number(p.price) * it.quantity;
            const busy = busyId === it.id;
            return (
              <div key={it.id} className="bg-white rounded-xl border border-slate-100 p-3 flex gap-3">
                <div className="w-16 h-16 rounded-lg bg-slate-100 overflow-hidden shrink-0">
                  {(p.photos?.[p.cover_index] ?? p.photos?.[0] ?? p.image_url) ? (
                    <img
                      src={p.photos?.[p.cover_index] ?? p.photos?.[0] ?? p.image_url ?? ''}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : null}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">{p.name}</p>
                  <p className="text-sm font-bold text-emerald-600 mt-0.5">{formatHTG(line)}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => changeQty(it, it.quantity - 1)}
                      className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center disabled:opacity-50"
                    >
                      <Minus size={14} />
                    </button>
                    <span className="text-sm font-semibold w-6 text-center">{it.quantity}</span>
                    <button
                      type="button"
                      disabled={busy || (typeof p.stock === 'number' && it.quantity >= p.stock)}
                      onClick={() => changeQty(it, it.quantity + 1)}
                      className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center disabled:opacity-50"
                    >
                      <Plus size={14} />
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => remove(it.id)}
                      className="ml-auto w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center disabled:opacity-50"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          <div className="bg-white rounded-xl border border-slate-100 p-4 flex justify-between items-center">
            <span className="text-sm text-slate-600">Sous-total</span>
            <span className="font-bold text-slate-900">{formatHTG(subtotal)}</span>
          </div>
        </div>
      )}

      {items.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto p-4 bg-white border-t border-slate-100">
          <button
            type="button"
            onClick={onCheckout}
            className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm active:scale-95 transition"
          >
            Kontinye nan kesye
          </button>
        </div>
      )}
    </div>
  );
}
