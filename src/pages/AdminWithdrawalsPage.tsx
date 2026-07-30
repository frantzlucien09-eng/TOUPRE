import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/lib/toast';
import { useConfirm } from '@/lib/confirm';
import { formatHTG, formatDateTime, relativeTime } from '@/lib/format';
import { WITHDRAWAL_STATUS_LABELS, WITHDRAWAL_STATUS_STYLES } from '@/lib/withdrawalStatus';
import type { Vendor, Withdrawal } from '@/lib/types';
import {
  Search, Loader2, Wallet, ChevronRight, X, CheckCircle2, XCircle,
  Phone, User, Ban, ArrowRight,
} from 'lucide-react';

type WithdrawalWithVendor = Withdrawal & {
  vendor?: Pick<Vendor, 'id' | 'business_name' | 'phone' | 'email' | 'moncash_phone' | 'moncash_name' | 'balance' | 'department' | 'city'> | null;
};

type StatusFilter = 'all' | 'pending' | 'approved' | 'processing' | 'completed' | 'paid' | 'rejected';

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'Tout' },
  { key: 'pending', label: 'An Atant' },
  { key: 'approved', label: 'Apwouve' },
  { key: 'processing', label: 'Ap Trete' },
  { key: 'paid', label: 'Peye' },
  { key: 'completed', label: 'Konplete' },
  { key: 'rejected', label: 'Rejte' },
];

const STATUS_STYLES = WITHDRAWAL_STATUS_STYLES;
const STATUS_LABELS = WITHDRAWAL_STATUS_LABELS;

const NEXT_STATUS: Record<string, string | null> = {
  pending: 'approved',
  approved: 'processing',
  processing: 'paid',
  paid: null,
  completed: null,
  rejected: null,
};

const NEXT_LABEL: Record<string, string> = {
  pending: 'Apwouve',
  approved: 'Kòmanse Trete',
  processing: 'Make kòm Peye',
};

