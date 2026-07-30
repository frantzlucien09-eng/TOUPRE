import { useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/lib/toast';
import { formatHTG } from '@/lib/format';
import { uploadDeliveryProof } from '@/lib/media';
import { orderStatusRpcFailed } from '@/lib/orderRpc';
import type { Order } from '@/lib/types';
import {
  ArrowLeft, MapPin, Phone, MessageCircle, Check, Navigation, Clock, Loader2, Camera, X, Image as ImageIcon,
} from 'lucide-react';

type Props = {
  order: Order;
  onBack: () => void;
  onMessage: (customerId: string) => void;
};

function maskPhone(phone: string): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length <= 4) return phone;
  return digits.slice(0, 4) + ' XXXX ' + digits.slice(-2);
}

function avatarColor(name: string): string {
  const colors = ['bg-rose-500', 'bg-emerald-500', 'bg-blue-500', 'bg-amber-500', 'bg-teal-500', 'bg-pink-500'];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return colors[Math.abs(h) % colors.length];
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] ?? '?') + (parts[1]?.[0] ?? '');
}

export function OrderDeliveringPage({ order, onBack, onMessage }: Props) {
  const { vendor, refreshVendor } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [proofUrl, setProofUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const isPickup = order.delivery_type === 'pickup';

  const shortId = `#TP-${order.id.slice(0, 4).toUpperCase()}`;
  const customerName = order.customer?.full_name ?? 'Kliyan';
  const customerPhone = order.customer?.phone ?? '';

  const dest = [
    order.customer?.address,
    order.customer?.city,
  ].filter(Boolean).join(', ');

  const mapsUrl = dest
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(dest)}`
    : 'https://www.google.com/maps';

  const itemCount = (order.items ?? []).reduce((sum, it) => sum + it.qty, 0);
  const paid = order.payment_status === 'paid';

  const handleProofFile = async (file: File | undefined) => {
    if (!file) return;
    if (!vendor) {
      toast('Sesyon pa egziste', 'error');
      return;
    }
    setUploading(true);
    try {
      const url = await uploadDeliveryProof(file, vendor.id, order.id);
      setProofUrl(url);
      toast('Foto prèv anrejistre');
    } catch (e) {
      console.error('[proof] upload error:', e);
      toast(e instanceof Error ? e.message : 'Erè, eseye ankò', 'error');
    } finally {
      setUploading(false);
    }
  };

  const markDelivered = async () => {
    if (!isPickup && !proofUrl) {
      toast('Ou dwe pran yon foto kòm prèv anvan w ka make kòmand lan livre.', 'error');
      return;
    }
    setLoading(true);
    const newStatus = isPickup ? 'picked_up' : 'delivered';
    const { data, error } = await supabase.rpc('update_order_status', {
      p_order_id: order.id,
      p_new_status: newStatus,
      p_delivery_proof_url: proofUrl,
    });
    setLoading(false);
    const fail = orderStatusRpcFailed(error, data);
    if (fail) {
      toast(fail, 'error');
      return;
    }
    await refreshVendor();
    toast(isPickup ? 'Kòmand retire' : 'Kòmand livre');
    onBack();
  };

  // Pickup variant — simple "Pare pou Retire" (photo optional)
  if (isPickup) {
    return (
      <div className="min-h-screen bg-slate-50 pb-24">
        <div className="sticky top-0 z-10 bg-white border-b border-slate-100">
          <div className="flex items-center gap-3 px-4 py-3">
            <button onClick={onBack} className="p-1 -ml-1 active:scale-90 transition">
              <ArrowLeft size={22} className="text-slate-700" />
            </button>
            <h1 className="font-bold text-slate-900 text-base">Pare pou Retire</h1>
          </div>
        </div>

        <div className="px-4 pt-4 space-y-4">
          {/* Contact card */}
          <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0 ${avatarColor(customerName)}`}>
                {initials(customerName)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-900 text-sm">{customerName}</p>
                {customerPhone && (
                  <p className="text-xs text-slate-500">{maskPhone(customerPhone)}</p>
                )}
              </div>
              <div className="flex gap-2">
                <a
                  href={`tel:${customerPhone}`}
                  className="w-9 h-9 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center active:scale-90 transition"
                >
                  <Phone size={16} />
                </a>
                <button
                  onClick={() => order.customer_id && onMessage(order.customer_id)}
                  className="w-9 h-9 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center active:scale-90 transition"
                >
                  <MessageCircle size={16} />
                </button>
              </div>
            </div>
          </div>

          {/* Order summary */}
          <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Nimewo kòmand</span>
              <span className="font-semibold text-slate-900">{shortId}</span>
            </div>
            <div className="flex justify-between text-sm mt-2">
              <span className="text-slate-500">Kantite atik</span>
              <span className="font-semibold text-slate-900">{itemCount}</span>
            </div>
            <div className="flex justify-between text-sm mt-2">
              <span className="text-slate-500">Total</span>
              <span className="font-semibold text-slate-900">{formatHTG(order.total)}</span>
            </div>
            <div className="flex justify-between text-sm mt-2">
              <span className="text-slate-500">Peman</span>
              <span className={`font-semibold ${paid ? 'text-emerald-600' : 'text-amber-600'}`}>
                {paid ? 'MonCash ✓ Deja Peye' : 'An Atant Peman'}
              </span>
            </div>
          </div>

          {/* Optional proof photo */}
          <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
            <p className="text-xs font-semibold text-slate-500 mb-2">Foto Prèv (Opsyonèl)</p>
            {proofUrl ? (
              <div className="relative">
                <img src={proofUrl} alt="Prèv" className="w-full rounded-xl max-h-48 object-cover" />
                <button
                  onClick={() => setProofUrl(null)}
                  className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 text-white flex items-center justify-center active:scale-90 transition"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => cameraInputRef.current?.click()}
                disabled={uploading}
                className="w-full py-6 rounded-xl border-2 border-dashed border-slate-200 text-slate-400 flex flex-col items-center gap-2 active:scale-95 transition disabled:opacity-60"
              >
                {uploading ? <Loader2 size={20} className="animate-spin" /> : <Camera size={20} />}
                <span className="text-xs">{uploading ? 'Ap telechaje...' : 'Pran yon foto (opsyonèl)'}</span>
              </button>
            )}
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              className="absolute"
              style={{ position: 'absolute', width: '1px', height: '1px', opacity: 0, overflow: 'hidden' }}
              onChange={(e) => { handleProofFile(e.target.files?.[0]); e.target.value = ''; }}
            />
          </div>
        </div>

        <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md px-4 py-3 bg-white border-t border-slate-100 z-10">
          <button
            onClick={markDelivered}
            disabled={loading || uploading}
            className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm flex items-center justify-center gap-2 active:scale-95 transition disabled:opacity-60"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />} Make kòm Kliyan Retire l
          </button>
        </div>
      </div>
    );
  }

  // Delivery variant — full map + contact + details + MANDATORY proof photo
  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <div className="sticky top-0 z-10 bg-white border-b border-slate-100">
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={onBack} className="p-1 -ml-1 active:scale-90 transition">
            <ArrowLeft size={22} className="text-slate-700" />
          </button>
          <h1 className="font-bold text-slate-900 text-base">Ap Livre Kòmand</h1>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4">
        {/* Mini map */}
        <div className="relative rounded-2xl overflow-hidden border border-slate-100 shadow-sm bg-slate-100 h-44">
          <iframe
            title="kat-livrezon"
            className="w-full h-full"
            src={`https://maps.google.com/maps?q=${encodeURIComponent(dest || 'Haiti')}&z=15&output=embed`}
          />
          <div className="absolute top-2 left-2 bg-white/95 backdrop-blur rounded-lg px-2.5 py-1 shadow-sm">
            <span className="text-[11px] font-semibold text-slate-700">2.4 km</span>
          </div>
          <div className="absolute bottom-2 right-2 bg-white/95 backdrop-blur rounded-lg px-2.5 py-1 shadow-sm flex items-center gap-1">
            <Clock size={12} className="text-slate-500" />
            <span className="text-[11px] font-semibold text-slate-700">~8 min</span>
          </div>
        </div>

        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm active:scale-95 transition"
        >
          <Navigation size={16} /> Ouvri nan Google Maps
        </a>

        {/* Contact card */}
        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0 ${avatarColor(customerName)}`}>
              {initials(customerName)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-slate-900 text-sm">{customerName}</p>
              {customerPhone && (
                <p className="text-xs text-slate-500">{maskPhone(customerPhone)}</p>
              )}
            </div>
            <div className="flex gap-2">
              <a
                href={`tel:${customerPhone}`}
                className="w-9 h-9 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center active:scale-90 transition"
              >
                <Phone size={16} />
              </a>
              <button
                onClick={() => order.customer_id && onMessage(order.customer_id)}
                className="w-9 h-9 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center active:scale-90 transition"
              >
                <MessageCircle size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Finding details */}
        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 mb-2 flex items-center gap-1.5">
            <MapPin size={14} className="text-slate-400" /> Detay pou jwenn li
          </p>
          {order.customer?.address && (
            <p className="text-sm text-slate-700 mb-2">
              {order.customer.address}{order.customer.city ? `, ${order.customer.city}` : ''}
            </p>
          )}
          {order.delivery_note ? (
            <div className="bg-slate-50 rounded-xl p-3 mt-2">
              <p className="text-sm text-slate-700">{order.delivery_note}</p>
            </div>
          ) : (
            <p className="text-xs text-slate-400">Pa gen deskripsyon adisyonèl.</p>
          )}
        </div>

        {/* Order summary */}
        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Nimewo kòmand</span>
            <span className="font-semibold text-slate-900">{shortId}</span>
          </div>
          <div className="flex justify-between text-sm mt-2">
            <span className="text-slate-500">Kantite atik</span>
            <span className="font-semibold text-slate-900">{itemCount}</span>
          </div>
          <div className="flex justify-between text-sm mt-2">
            <span className="text-slate-500">Total</span>
            <span className="font-semibold text-slate-900">{formatHTG(order.total)}</span>
          </div>
          <div className="flex justify-between text-sm mt-2">
            <span className="text-slate-500">Peman</span>
            <span className={`font-semibold ${paid ? 'text-emerald-600' : 'text-amber-600'}`}>
              {paid ? 'MonCash ✓ Deja Peye' : 'An Atant Peman'}
            </span>
          </div>
        </div>

        {/* MANDATORY delivery proof photo */}
        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 mb-2 flex items-center gap-1.5">
            <Camera size={14} className="text-slate-400" /> Prèv Livrezon (Obligatwa)
          </p>
          {proofUrl ? (
            <div className="relative">
              <img src={proofUrl} alt="Prèv livrezon" className="w-full rounded-xl max-h-56 object-cover" />
              <button
                onClick={() => setProofUrl(null)}
                className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 text-white flex items-center justify-center active:scale-90 transition"
              >
                <X size={14} />
              </button>
              <p className="text-[11px] text-emerald-600 mt-2 flex items-center gap-1">
                <Check size={12} /> Foto prèv anrejistre. Ou ka konfime livrezon.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <button
                onClick={() => cameraInputRef.current?.click()}
                disabled={uploading}
                className="w-full py-8 rounded-xl border-2 border-dashed border-slate-200 text-slate-400 flex flex-col items-center gap-2 active:scale-95 transition disabled:opacity-60"
              >
                {uploading ? <Loader2 size={24} className="animate-spin" /> : <Camera size={24} />}
                <span className="text-xs font-medium">{uploading ? 'Ap telechaje...' : 'Pran Foto Prèv Livrezon'}</span>
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="w-full py-2.5 rounded-xl bg-slate-50 text-slate-600 font-medium text-xs flex items-center justify-center gap-2 active:scale-95 transition disabled:opacity-60"
              >
                <ImageIcon size={14} /> Oswa chwazi nan galeri
              </button>
              <p className="text-[11px] text-amber-600 text-center">
                Ou dwe pran yon foto kòm prèv anvan w ka make kòmand lan livre.
              </p>
            </div>
          )}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            className="absolute"
            style={{ position: 'absolute', width: '1px', height: '1px', opacity: 0, overflow: 'hidden' }}
            onChange={(e) => { handleProofFile(e.target.files?.[0]); e.target.value = ''; }}
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="absolute"
            style={{ position: 'absolute', width: '1px', height: '1px', opacity: 0, overflow: 'hidden' }}
            onChange={(e) => { handleProofFile(e.target.files?.[0]); e.target.value = ''; }}
          />
        </div>
      </div>

      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md px-4 py-3 bg-white border-t border-slate-100 z-10">
        <button
          onClick={markDelivered}
          disabled={loading || uploading}
          className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm flex items-center justify-center gap-2 active:scale-95 transition disabled:opacity-60"
        >
          {loading ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />} Mwen Rive — Make kòm Livre
        </button>
      </div>
    </div>
  );
}
