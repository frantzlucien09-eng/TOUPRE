import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/lib/toast';
import { formatHTG, formatDateTime, formatDate } from '@/lib/format';
import type { Withdrawal } from '@/lib/types';
import { Header } from '@/components/Header';
import { Modal } from '@/components/Modal';
import { EmptyState } from '@/components/EmptyState';
import {
  Wallet, Phone, User, Loader2, Save, Pencil, ArrowDownToLine, Clock, CheckCircle2, XCircle,
} from 'lucide-react';

const LOCKED_STATUSES = new Set(['pending', 'approved', 'processing']);

export function WithdrawPage({ onBack }: { onBack: () => void }) {
  const { vendor, refreshVendor } = useAuth();
  const { toast } = useToast();
  const [moncashPhone, setMoncashPhone] = useState(vendor?.moncash_phone ?? '');
  const [moncashName, setMoncashName] = useState(vendor?.moncash_name ?? '');
  const [editingMoncash, setEditingMoncash] = useState(!vendor?.moncash_phone);
  const [savingMoncash, setSavingMoncash] = useState(false);
  const [amount, setAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [detail, setDetail] = useState<Withdrawal | null>(null);

  const load = async () => {
    if (!vendor) return;
    const { data } = await supabase
      .from('withdrawals')
      .select('*')
      .eq('vendor_id', vendor.id)
      .order('requested_at', { ascending: false });
    setWithdrawals((data ?? []) as Withdrawal[]);
  };

  useEffect(() => {
    load();
  }, [vendor]);

  const pendingLocked = useMemo(
    () => withdrawals
      .filter((w) => LOCKED_STATUSES.has(w.status))
      .reduce((s, w) => s + Number(w.amount), 0),
    [withdrawals]
  );

  const availableBalance = Math.max(0, Number(vendor?.balance ?? 0) - pendingLocked);

  if (!vendor) return null;

  const saveMoncash = async () => {
    if (!moncashPhone.trim() || !moncashName.trim()) {
      toast('Tanpri antre nimewo ak non', 'error');
      return;
    }
    setSavingMoncash(true);
    const { error } = await supabase.from('vendors').update({
      moncash_phone: moncashPhone,
      moncash_name: moncashName,
      updated_at: new Date().toISOString(),
    }).eq('id', vendor.id);
    setSavingMoncash(false);
    if (error) {
      toast('Erè, eseye ankò', 'error');
    } else {
      refreshVendor();
      setEditingMoncash(false);
      toast('Enfòmasyon MonCash anrejistre');
    }
  };

  const submitWithdraw = async () => {
    if (!vendor.moncash_phone || !vendor.moncash_name) {
      toast('Anrejistre enfòmasyon MonCash ou anvan', 'error');
      setEditingMoncash(true);
      return;
    }
    const amt = Number(amount);
    if (!amt || amt <= 0) {
      toast('Tanpri antre yon kantite', 'error');
      return;
    }
    if (amt > availableBalance) {
      toast('Kantite a depase balans disponib ou', 'error');
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from('withdrawals').insert({
      vendor_id: vendor.id,
      amount: amt,
      status: 'pending',
    });
    if (error) {
      toast(error.message || 'Erè, eseye ankò', 'error');
      setSubmitting(false);
      return;
    }
    setAmount('');
    setSubmitting(false);
    toast('Demann retire voye. Tann apwobasyon Admin.');
    load();
  };

  const maskedPhone = vendor.moncash_phone
    ? vendor.moncash_phone.replace(/(\d{4})\d{4}(\d{2})/, '$1••••$2')
    : '';

  return (
    <div className="pb-24">
      <Header title="Retire Lajan" subtitle="Via MonCash" />

      <div className="px-4 pt-4 space-y-4">
        <div className="bg-gradient-to-br from-emerald-600 to-emerald-700 rounded-2xl p-5 text-white shadow-sm">
          <div className="flex items-center gap-2 text-emerald-50 text-xs">
            <Wallet size={16} /> Balans disponib
          </div>
          <p className="text-3xl font-bold mt-1">{formatHTG(availableBalance)}</p>
          {pendingLocked > 0 && (
            <p className="text-[11px] text-emerald-100 mt-2">
              Total: {formatHTG(vendor.balance)} · An atant: {formatHTG(pendingLocked)}
            </p>
          )}
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
          <h3 className="font-bold text-slate-900 text-sm mb-3">Enfòmasyon MonCash</h3>
          {editingMoncash ? (
            <div className="space-y-3">
              <div className="relative">
                <Phone size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="tel"
                  value={moncashPhone}
                  onChange={(e) => setMoncashPhone(e.target.value)}
                  placeholder="Nimewo MonCash (egz: +509 3700 0000)"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div className="relative">
                <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={moncashName}
                  onChange={(e) => setMoncashName(e.target.value)}
                  placeholder="Non konplè sou kont MonCash"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <button
                onClick={saveMoncash}
                disabled={savingMoncash}
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm flex items-center justify-center gap-2 active:scale-95 transition disabled:opacity-60"
              >
                {savingMoncash ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                Anrejistre enfòmasyon MonCash
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900">{vendor.moncash_name ?? '—'}</p>
                <p className="text-xs text-slate-500 mt-0.5">{maskedPhone}</p>
              </div>
              <button
                onClick={() => setEditingMoncash(true)}
                className="px-3 py-2 rounded-lg border border-slate-200 text-slate-700 font-semibold text-xs flex items-center gap-1.5 hover:bg-slate-50 active:scale-95 transition"
              >
                <Pencil size={13} /> Modifye
              </button>
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
          <h3 className="font-bold text-slate-900 text-sm mb-3">Fè demann retire</h3>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Kantite (Goud)"
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <button
              onClick={submitWithdraw}
              disabled={submitting}
              className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm flex items-center gap-2 active:scale-95 transition disabled:opacity-60"
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <ArrowDownToLine size={16} />}
              Voye
            </button>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">Maksimòm: {formatHTG(availableBalance)}</p>
        </div>

        <div>
          <h3 className="font-bold text-slate-900 text-sm mb-2">Istorik retire</h3>
          {withdrawals.length === 0 ? (
            <EmptyState icon={<Clock size={22} />} title="Pa gen demann toujou" />
          ) : (
            <div className="space-y-2">
              {withdrawals.map((w) => (
                <button
                  key={w.id}
                  onClick={() => setDetail(w)}
                  className="w-full flex items-center gap-3 bg-white rounded-xl p-3 border border-slate-100 shadow-sm active:scale-95 transition text-left"
                >
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                    w.status === 'completed' || w.status === 'paid' ? 'bg-emerald-50 text-emerald-600'
                    : w.status === 'rejected' ? 'bg-red-50 text-red-600'
                    : 'bg-amber-50 text-amber-600'
                  }`}>
                    {w.status === 'completed' || w.status === 'paid' ? <CheckCircle2 size={18} />
                      : w.status === 'rejected' ? <XCircle size={18} />
                      : <Clock size={18} />}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-slate-900 text-sm">{formatHTG(w.amount)}</p>
                    <p className="text-[11px] text-slate-500">{formatDate(w.requested_at)}</p>
                  </div>
                  <WithdrawStatusPill status={w.status} />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <Modal open={!!detail} onClose={() => setDetail(null)} title="Detay Demann">
        {detail && (
          <div className="space-y-3 text-sm">
            <Row label="Kantite" value={formatHTG(detail.amount)} />
            <Row label="Dat demann" value={formatDateTime(detail.requested_at)} />
            <Row label="Estati" value={<WithdrawStatusPill status={detail.status} />} />
            {detail.processed_at && <Row label="Dat trètman" value={formatDateTime(detail.processed_at)} />}
            {detail.received_at && <Row label="Dat resepsyon" value={formatDateTime(detail.received_at)} />}
            {detail.note && <Row label="Nòt" value={detail.note} />}
          </div>
        )}
      </Modal>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-slate-100">
      <span className="text-slate-500">{label}</span>
      <span className="font-semibold text-slate-900">{value}</span>
    </div>
  );
}

export function WithdrawStatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    pending: { label: 'An atant', cls: 'bg-amber-100 text-amber-700' },
    approved: { label: 'Aksepte', cls: 'bg-blue-100 text-blue-700' },
    processing: { label: 'An kou', cls: 'bg-indigo-100 text-indigo-700' },
    paid: { label: 'Peye', cls: 'bg-emerald-100 text-emerald-700' },
    completed: { label: 'Fini/Voye', cls: 'bg-emerald-100 text-emerald-700' },
    rejected: { label: 'Rejte', cls: 'bg-red-100 text-red-700' },
  };
  const s = map[status] ?? { label: status, cls: 'bg-slate-100 text-slate-600' };
  return <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${s.cls}`}>{s.label}</span>;
}