export function AdminWithdrawalsPage() {
  const { toast } = useToast();
  const { confirm } = useConfirm();
  const [items, setItems] = useState<WithdrawalWithVendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>('pending');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<WithdrawalWithVendor | null>(null);
  const [note, setNote] = useState('');
  const [acting, setActing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('withdrawals')
      .select(`
        *,
        vendor:vendors(id, business_name, phone, email, moncash_phone, moncash_name, balance, department, city)
      `)
      .order('requested_at', { ascending: false });

    if (filter !== 'all') {
      query = query.eq('status', filter);
    }

    const { data, error } = await query.limit(200);
    if (error) {
      toast('Erè lè w ap chaje demann yo', 'error');
      setLoading(false);
      return;
    }

    let list = (data ?? []) as unknown as WithdrawalWithVendor[];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((w) =>
        w.id.toLowerCase().includes(q) ||
        (w.vendor?.business_name ?? '').toLowerCase().includes(q) ||
        (w.vendor?.moncash_phone ?? '').toLowerCase().includes(q) ||
        (w.vendor?.phone ?? '').toLowerCase().includes(q)
      );
    }
    setItems(list);
    setLoading(false);
  }, [filter, search, toast]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const channel = supabase
      .channel('admin-withdrawals')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'withdrawals' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load]);

  const summary = useMemo(() => {
    const pending = items.filter((w) => w.status === 'pending');
    const pendingAmt = pending.reduce((s, w) => s + Number(w.amount), 0);
    const paid = items.filter((w) => w.status === 'paid' || w.status === 'completed');
    const paidAmt = paid.reduce((s, w) => s + Number(w.amount), 0);
    return { pendingCount: pending.length, pendingAmt, paidCount: paid.length, paidAmt };
  }, [items]);

  const updateStatus = async (w: WithdrawalWithVendor, newStatus: string, rejectionNote?: string) => {
    const ok = await confirm({
      title: 'Konfime Aksyon',
      message: `Ou vle chanje estati demann sa a a « ${STATUS_LABELS[newStatus] ?? newStatus} »?`,
      confirmText: 'Wi, kontinye',
      danger: newStatus === 'rejected',
    });
    if (!ok) return;

    setActing(true);
    const payload: Record<string, unknown> = {
      status: newStatus,
      processed_at: new Date().toISOString(),
    };
    if (rejectionNote?.trim() || note.trim()) {
      payload.note = (rejectionNote ?? note).trim();
    }
    if (newStatus === 'paid' || newStatus === 'completed') {
      payload.received_at = new Date().toISOString();
    }

    const { error } = await supabase.from('withdrawals').update(payload).eq('id', w.id);
    setActing(false);
    if (error) {
      toast(error.message || 'Erè, eseye ankò', 'error');
      return;
    }
    toast(`Estati mete ajou: ${STATUS_LABELS[newStatus] ?? newStatus}`);
    setSelected(null);
    setNote('');
    load();
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2.5 lg:gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-3">
          <p className="text-[11px] text-slate-500 mb-1">An Atant</p>
          <p className="text-lg font-bold text-amber-600">{summary.pendingCount} · {formatHTG(summary.pendingAmt)}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-3">
          <p className="text-[11px] text-slate-500 mb-1">Peye / Konplete</p>
          <p className="text-lg font-bold text-emerald-600">{summary.paidCount} · {formatHTG(summary.paidAmt)}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition ${
              filter === f.key ? 'bg-emerald-500 text-black' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Chache pa vandè, MonCash, oswa ID..."
          className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 bg-white text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-slate-400" /></div>
      ) : items.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
          <Wallet size={28} className="mx-auto text-slate-300 mb-2" />
          <p className="text-sm text-slate-400">Pa gen demann retire nan filtè sa a.</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {items.map((w) => (
            <button
              key={w.id}
              onClick={() => { setSelected(w); setNote(w.note ?? ''); }}
              className="w-full flex items-center gap-3 bg-white border border-slate-200 rounded-xl px-3 py-3 hover:border-emerald-300 transition text-left"
            >
              <div className="w-9 h-9 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <Wallet size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-slate-900 truncate">{w.vendor?.business_name ?? 'Vandè'}</p>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${STATUS_STYLES[w.status] ?? 'bg-slate-100 text-slate-600'}`}>
                    {STATUS_LABELS[w.status] ?? w.status}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  {formatHTG(w.amount)} · {relativeTime(w.requested_at)}
                  {w.vendor?.moncash_phone ? ` · ${w.vendor.moncash_phone}` : ''}
                </p>
              </div>
              <ChevronRight size={16} className="text-slate-300 shrink-0" />
            </button>
          ))}
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40">
          <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="sticky top-0 bg-white border-b border-slate-100 px-4 py-3 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-sm">Detay Demann Retire</h3>
              <button onClick={() => setSelected(null)} className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
                <X size={16} />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-2xl font-bold text-slate-900">{formatHTG(selected.amount)}</p>
                <span className={`text-xs px-2 py-1 rounded-full font-semibold ${STATUS_STYLES[selected.status]}`}>
                  {STATUS_LABELS[selected.status] ?? selected.status}
                </span>
              </div>

              <div className="bg-slate-50 rounded-xl p-3 space-y-2 text-sm">
                <div className="flex items-center gap-2 text-slate-700">
                  <User size={14} className="text-slate-400" />
                  <span className="font-semibold">{selected.vendor?.business_name ?? '—'}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-600">
                  <Phone size={14} className="text-slate-400" />
                  <span>MonCash: {selected.vendor?.moncash_phone ?? '—'} ({selected.vendor?.moncash_name ?? '—'})</span>
                </div>
                <p className="text-xs text-slate-500">Balans vandè: {formatHTG(selected.vendor?.balance)}</p>
                <p className="text-xs text-slate-500">Demann: {formatDateTime(selected.requested_at)}</p>
                {selected.processed_at && <p className="text-xs text-slate-500">Trete: {formatDateTime(selected.processed_at)}</p>}
                {selected.received_at && <p className="text-xs text-slate-500">Resevwa: {formatDateTime(selected.received_at)}</p>}
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600">Nòt Admin</label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  placeholder="Nòt oswa rezon rejè..."
                  className="mt-1 w-full p-3 rounded-xl border border-slate-200 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex flex-col gap-2">
                {NEXT_STATUS[selected.status] && (
                  <button
                    disabled={acting}
                    onClick={() => updateStatus(selected, NEXT_STATUS[selected.status]!)}
                    className="w-full py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    {acting ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                    {NEXT_LABEL[selected.status] ?? 'Avanse'}
                  </button>
                )}
                {selected.status === 'pending' || selected.status === 'approved' || selected.status === 'processing' ? (
                  <button
                    disabled={acting}
                    onClick={() => updateStatus(selected, 'rejected')}
                    className="w-full py-2.5 rounded-xl bg-rose-600 text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    {acting ? <Loader2 size={16} className="animate-spin" /> : <Ban size={16} />}
                    Rejte Demann
                  </button>
                ) : null}
                {(selected.status === 'paid' || selected.status === 'completed' || selected.status === 'rejected') && (
                  <div className="flex items-center gap-2 text-sm text-slate-500 justify-center py-2">
                    {selected.status === 'rejected' ? <XCircle size={16} /> : <CheckCircle2 size={16} className="text-emerald-600" />}
                    Demann sa a fini.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
