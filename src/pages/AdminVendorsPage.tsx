import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/lib/toast';
import { useConfirm } from '@/lib/confirm';
import { formatHTG, formatDateTime, relativeTime } from '@/lib/format';
import type { Vendor, NameChangeRequest, AvatarReviewRequest } from '@/lib/types';
import {
  Search, Loader2, Users, ChevronRight, X, CheckCircle2, XCircle,
  Ban, Shield, Phone, Mail, MapPin, Store, Image as ImageIcon,
} from 'lucide-react';

type StatusFilter = 'all' | 'active' | 'pending' | 'pending_review' | 'suspended';

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'Tout' },
  { key: 'active', label: 'Aktif' },
  { key: 'pending', label: 'An Atant' },
  { key: 'pending_review', label: 'Revizyon' },
  { key: 'suspended', label: 'Sispann' },
];

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700',
  pending: 'bg-amber-100 text-amber-700',
  pending_review: 'bg-blue-100 text-blue-700',
  suspended: 'bg-rose-100 text-rose-700',
};

const STATUS_LABELS: Record<string, string> = {
  active: 'Aktif',
  pending: 'An Atant',
  pending_review: 'Revizyon',
  suspended: 'Sispann',
};

type Tab = 'vendors' | 'names' | 'avatars';

export function AdminVendorsPage() {
  const { toast } = useToast();
  const { confirm } = useConfirm();
  const [tab, setTab] = useState<Tab>('vendors');
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [names, setNames] = useState<(NameChangeRequest & { vendor?: Pick<Vendor, 'business_name' | 'avatar_url'> | null })[]>([]);
  const [avatars, setAvatars] = useState<(AvatarReviewRequest & { vendor?: Pick<Vendor, 'business_name' | 'avatar_url'> | null })[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Vendor | null>(null);
  const [trustDelta, setTrustDelta] = useState('-25');
  const [trustReason, setTrustReason] = useState('');
  const [acting, setActing] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const loadVendors = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('vendors')
      .select('*')
      .order('joined_at', { ascending: false });

    if (filter !== 'all') {
      query = query.eq('status', filter);
    }

    const { data, error } = await query.limit(200);
    if (error) {
      toast('Erè lè w ap chaje vandè yo', 'error');
      setLoading(false);
      return;
    }

    let list = (data ?? []) as Vendor[];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((v) =>
        (v.business_name ?? '').toLowerCase().includes(q) ||
        (v.email ?? '').toLowerCase().includes(q) ||
        (v.phone ?? '').toLowerCase().includes(q) ||
        (v.department ?? '').toLowerCase().includes(q) ||
        (v.city ?? '').toLowerCase().includes(q)
      );
    }
    setVendors(list);
    setLoading(false);
  }, [filter, search, toast]);

  const loadNames = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('name_change_requests')
      .select('*, vendor:vendors(business_name, avatar_url)')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) toast('Erè lè w ap chaje demann non', 'error');
    setNames((data ?? []) as typeof names);
    setLoading(false);
  }, [toast]);

  const loadAvatars = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('avatar_review_requests')
      .select('*, vendor:vendors(business_name, avatar_url)')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) toast('Erè lè w ap chaje demann avatar', 'error');
    setAvatars((data ?? []) as typeof avatars);
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    if (tab === 'vendors') loadVendors();
    else if (tab === 'names') loadNames();
    else loadAvatars();
  }, [tab, loadVendors, loadNames, loadAvatars]);

  useEffect(() => {
    const channel = supabase
      .channel('admin-vendors')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vendors' }, () => {
        if (tab === 'vendors') loadVendors();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'name_change_requests' }, () => {
        if (tab === 'names') loadNames();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'avatar_review_requests' }, () => {
        if (tab === 'avatars') loadAvatars();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [tab, loadVendors, loadNames, loadAvatars]);

  const setVendorStatus = async (v: Vendor, status: string) => {
    const ok = await confirm({
      title: status === 'suspended' ? 'Sispann Vandè' : 'Aktive Vandè',
      message: status === 'suspended'
        ? `Ou vle sispann « ${v.business_name} »?`
        : `Ou vle aktive « ${v.business_name} »?`,
      confirmText: 'Wi',
      danger: status === 'suspended',
    });
    if (!ok) return;
    setActing(true);
    const { error } = await supabase
      .from('vendors')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', v.id);
    setActing(false);
    if (error) { toast(error.message || 'Erè, eseye ankò', 'error'); return; }
    toast(status === 'suspended' ? 'Vandè sispann' : 'Vandè aktive');
    setSelected(null);
    loadVendors();
  };

  const adjustTrust = async (v: Vendor) => {
    const delta = Number(trustDelta);
    if (!delta || Number.isNaN(delta)) {
      toast('Antre yon chanjman trust valab', 'error');
      return;
    }
    const newScore = Math.max(0, Math.min(100, (v.trust_score ?? 100) + delta));
    setActing(true);
    const { error: vErr } = await supabase
      .from('vendors')
      .update({ trust_score: newScore, updated_at: new Date().toISOString() })
      .eq('id', v.id);
    if (vErr) {
      setActing(false);
      toast(vErr.message || 'Erè, eseye ankò', 'error');
      return;
    }
    await supabase.from('trust_history').insert({
      vendor_id: v.id,
      delta,
      reason: trustReason.trim() || 'Ajisteman admin',
      new_score: newScore,
    });
    setActing(false);
    toast(`Trust score: ${newScore}`);
    setTrustReason('');
    setSelected({ ...v, trust_score: newScore });
    loadVendors();
  };

  const handleName = async (req: NameChangeRequest, approve: boolean) => {
    setActing(true);
    const { error } = approve
      ? await supabase.rpc('approve_name_change', { p_request_id: req.id, p_note: null })
      : await supabase.rpc('reject_name_change', { p_request_id: req.id, p_reason: rejectReason.trim() || null });
    setActing(false);
    if (error) { toast(error.message || 'Erè, eseye ankò', 'error'); return; }
    toast(approve ? 'Non apwouve' : 'Non rejte');
    setRejectReason('');
    loadNames();
  };

  const handleAvatar = async (req: AvatarReviewRequest, approve: boolean) => {
    setActing(true);
    const { error } = approve
      ? await supabase.rpc('approve_avatar', { p_request_id: req.id })
      : await supabase.rpc('reject_avatar', { p_request_id: req.id, p_reason: rejectReason.trim() || null });
    setActing(false);
    if (error) { toast(error.message || 'Erè, eseye ankò', 'error'); return; }
    toast(approve ? 'Avatar apwouve' : 'Avatar rejte');
    setRejectReason('');
    loadAvatars();
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-1.5 bg-white border border-slate-200 rounded-xl p-1">
        {([
          { key: 'vendors' as Tab, label: 'Vandè' },
          { key: 'names' as Tab, label: 'Chanjman Non' },
          { key: 'avatars' as Tab, label: 'Avatar' },
        ]).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition ${
              tab === t.key ? 'bg-emerald-500 text-black' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'vendors' && (
        <>
          <div className="flex flex-wrap gap-1.5">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition ${
                  filter === f.key ? 'bg-emerald-500 text-black' : 'bg-white border border-slate-200 text-slate-600'
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
              placeholder="Chache pa non, imèl, telefòn, vil..."
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-slate-400" /></div>
      ) : tab === 'vendors' ? (
        vendors.length === 0 ? (
          <Empty icon={<Users size={28} />} text="Pa gen vandè nan filtè sa a." />
        ) : (
          <div className="space-y-1.5">
            {vendors.map((v) => (
              <button
                key={v.id}
                onClick={() => setSelected(v)}
                className="w-full flex items-center gap-3 bg-white border border-slate-200 rounded-xl px-3 py-3 hover:border-emerald-300 transition text-left"
              >
                <div className="w-10 h-10 rounded-full bg-slate-100 overflow-hidden shrink-0 flex items-center justify-center">
                  {v.avatar_url
                    ? <img src={v.avatar_url} alt="" className="w-full h-full object-cover" />
                    : <Store size={16} className="text-slate-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-slate-900 truncate">{v.business_name}</p>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${STATUS_STYLES[v.status] ?? 'bg-slate-100 text-slate-600'}`}>
                      {STATUS_LABELS[v.status] ?? v.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5 truncate">
                    Trust {v.trust_score} · {formatHTG(v.balance)} · {v.city ?? v.department ?? '—'}
                  </p>
                </div>
                <ChevronRight size={16} className="text-slate-300" />
              </button>
            ))}
          </div>
        )
      ) : tab === 'names' ? (
        names.length === 0 ? (
          <Empty icon={<Store size={28} />} text="Pa gen demann chanjman non an atant." />
        ) : (
          <div className="space-y-2">
            {names.map((n) => (
              <div key={n.id} className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{n.vendor?.business_name ?? 'Vandè'}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    <span className="line-through">{n.old_name}</span>
                    {' → '}
                    <span className="font-semibold text-emerald-700">{n.requested_name}</span>
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    OTP {n.otp_verified ? 'verifye' : 'pa verifye'} · {relativeTime(n.created_at)}
                  </p>
                </div>
                <input
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Rezon rejè (si nesesè)..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
                />
                <div className="flex gap-2">
                  <button
                    disabled={acting || !n.otp_verified}
                    onClick={() => handleName(n, true)}
                    className="flex-1 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold disabled:opacity-50 flex items-center justify-center gap-1"
                  >
                    <CheckCircle2 size={14} /> Apwouve
                  </button>
                  <button
                    disabled={acting}
                    onClick={() => handleName(n, false)}
                    className="flex-1 py-2 rounded-xl bg-rose-600 text-white text-xs font-semibold disabled:opacity-50 flex items-center justify-center gap-1"
                  >
                    <XCircle size={14} /> Rejte
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        avatars.length === 0 ? (
          <Empty icon={<ImageIcon size={28} />} text="Pa gen demann avatar an atant." />
        ) : (
          <div className="space-y-2">
            {avatars.map((a) => (
              <div key={a.id} className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <img src={a.new_avatar_url} alt="" className="w-16 h-16 rounded-xl object-cover border border-slate-200" />
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{a.vendor?.business_name ?? 'Vandè'}</p>
                    <p className="text-[11px] text-slate-400">{relativeTime(a.created_at)}</p>
                  </div>
                </div>
                <input
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Rezon rejè (si nesesè)..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
                />
                <div className="flex gap-2">
                  <button
                    disabled={acting}
                    onClick={() => handleAvatar(a, true)}
                    className="flex-1 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold disabled:opacity-50 flex items-center justify-center gap-1"
                  >
                    <CheckCircle2 size={14} /> Apwouve
                  </button>
                  <button
                    disabled={acting}
                    onClick={() => handleAvatar(a, false)}
                    className="flex-1 py-2 rounded-xl bg-rose-600 text-white text-xs font-semibold disabled:opacity-50 flex items-center justify-center gap-1"
                  >
                    <XCircle size={14} /> Rejte
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {selected && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40">
          <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="sticky top-0 bg-white border-b border-slate-100 px-4 py-3 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-sm">Detay Vandè</h3>
              <button onClick={() => setSelected(null)} className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
                <X size={16} />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-full bg-slate-100 overflow-hidden flex items-center justify-center">
                  {selected.avatar_url
                    ? <img src={selected.avatar_url} alt="" className="w-full h-full object-cover" />
                    : <Store size={20} className="text-slate-400" />}
                </div>
                <div>
                  <p className="font-bold text-slate-900">{selected.business_name}</p>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${STATUS_STYLES[selected.status] ?? 'bg-slate-100'}`}>
                    {STATUS_LABELS[selected.status] ?? selected.status}
                  </span>
                </div>
              </div>

              <div className="bg-slate-50 rounded-xl p-3 space-y-2 text-sm text-slate-700">
                <p className="flex items-center gap-2"><Mail size={14} className="text-slate-400" />{selected.email ?? '—'}</p>
                <p className="flex items-center gap-2"><Phone size={14} className="text-slate-400" />{selected.phone ?? '—'}</p>
                <p className="flex items-center gap-2"><MapPin size={14} className="text-slate-400" />{[selected.address, selected.city, selected.department].filter(Boolean).join(', ') || '—'}</p>
                <p className="flex items-center gap-2"><Shield size={14} className="text-slate-400" />Trust {selected.trust_score} · Pwen {selected.points} · Balans {formatHTG(selected.balance)}</p>
                <p className="text-xs text-slate-500">Antre: {formatDateTime(selected.joined_at)}</p>
                <p className="text-xs text-slate-500">MonCash: {selected.moncash_phone ?? '—'} ({selected.moncash_name ?? '—'})</p>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-600">Ajiste Trust Score</p>
                <div className="flex gap-2">
                  <input
                    value={trustDelta}
                    onChange={(e) => setTrustDelta(e.target.value)}
                    type="number"
                    className="w-24 px-3 py-2 rounded-xl border border-slate-200 text-sm"
                  />
                  <input
                    value={trustReason}
                    onChange={(e) => setTrustReason(e.target.value)}
                    placeholder="Rezon..."
                    className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-sm"
                  />
                </div>
                <button
                  disabled={acting}
                  onClick={() => adjustTrust(selected)}
                  className="w-full py-2 rounded-xl bg-slate-800 text-white text-xs font-semibold disabled:opacity-50"
                >
                  Anrejistre Trust
                </button>
              </div>

              <div className="flex gap-2">
                {selected.status === 'suspended' ? (
                  <button
                    disabled={acting}
                    onClick={() => setVendorStatus(selected, 'active')}
                    className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-1"
                  >
                    <CheckCircle2 size={16} /> Aktive
                  </button>
                ) : (
                  <button
                    disabled={acting}
                    onClick={() => setVendorStatus(selected, 'suspended')}
                    className="flex-1 py-2.5 rounded-xl bg-rose-600 text-white text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-1"
                  >
                    <Ban size={16} /> Sispann
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Empty({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
      <div className="text-slate-300 mb-2 flex justify-center">{icon}</div>
      <p className="text-sm text-slate-400">{text}</p>
    </div>
  );
}
