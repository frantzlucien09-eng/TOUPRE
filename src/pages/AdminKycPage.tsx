import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAdminAuth } from '@/lib/adminAuth';
import { useToast } from '@/lib/toast';
import { formatDateTime, relativeTime } from '@/lib/format';
import type { VendorKyc, Vendor } from '@/lib/types';
import {
  BadgeCheck, CheckCircle2, XCircle, Search, Loader2, User, CreditCard,
  Camera, Phone, MapPin, Building2, FileText, ChevronRight, Eye, X,
} from 'lucide-react';

type KycWithVendor = VendorKyc & { vendor?: Pick<Vendor, 'business_name' | 'email' | 'phone' | 'avatar_url'> | null };

type Filter = 'pending' | 'approved' | 'rejected' | 'resubmit' | 'all';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'pending', label: 'An Atant' },
  { key: 'resubmit', label: 'Mande Refè' },
  { key: 'approved', label: 'Apwouve' },
  { key: 'rejected', label: 'Rejte' },
  { key: 'all', label: 'Tout' },
];

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  resubmit: 'bg-blue-100 text-blue-700',
  approved: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-rose-100 text-rose-700',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'An Atant',
  resubmit: 'Mande Refè',
  approved: 'Apwouve',
  rejected: 'Rejte',
};

