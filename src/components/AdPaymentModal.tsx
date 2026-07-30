import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/lib/toast';
import { AD_FEE, AD_DURATION_DAYS } from '@/lib/categories';
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

  const pay = async () => {
    if (!phone.trim()) {
      toast('Tanpri antre nimewo MonCash ou', 'error');
      return;
    }
    setLoading(true);
    try {
      const now = new Date();
      const expires = new Date(now.getTime() + AD_DURATION_DAYS * 24 * 60 * 60 * 1000);

      // Payment row is pending until MonCash/admin verification. Listing still
      // activates so Kay/Machin ads remain usable without a separate approve UI.
      const { error: payError } = await supabase.from('ad_payments').insert({
        vendor_id: vendor!.id,
        product_id: productId,
        amount: AD_FEE,
        category,
        status: 'pending',
        moncash_phone: phone,
        paid_at: null,
      });
      if (payError) throw payError;

      const { error: prodError } = await supabase.from('products').update({
        ad_status: 'active',
        ad_paid_at: now.toISOString(),
        ad_expires_at: expires.toISOString(),
        active: true,
        updated_at: now.toISOString(),
      }).eq('id', productId);
      if (prodError) throw prodError;

      await supabase.from('vendors').update({
        moncash_phone: phone,
        updated_at: now.toISOString(),
      }).eq('id', vendor!.id);

      toast('Anons pibliye. Demann peman MonCash anrejistre pou verifikasyon.');
      onPaid();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Erè, eseye ankò', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Pibliye Anons">
      <div className="space-y-4">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex gap-2.5">
          <AlertTriangle size={20} className="text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800 leading-relaxed">
            Pou pibliye yon anons {category === 'kay' ? 'Kay' : 'Machin'}, w ap peye{' '}
            <b>{formatHTG(AD_FEE)}</b> pa MonCash. Sa a se yon frè pou fè pwomosyon anons ou a —
            se <b>PA</b> yon vant, ou ap toujou responsab konplete tranzaksyon an dirèkteman ak kliyan ki enterese a.
          </p>
        </div>

        <div className="bg-slate-50 rounded-xl p-3 space-y-1.5 text-sm">
          <Row label="Frè piblisite" value={formatHTG(AD_FEE)} />
          <Row label="Dire anons" value={`${AD_DURATION_DAYS} jou`} />
          <Row label="Metòd peman" value="MonCash" />
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
          <p>Anons ou ap parèt piblikman pou {AD_DURATION_DAYS} jou. Peman MonCash rete an atant verifikasyon.</p>
        </div>

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-700 font-semibold text-sm hover:bg-slate-50 active:scale-95 transition">
            Anile
          </button>
          <button
            onClick={pay}
            disabled={loading}
            className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm flex items-center justify-center gap-2 active:scale-95 transition disabled:opacity-60"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : null}
            Voye peman {formatHTG(AD_FEE)}
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
