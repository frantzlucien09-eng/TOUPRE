import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/lib/toast';
import { clearCart, fetchCartItems, groupCartByVendor, type CartItemWithProduct } from '@/lib/cart';
import { placeOrder } from '@/lib/placeOrder';
import { formatHTG } from '@/lib/format';
import { ArrowLeft, Loader2, MapPin, Truck } from 'lucide-react';

type Props = {
  onBack: () => void;
  onSuccess: () => void;
};

export function CustomerCheckoutPage({ onBack, onSuccess }: Props) {
  const { user, customer } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState<CartItemWithProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deliveryType, setDeliveryType] = useState<'delivery' | 'pickup'>('delivery');
  const [phone, setPhone] = useState(customer?.phone ?? '');
  const [address, setAddress] = useState(customer?.address ?? '');
  const [city, setCity] = useState(customer?.city ?? '');
  const [department, setDepartment] = useState(customer?.department ?? '');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!user) return;
    fetchCartItems(user.id)
      .then((data) => setItems(data.filter((i) => i.product && !i.product.price_on_request)))
      .catch((err) => toast(err instanceof Error ? err.message : 'Erè', 'error'))
      .finally(() => setLoading(false));
  }, [user, toast]);

  const subtotal = useMemo(
    () => items.reduce((s, it) => s + Number(it.product?.price ?? 0) * it.quantity, 0),
    [items]
  );

  const submit = async () => {
    if (!user) return;
    if (items.length === 0) {
      toast('Panye ou vid', 'error');
      return;
    }
    if (deliveryType === 'delivery' && !address.trim()) {
      toast('Antre adrès livrezon ou', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const groups = groupCartByVendor(items);
      const results: string[] = [];

      for (const [vendorId, vendorItems] of groups) {
        const orderItems = vendorItems.map((it) => {
          const unit = Number(it.product!.price);
          return {
            product_id: it.product_id,
            product_name: it.product!.name,
            quantity: it.quantity,
            unit_price: unit,
            subtotal: unit * it.quantity,
          };
        });
        const vendorSubtotal = orderItems.reduce((s, i) => s + i.subtotal, 0);
        const result = await placeOrder({
          customerId: user.id,
          vendorId,
          items: orderItems,
          subtotal: vendorSubtotal,
          shippingCost: 0,
          total: vendorSubtotal,
          deliveryType,
          shippingAddress: {
            phone: phone.trim() || null,
            address: address.trim() || null,
            city: city.trim() || null,
            department: department.trim() || null,
            full_name: customer?.full_name ?? null,
          },
          notes: notes.trim() || null,
          paymentStatus: 'unpaid',
        });
        if (!result.success) {
          throw new Error(result.error || 'Erè pase kòmand');
        }
        if (result.order_number) results.push(result.order_number);
      }

      await clearCart(user.id);
      toast(
        results.length
          ? `Kòmand pase: ${results.join(', ')}. Peman: an atant (MonCash pita).`
          : 'Kòmand pase ak siksè.',
        'success'
      );
      onSuccess();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Erè, eseye ankò', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="pb-28">
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-slate-100 px-4 py-3 flex items-center gap-3">
        <button onClick={onBack} className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center active:scale-90 transition" aria-label="Retounen">
          <ArrowLeft size={18} />
        </button>
        <h1 className="font-bold text-slate-900 text-base">Kesye</h1>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-emerald-500" /></div>
      ) : (
        <div className="px-4 pt-4 space-y-4">
          <div className="bg-white rounded-xl border border-slate-100 p-4 space-y-3">
            <p className="text-xs font-semibold text-slate-500">Tip livrezon</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setDeliveryType('delivery')}
                className={`py-2.5 rounded-xl text-sm font-semibold border flex items-center justify-center gap-1.5 ${deliveryType === 'delivery' ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'border-slate-200 text-slate-600'}`}
              >
                <Truck size={16} /> Livrezon
              </button>
              <button
                type="button"
                onClick={() => setDeliveryType('pickup')}
                className={`py-2.5 rounded-xl text-sm font-semibold border flex items-center justify-center gap-1.5 ${deliveryType === 'pickup' ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'border-slate-200 text-slate-600'}`}
              >
                <MapPin size={16} /> Pickup
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-100 p-4 space-y-3">
            <p className="text-xs font-semibold text-slate-500">Adrès / Kontak</p>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Telefòn"
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            {deliveryType === 'delivery' && (
              <>
                <input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Adrès livrezon"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Vil"
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <input
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="Depatman"
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </>
            )}
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Nòt (opsyonèl)"
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
            />
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
            Peman MonCash ap vini nan yon lòt etap. Kòmand yo ap anrejistre ak estati <b>pa peye</b> pou kounye a.
          </div>

          <div className="bg-white rounded-xl border border-slate-100 p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Atik</span>
              <span className="font-semibold">{items.reduce((s, i) => s + i.quantity, 0)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Total</span>
              <span className="font-bold text-emerald-600">{formatHTG(subtotal)}</span>
            </div>
            <div className="flex justify-between text-xs text-slate-400">
              <span>Vandè</span>
              <span>{groupCartByVendor(items).size}</span>
            </div>
          </div>
        </div>
      )}

      {!loading && items.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto p-4 bg-white border-t border-slate-100">
          <button
            type="button"
            disabled={submitting}
            onClick={submit}
            className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm flex items-center justify-center gap-2 active:scale-95 transition disabled:opacity-60"
          >
            {submitting ? <Loader2 size={18} className="animate-spin" /> : null}
            Konfime kòmand ({formatHTG(subtotal)})
          </button>
        </div>
      )}
    </div>
  );
}