export function AdminKycPage() {
  const { admin } = useAdminAuth();
  const { toast } = useToast();
  const [kycList, setKycList] = useState<KycWithVendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('pending');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<KycWithVendor | null>(null);

  const loadKyc = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('vendor_kyc')
      .select('*, vendor:vendors(business_name, email, phone, avatar_url)')
      .order('submitted_at', { ascending: false });

    if (filter !== 'all') {
      query = query.eq('status', filter);
    }

    const { data, error } = await query.limit(100);
    if (error) {
      toast('Erè lè w ap chaje demann KYC', 'error');
      setLoading(false);
      return;
    }

    let list = (data ?? []) as unknown as KycWithVendor[];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((k) =>
        k.business_name.toLowerCase().includes(q) ||
        k.last_name.toLowerCase().includes(q) ||
        k.first_names.toLowerCase().includes(q) ||
        k.id_number.toLowerCase().includes(q) ||
        (k.vendor?.email ?? '').toLowerCase().includes(q)
      );
    }
    setKycList(list);
    setLoading(false);
  }, [filter, search, toast]);

  useEffect(() => {
    loadKyc();
  }, [loadKyc]);

  // Realtime: refresh when KYC changes
  useEffect(() => {
    const channel = supabase
      .channel('admin-kyc')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vendor_kyc' }, () => loadKyc())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadKyc]);

  const handleApprove = async (kyc: KycWithVendor) => {
    if (!admin) return;
    if (!kyc.admin_name_match) {
      toast('Ou dwe konfime non an matche anvan w apwouve', 'error');
      return;
    }
    try {
      const { error } = await supabase.rpc('approve_vendor_kyc', {
        p_kyc_id: kyc.id,
        p_reviewer_id: admin.id,
        p_name_match: kyc.admin_name_match,
        p_selfie_match: kyc.admin_selfie_match ?? false,
        p_note: kyc.reviewer_note ?? null,
      });
      if (error) throw error;
      toast('Demann KYC apwouve — vandè a kounye a aktif');
      setSelected(null);
      loadKyc();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erè pandan apwobasyon';
      toast(msg, 'error');
    }
  };

  const handleReject = async (kyc: KycWithVendor, reason: string, resubmit: boolean) => {
    if (!admin) return;
    if (!reason.trim()) {
      toast('Ou dwe bay yon rezon pou rejte', 'error');
      return;
    }
    try {
      const { error } = await supabase.rpc('reject_vendor_kyc', {
        p_kyc_id: kyc.id,
        p_reason: reason,
        p_resubmit: resubmit,
        p_reviewer_id: admin.id,
      });
      if (error) throw error;
      toast(resubmit ? 'Demann rejte — vandè ka refè dosye a' : 'Demann rejte');
      setSelected(null);
      loadKyc();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erè pandan rejte';
      toast(msg, 'error');
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters + search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex gap-1 p-1 bg-white rounded-xl border border-slate-200 overflow-x-auto no-scrollbar">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                filter === f.key ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Chache pa non, biznis, nimewo ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 bg-white text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="animate-spin text-slate-400" size={24} />
        </div>
      ) : kycList.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center">
          <BadgeCheck size={28} className="mx-auto text-slate-300 mb-3" />
          <p className="text-sm text-slate-400">Pa gen demann KYC nan filt sa a.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {kycList.map((kyc) => (
            <button
              key={kyc.id}
              onClick={() => setSelected(kyc)}
              className="w-full bg-white rounded-2xl border border-slate-200 p-4 shadow-sm hover:shadow-md hover:border-slate-300 transition text-left active:scale-[0.99]"
            >
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 shrink-0 overflow-hidden">
                  {kyc.vendor?.avatar_url ? (
                    <img src={kyc.vendor.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <User size={20} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-slate-900 text-sm truncate">
                      {kyc.last_name} {kyc.first_names}
                    </p>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${STATUS_STYLES[kyc.status]}`}>
                      {STATUS_LABELS[kyc.status]}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 truncate">{kyc.business_name}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    ID: {kyc.id_number} · {relativeTime(kyc.submitted_at)}
                  </p>
                </div>
                <ChevronRight size={18} className="text-slate-300 shrink-0 mt-1" />
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Detail modal */}
      {selected && (
        <KycDetailModal
          kyc={selected}
          onClose={() => setSelected(null)}
          onApprove={handleApprove}
          onReject={handleReject}
        />
      )}
    </div>
  );
}

function KycDetailModal({
  kyc,
  onClose,
  onApprove,
  onReject,
}: {
  kyc: KycWithVendor;
  onClose: () => void;
  onApprove: (kyc: KycWithVendor) => void;
  onReject: (kyc: KycWithVendor, reason: string, resubmit: boolean) => void;
}) {
  const [nameMatch, setNameMatch] = useState(kyc.admin_name_match ?? false);
  const [selfieMatch, setSelfieMatch] = useState(kyc.admin_selfie_match ?? false);
  const [note, setNote] = useState(kyc.reviewer_note ?? '');
  const [rejectReason, setRejectReason] = useState('');
  const [rejectResubmit, setRejectResubmit] = useState(true);
  const [showReject, setShowReject] = useState(false);
  const [imageZoom, setImageZoom] = useState<string | null>(null);

  const updatedKyc: KycWithVendor = {
    ...kyc,
    admin_name_match: nameMatch,
    admin_selfie_match: selfieMatch,
    reviewer_note: note,
  };

  return (
    <>
      <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in" onClick={onClose}>
        <div
          className="bg-white w-full max-w-2xl rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[92vh] flex flex-col animate-slide-up"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <BadgeCheck size={20} className="text-emerald-600" />
              <h2 className="font-bold text-slate-900 text-base">Revizyon KYC</h2>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${STATUS_STYLES[kyc.status]}`}>
                {STATUS_LABELS[kyc.status]}
              </span>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 active:scale-90 transition">
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
            {/* Identity */}
            <Section icon={<User size={16} />} title="Idantite Pèsonèl">
              <Field label="Non" value={`${kyc.last_name} ${kyc.first_names}`} />
              <Field label="Dat Nesans" value={kyc.birth_date} />
              <Field label="Sèks" value={kyc.sex === 'male' ? 'Gason' : kyc.sex === 'female' ? 'Fi' : 'Lòt'} />
              <Field label="Nimewo ID" value={kyc.id_number} />
            </Section>

            {/* ID photos */}
            <Section icon={<CreditCard size={16} />} title="Dokiman ID">
              <div className="grid grid-cols-2 gap-3">
                <PhotoTile label="Devan ID" url={kyc.id_front_url} onClick={() => setImageZoom(kyc.id_front_url)} />
                <PhotoTile label="Dèyè ID" url={kyc.id_back_url} onClick={() => setImageZoom(kyc.id_back_url)} />
              </div>
            </Section>

            {/* Selfie */}
            <Section icon={<Camera size={16} />} title="Selfie ak ID">
              <PhotoTile label="Selfie ak ID" url={kyc.selfie_with_id_url} onClick={() => setImageZoom(kyc.selfie_with_id_url)} />
            </Section>

            {/* Contact + business */}
            <Section icon={<MapPin size={16} />} title="Adrès ak Kontak">
              <Field label="Depatman" value={kyc.department ?? '—'} />
              <Field label="Vil" value={kyc.city ?? '—'} />
              <Field label="Adrès" value={kyc.address ?? '—'} />
              <Field label="Telefon" value={kyc.moncash_phone} />
              <Field label="Imèl" value={kyc.vendor?.email ?? '—'} />
            </Section>

            <Section icon={<Building2 size={16} />} title="Biznis">
              <Field label="Non Biznis" value={kyc.business_name} />
              <Field label="Kategori" value={kyc.business_category ?? '—'} />
              <Field label="Deskripsyon" value={kyc.business_short_desc ?? kyc.business_description ?? '—'} />
              <Field label="Anrejistreman" value={kyc.business_registration ?? '—'} />
            </Section>

            <Section icon={<FileText size={16} />} title="Refèrans">
              <Field label="Sous" value={kyc.referral_source ?? '—'} />
              <Field label="Detay" value={kyc.referral_detail ?? '—'} />
            </Section>

            {/* Review checks */}
            {kyc.status === 'pending' || kyc.status === 'resubmit' ? (
              <Section icon={<BadgeCheck size={16} />} title="Verifikasyon Admin">
                <div className="space-y-2">
                  <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50 transition">
                    <input
                      type="checkbox"
                      checked={nameMatch}
                      onChange={(e) => setNameMatch(e.target.checked)}
                      className="w-5 h-5 rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="text-sm text-slate-700">Mwen verifye non sou ID a matche ak non biznis la</span>
                  </label>
                  <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50 transition">
                    <input
                      type="checkbox"
                      checked={selfieMatch}
                      onChange={(e) => setSelfieMatch(e.target.checked)}
                      className="w-5 h-5 rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="text-sm text-slate-700">Mwen verifye selfie a ak ID a se menm moun</span>
                  </label>
                  <textarea
                    placeholder="Nòt revizyon (opsyonèl)..."
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={2}
                    className="w-full p-3 rounded-xl border border-slate-200 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </Section>
            ) : null}

            {/* Previous review info */}
            {kyc.reviewed_at && (
              <div className="text-xs text-slate-400 space-y-1">
                <p>Revize: {formatDateTime(kyc.reviewed_at)}</p>
                {kyc.rejection_reason && <p>Rezon rejte: {kyc.rejection_reason}</p>}
                {kyc.reviewer_note && <p>Nòt: {kyc.reviewer_note}</p>}
              </div>
            )}
          </div>

          {/* Footer actions */}
          {(kyc.status === 'pending' || kyc.status === 'resubmit') && (
            <div className="px-5 py-4 border-t border-slate-100 space-y-3">
              {showReject ? (
                <div className="space-y-3">
                  <textarea
                    placeholder="Rezon pou rejte a..."
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    rows={2}
                    className="w-full p-3 rounded-xl border border-slate-200 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                  <label className="flex items-center gap-2 text-sm text-slate-600">
                    <input
                      type="checkbox"
                      checked={rejectResubmit}
                      onChange={(e) => setRejectResubmit(e.target.checked)}
                      className="w-4 h-4 rounded text-emerald-600"
                    />
                    Pèmèt vandè a refè dosye a
                  </label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowReject(false)}
                      className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition"
                    >
                      Anile
                    </button>
                    <button
                      onClick={() => onReject(updatedKyc, rejectReason, rejectResubmit)}
                      className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold flex items-center justify-center gap-2 transition"
                    >
                      <XCircle size={16} />
                      Konfime Rejte
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowReject(true)}
                    className="flex-1 py-2.5 rounded-xl border border-rose-200 text-rose-600 text-sm font-semibold hover:bg-rose-50 transition flex items-center justify-center gap-2"
                  >
                    <XCircle size={16} />
                    Rejte
                  </button>
                  <button
                    onClick={() => onApprove(updatedKyc)}
                    disabled={!nameMatch}
                    className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold flex items-center justify-center gap-2 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <CheckCircle2 size={16} />
                    Apwouve
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Image zoom */}
      {imageZoom && (
        <div className="fixed inset-0 z-[95] bg-black/90 flex items-center justify-center p-4 animate-fade-in" onClick={() => setImageZoom(null)}>
          <button className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition">
            <X size={20} />
          </button>
          <img src={imageZoom} alt="" className="max-w-full max-h-full object-contain rounded-lg" />
        </div>
      )}
    </>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <div className="text-emerald-600">{icon}</div>
        <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">{title}</h3>
      </div>
      <div className="bg-slate-50 rounded-xl p-3 space-y-1.5">{children}</div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 text-sm">
      <span className="text-slate-500 shrink-0">{label}</span>
      <span className="text-slate-900 font-medium text-right break-words">{value}</span>
    </div>
  );
}

function PhotoTile({ label, url, onClick }: { label: string; url: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group relative aspect-[4/3] rounded-xl overflow-hidden border border-slate-200 bg-slate-100 hover:border-emerald-400 transition"
    >
      <img src={url} alt={label} className="w-full h-full object-cover" />
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition flex items-end p-2">
        <span className="text-[10px] text-white font-semibold bg-black/40 px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition flex items-center gap-1">
          <Eye size={10} /> {label}
        </span>
      </div>
      <span className="absolute top-2 left-2 text-[10px] text-white font-semibold bg-black/40 px-2 py-0.5 rounded">
        {label}
      </span>
    </button>
  );
}
