import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/lib/toast';
import {
  listingFeeForCategory,
  loadListingFeeSettings,
  type ListingFeeSettings,
} from '@/lib/listingSettings';
import { initiatePaymentWithProvider, isMonCashLiveEnabled } from '@/lib/payments';
import { formatHTG } from '@/lib/format';
import { Modal } from './Modal';
import { AlertTriangle, Loader2, ShieldCheck, Smartphone } from 'lucide-react';

type Props = {
  open: boolean;
  onClose: () => void;
  productId: string;
  category: 'kay' | 'machin';
  onPaid: () => void;
};

export function AdPaymentModal({ open, onClose, productId, category, onPaid }: Props) {
  const { vendor } = useAuth();
  const { toast } = useToast();
  const [phone, setPhone] = useState(vendor?.moncash_phone ?? '');
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState<ListingFeeSettings | null>(null);
  const moncashLive = isMonCashLiveEnabled();

  useEffect(() => {
    if (!open) return;
    void loadListingFeeSettings().then(setSettings);
  }, [open]);

  const fee = settings ? listingFeeForCategory(settings, category) : 2500;
  const durationDays = settings?.listingDurationDays ?? 30;

  const pay = async () => {
    if (!phone.trim()) {
      toast('Tanpri antre nimewo MonCash ou', 'error');
      return;
    }
    if (!vendor) return;
    setLoading(true);
    try {
      const { data: adPay, error: payError } = await supabase
        .from('ad_payments')
        .insert({
          vendor_id: vendor.id,
          product_id: productId,
          amount: fee,
          category,
          status: 'pending',
          moncash_phone: phone.trim(),
          paid_at: null,
          waived: false,
        })
        .select('id')
        .single();
      if (payError) throw payError;

      const { error: prodError } = await supabase
        .from('products')
        .update({
          ad_status: 'draft',
          active: false,
          status: 'draft',
          updated_at: new Date().toISOString(),
        })
        .eq('id', productId);
      if (prodError) throw prodError;

      await supabase
        .from('vendors')
        .update({
          moncash_phone: phone.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', vendor.id);

      if (moncashLive && adPay?.id) {
        const origin = typeof window !== 'undefined' ? window.location.origin : '';
        const result = await initiatePaymentWithProvider({
          amount: fee,
          provider: 'moncash',
          purpose: 'ad_fee',
          adPaymentId: adPay.id,
          vendorId: vendor.id,
          metadata: { product_id: productId, category, moncash_phone: phone.trim() },
          returnUrl: `${origin}/#/payment/return`,
          cancelUrl: `${origin}/#/`,
        });
        if (!result.success) {
          throw new Error(result.error || 'MonCash initiate echwe');
        }
        if (result.checkoutUrl) {
          toast('Ap mennen ou nan MonCash…');
          window.location.href = result.checkoutUrl;
          return;
        }
      }

      toast(
        moncashLive
          ? 'Demann MonCash kreye. Si w pa redirekte, verifye nan admin.'
          : 'Demann peman anrejistre. Anons la rete an atant jiskaske admin verifye frè a.'
      );
      onPaid();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Erè, eseye ankò', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Peye Frè Anons">
      <div className="space-y-4">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex gap-2.5">
          <AlertTriangle size={20} className="text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800 leading-relaxed">
            Pou pibliye yon anons {category === 'kay' ? 'Kay' : 'Machin'}, frè a se{' '}
            <b>{formatHTG(fee)}</b> via MonCash. Sa a se yon frè anons sèlman — <b>PA</b> yon vant
            sou TOUPRE. Achte/lwe fèt dirèkteman ak kliyan (Contact Seller).
            {moncashLive
              ? ' W ap redirekte nan MonCash pou peye.'
              : ' MonCash live poko aktive — demann lan ap verifye maniyèlman pa admin.'}
          </p>
        </div>

        <div className="bg-slate-50 rounded-xl p-3 space-y-1.5 text-sm">
          <Row label="Frè piblisite" value={formatHTG(fee)} />
          <Row label="Dire anons" value={`${durationDays} jou`} />
          <Row label="Metòd peman" value={moncashLive ? 'MonCash (live/sandbox)' : 'MonCash (verifye maniyèl)'} />
          <Row label="Apre soumisyon" value={moncashLive ? 'Peye → Pending Review' : 'An Atant Revizyon'} />
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-600">Nimewo MonCash pou peman an</label>
          <div className="relative mt-1">
            <Smartphone size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+509 3700 0000"
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        <div className="flex items-start gap-2 text-[11px] text-slate-500">
          <ShieldCheck size={14} className="text-emerald-600 mt-0.5 shrink-0" />
          <p>
            Apre verifikasyon + apwobasyon, anons ou ap parèt piblikman pou {durationDays} jou.
            Anons ekspire pa efase — ou ka renouvle yo pita.
          </p>
        </div>

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-700 font-semibold text-sm hover:bg-slate-50 active:scale-95 transition">
            Anile
          </button>
          <button
            onClick={() => void pay()}
            disabled={loading || !settings}
            className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm flex items-center justify-center gap-2 active:scale-95 transition disabled:opacity-60"
          >
            {loading || !settings ? <Loader2 size={18} className="animate-spin" /> : null}
            {moncashLive ? `Peye ${formatHTG(fee)}` : `Voye demann ${formatHTG(fee)}`}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-slate-500">{label}</span>
      <span className="font-semibold text-slate-900">{value}</span>
    </div>
  );
}
