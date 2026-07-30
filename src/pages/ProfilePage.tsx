import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/lib/toast';
import { formatDate, formatDateTime } from '@/lib/format';
import type { TrustHistory, VendorMonthlyStat, Vendor, Product, NameChangeRequest, AvatarReviewRequest } from '@/lib/types';
import { Header } from '@/components/Header';
import { Modal } from '@/components/Modal';
import { EmptyState } from '@/components/EmptyState';
import { ProductCard } from '@/components/ProductCard';
import {
  Star, ClipboardList, Shield, Pencil, Settings, Trophy, Loader2, Save, Award, Info, Package, Heart,
  Camera, KeyRound, Clock,
} from 'lucide-react';

type Props = {
  onGoOrdersDone: () => void;
  onGoSettings: () => void;
  onGoWithdraw: () => void;
  onGoFollow: () => void;
};

export function ProfilePage({ onGoOrdersDone, onGoSettings, onGoWithdraw, onGoFollow }: Props) {
  const { vendor, refreshVendor } = useAuth();
  const { toast } = useToast();
  const [editOpen, setEditOpen] = useState(false);
  const [trustOpen, setTrustOpen] = useState(false);
  const [pointsOpen, setPointsOpen] = useState(false);
  const [trustHistory, setTrustHistory] = useState<TrustHistory[]>([]);
  const [topTab, setTopTab] = useState<'zone' | 'national'>('zone');
  const [topVendors, setTopVendors] = useState<(VendorMonthlyStat & { vendor: Vendor | null })[]>([]);
  const [myProducts, setMyProducts] = useState<Product[]>([]);

  useEffect(() => {
    if (!vendor) return;
    supabase
      .from('trust_history')
      .select('*')
      .eq('vendor_id', vendor.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => setTrustHistory((data ?? []) as TrustHistory[]));

    // Load top vendors from real-time vendor_rankings
    supabase
      .from('vendor_rankings')
      .select('vendor_id, business_name, avatar_url, department, city, zone_rank, national_rank, score, total_sales_count, total_revenue')
      .order('score', { ascending: false })
      .limit(50)
      .then(({ data }) => setTopVendors((data ?? []) as unknown as (VendorMonthlyStat & { vendor: Vendor | null })[]));

    supabase
      .from('products')
      .select('*')
      .eq('vendor_id', vendor.id)
      .order('created_at', { ascending: false })
      .limit(4)
      .then(({ data }) => setMyProducts((data ?? []) as Product[]));
  }, [vendor]);

  if (!vendor) return null;

  const zoneList = topVendors.filter((s) => s.department === vendor.department);
  const nationalList = topVendors;
  const displayList = topTab === 'zone' ? zoneList : nationalList;
  const myZoneRank = zoneList.findIndex((s) => s.vendor_id === vendor.id) + 1;
  const myNationalRank = nationalList.findIndex((s) => s.vendor_id === vendor.id) + 1;

  return (
    <div className="pb-24">
      <Header title="Pwofil" />

      <div className="px-4 pt-4 space-y-4">
        {/* Profile header */}
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm text-center">
          <div className="w-20 h-20 rounded-full mx-auto bg-gradient-to-br from-emerald-500 to-emerald-700 text-white flex items-center justify-center text-2xl font-bold shadow-md">
            {vendor.avatar_url ? (
              <img src={vendor.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
            ) : (
              vendor.business_name.charAt(0).toUpperCase()
            )}
          </div>
          <h2 className="font-bold text-slate-900 text-base mt-3">{vendor.business_name}</h2>
          <p className="text-xs text-slate-500 mt-0.5">Sou TOUPRE depi {formatDate(vendor.joined_at)}</p>
          <button
            onClick={() => setEditOpen(true)}
            className="mt-3 px-4 py-2 rounded-lg border border-slate-200 text-slate-700 font-semibold text-xs flex items-center gap-1.5 mx-auto hover:bg-slate-50 active:scale-95 transition"
          >
            <Pencil size={13} /> Modifye pwofil
          </button>
        </div>

        {/* Stat blocks */}
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => setPointsOpen(true)} className="text-left bg-white rounded-2xl p-4 border border-slate-100 shadow-sm active:scale-95 transition">
            <div className="w-9 h-9 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center">
              <Star size={18} />
            </div>
            <p className="text-xs text-slate-500 mt-3">Pwen</p>
            <p className="text-xl font-bold text-slate-900">{vendor.points}</p>
          </button>
          <button onClick={onGoOrdersDone} className="text-left bg-white rounded-2xl p-4 border border-slate-100 shadow-sm active:scale-95 transition">
            <div className="w-9 h-9 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <ClipboardList size={18} />
            </div>
            <p className="text-xs text-slate-500 mt-3">Kòmand voye</p>
            <p className="text-xl font-bold text-slate-900">{vendor.orders_sent}</p>
          </button>
        </div>

        {/* Trust score */}
        <button onClick={() => setTrustOpen(true)} className="w-full text-left bg-white rounded-2xl p-4 border border-slate-100 shadow-sm active:scale-95 transition">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield size={18} className="text-emerald-600" />
              <span className="font-semibold text-slate-900 text-sm">Nòt konfyans</span>
            </div>
            <span className="font-bold text-slate-900">{vendor.trust_score}%</span>
          </div>
          <div className="mt-3 h-2 rounded-full bg-slate-100 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                vendor.trust_score >= 75 ? 'bg-emerald-500' : vendor.trust_score >= 50 ? 'bg-amber-500' : 'bg-red-500'
              }`}
              style={{ width: `${vendor.trust_score}%` }}
            />
          </div>
          <p className="text-[11px] text-slate-400 mt-2">-25% pou chak erè. Klike pou wè istorik.</p>
        </button>

        {/* Withdraw shortcut */}
        <button
          onClick={onGoWithdraw}
          className="w-full flex items-center justify-between bg-slate-900 rounded-2xl p-4 text-white shadow-sm active:scale-95 transition"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center">
              <Award size={18} />
            </div>
            <div className="text-left">
              <p className="font-semibold text-sm">Retire lajan</p>
              <p className="text-xs text-slate-300">Balans: {Number(vendor.balance ?? 0).toLocaleString('fr-HT')} G</p>
            </div>
          </div>
          <Settings size={18} className="text-slate-400" />
        </button>

        {/* Top vendors */}
        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Trophy size={18} className="text-amber-500" />
            <h2 className="font-bold text-slate-900 text-sm">Top Vandè</h2>
          </div>
          <div className="flex gap-1 p-1 bg-slate-100 rounded-lg mb-3">
            <button
              onClick={() => setTopTab('zone')}
              className={`flex-1 py-1.5 rounded-md text-xs font-semibold transition ${topTab === 'zone' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
            >
              Top Zòn mwen
            </button>
            <button
              onClick={() => setTopTab('national')}
              className={`flex-1 py-1.5 rounded-md text-xs font-semibold transition ${topTab === 'national' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
            >
              Top tout peyi a
            </button>
          </div>

          {displayList.length === 0 ? (
            <EmptyState icon={<Trophy size={20} />} title="Pa gen klasman toujou" />
          ) : (
            <div className="space-y-2">
              {displayList.map((s, i) => {
                const isMe = s.vendor_id === vendor.id;
                return (
                  <div
                    key={s.vendor_id}
                    className={`flex items-center gap-3 p-2 rounded-lg ${isMe ? 'bg-emerald-50' : ''}`}
                  >
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      i === 0 ? 'bg-amber-100 text-amber-700' : i === 1 ? 'bg-slate-200 text-slate-700' : i === 2 ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-500'
                    }`}>{i + 1}</span>
                    <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600 shrink-0 overflow-hidden">
                      {s.avatar_url ? (
                        <img src={s.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        s.business_name?.charAt(0) ?? '?'
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">
                        {s.business_name ?? 'Vandè'} {isMe && '(Ou)'}
                      </p>
                      <p className="text-[11px] text-slate-500">{s.total_sales_count} vant · {Number(s.total_revenue).toLocaleString('fr-HT')} G</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-3 bg-amber-50 rounded-lg p-3 text-[11px] text-amber-800 leading-relaxed">
            Rekonpans: 25,000 G pou Top Zòn · 50,000 G pou Top Nasyonal.
            {myZoneRank > 0 && <div className="mt-1 font-semibold">Pozisyon ou Zòn: #{myZoneRank}</div>}
            {myNationalRank > 0 && <div className="font-semibold">Pozisyon ou Nasyonal: #{myNationalRank}</div>}
          </div>
        </div>

        {/* My products preview */}
        {myProducts.length > 0 && (
          <div>
            <h2 className="font-bold text-slate-900 text-sm mb-2">Pwodwi mwen yo</h2>
            <div className="grid grid-cols-2 gap-3">
              {myProducts.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </div>
        )}

        <button
          onClick={onGoFollow}
          className="w-full flex items-center justify-between bg-white rounded-2xl p-4 border border-slate-100 shadow-sm active:scale-95 transition"
        >
          <div className="flex items-center gap-3">
            <Heart size={18} className="text-rose-500" />
            <span className="font-semibold text-slate-900 text-sm">Swiv Nou</span>
          </div>
          <span className="text-slate-300">›</span>
        </button>

        <button
          onClick={onGoSettings}
          className="w-full flex items-center justify-between bg-white rounded-2xl p-4 border border-slate-100 shadow-sm active:scale-95 transition"
        >
          <div className="flex items-center gap-3">
            <Settings size={18} className="text-slate-600" />
            <span className="font-semibold text-slate-900 text-sm">Paramèt</span>
          </div>
          <span className="text-slate-300">›</span>
        </button>
      </div>

      {/* Edit profile modal */}
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Modifye Pwofil">
        <EditProfileForm
          vendor={vendor}
          onSaved={() => { refreshVendor(); setEditOpen(false); toast('Chanjman anrejistre'); }}
        />
      </Modal>

      {/* Trust history modal */}
      <Modal open={trustOpen} onClose={() => setTrustOpen(false)} title="Istorik Nòt Konfyans">
        {trustHistory.length === 0 ? (
          <EmptyState icon={<Shield size={20} />} title="Pa gen chanjman" message="Nòt ou toujou 100%." />
        ) : (
          <div className="space-y-3">
            {trustHistory.map((h) => (
              <div key={h.id} className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl">
                <div className="w-8 h-8 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-xs font-bold shrink-0">
                  {h.delta}
                </div>
                <div className="flex-1">
                  <p className="text-sm text-slate-800">{h.reason ?? 'Chanjman nòt'}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">{formatDateTime(h.created_at)} · Nòt: {h.new_score}%</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>

      {/* Points explanation */}
      <Modal open={pointsOpen} onClose={() => setPointsOpen(false)} title="Kalkil Pwen">
        <div className="space-y-3 text-sm text-slate-600">
          <div className="flex items-start gap-3">
            <Info size={18} className="text-emerald-600 mt-0.5 shrink-0" />
            <p>Ou gen <b>{vendor.points} pwen</b>. Ou jwenn 10 pwen pou chak kòmand ou fini.</p>
          </div>
          <div className="flex items-start gap-3">
            <Info size={18} className="text-emerald-600 mt-0.5 shrink-0" />
            <p>Pwen yo itilize pou kalkile pozisyon ou nan Top Vandè (Zòn ak Nasyonal) chak mwa.</p>
          </div>
          <div className="flex items-start gap-3">
            <Info size={18} className="text-emerald-600 mt-0.5 shrink-0" />
            <p>Plis ou gen pwen, plis ou ka genyen rekonpans: 25,000 G (Top Zòn) oswa 50,000 G (Top Nasyonal).</p>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function EditProfileForm({ vendor, onSaved }: { vendor: Vendor; onSaved: () => void }) {
  const { toast } = useToast();
  const [businessName, setBusinessName] = useState(vendor.business_name);
  const [phone, setPhone] = useState(vendor.phone ?? '');
  const [email] = useState(vendor.email ?? '');
  const [address, setAddress] = useState(vendor.address ?? '');
  const [pickupAddress, setPickupAddress] = useState(vendor.pickup_address ?? '');
  const [description, setDescription] = useState(vendor.description ?? '');
  const [saving, setSaving] = useState(false);

  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [pendingAvatar, setPendingAvatar] = useState<AvatarReviewRequest | null>(null);

  const [nameChanged, setNameChanged] = useState(false);
  const [otpModalOpen, setOtpModalOpen] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [pendingRequestId, setPendingRequestId] = useState<string | null>(null);
  const [pendingOtpSecret, setPendingOtpSecret] = useState<string | null>(null);
  const [nameOtpViaEmail, setNameOtpViaEmail] = useState(false);

  useEffect(() => {
    const loadPending = async () => {
      const { data } = await supabase
        .from('avatar_review_requests')
        .select('*')
        .eq('vendor_id', vendor.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      setPendingAvatar(data as AvatarReviewRequest | null);
    };
    loadPending();
  }, [vendor.id]);

  const onPickAvatar = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith('image/')) { toast('Tanpri chwazi yon fichye imaj.', 'error'); return; }
    setAvatarFile(f);
    setAvatarPreview(URL.createObjectURL(f));
  };

  const uploadAvatar = async (): Promise<string | null> => {
    if (!avatarFile) return null;
    setAvatarUploading(true);
    const ext = avatarFile.name.split('.').pop()?.toLowerCase() ?? 'jpg';
    const path = `${vendor.id}/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from('avatars').upload(path, avatarFile, { upsert: true });
    setAvatarUploading(false);
    if (upErr) { toast('Pwoblèm telechaje foto a.', 'error'); return null; }
    const { data } = supabase.storage.from('avatars').getPublicUrl(path);
    return data.publicUrl;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    // Avatar upload + review request (if a new file was picked)
    if (avatarFile) {
      const url = await uploadAvatar();
      if (url) {
        const { error } = await supabase.from('avatar_review_requests').insert({
          vendor_id: vendor.id,
          new_avatar_url: url,
          status: 'pending',
        });
        if (error) {
          toast('Pwoblèm anrejistre foto pou revizyon.', 'error');
        } else {
          toast('Foto ou voye bay Admin pou revizyon. Ansyen foto w ap rete aktif.', 'success');
          setAvatarFile(null);
          setAvatarPreview(null);
        }
      }
    }

    // Name change requires OTP + admin approval
    if (businessName.trim() !== vendor.business_name && businessName.trim().length > 0) {
      const code = String(Math.floor(100000 + Math.random() * 900000));
      const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      const { data, error } = await supabase.from('name_change_requests').insert({
        vendor_id: vendor.id,
        old_name: vendor.business_name,
        requested_name: businessName.trim(),
        otp_code: code,
        otp_expires_at: expires,
        otp_verified: false,
        status: 'pending',
      }).select('id').single();
      if (error) {
        toast('Pwoblèm kreye demand chanjman non.', 'error');
        setSaving(false);
        return;
      }
      setPendingRequestId(data.id);
      setPendingOtpSecret(code);

      // Prefer email OTP when vendor has email (Settings). Email OTP code differs from
      // DB secret — verifyEmailOtp first, then unlock the request with the stored secret.
      if (vendor.email) {
        const { sendEmailOtp } = await import('@/lib/emailOtp');
        const otpResult = await sendEmailOtp(vendor.email, 'email_change');
        if (!otpResult.success) {
          toast(otpResult.error || 'Pa t kapab voye OTP. Eseye ankò.', 'error');
          setSaving(false);
          return;
        }
        setNameOtpViaEmail(true);
        toast(`Kòd OTP voye bay ${vendor.email}`, 'success');
        if (import.meta.env.DEV && otpResult.code) {
          toast(`Kòd dev: ${otpResult.code}`, 'info');
        }
      } else if (import.meta.env.DEV) {
        setNameOtpViaEmail(false);
        toast(`Kòd OTP (dev): ${code}`, 'info');
      } else {
        toast('Ajoute yon imèl nan Paramèt pou resevwa kòd OTP.', 'error');
        setSaving(false);
        return;
      }
      setOtpModalOpen(true);
      setSaving(false);
      return; // Don't save other fields yet — name flow takes over
    }

    // Save other profile fields directly (no name change). Email changes go through Settings OTP.
    const { error } = await supabase.from('vendors').update({
      phone, address, pickup_address: pickupAddress, description,
      updated_at: new Date().toISOString(),
    }).eq('id', vendor.id);
    setSaving(false);
    if (!error) { toast('Pwofil ou anrejistre.', 'success'); onSaved(); }
    else toast('Pwoblèm anrejistre chanjman yo.', 'error');
  };

  const verifyOtp = async () => {
    if (!pendingRequestId || !pendingOtpSecret) return;
    setOtpVerifying(true);
    try {
      if (nameOtpViaEmail && vendor.email) {
        const { verifyEmailOtp } = await import('@/lib/emailOtp');
        const { valid, error: otpErr } = await verifyEmailOtp(vendor.email, otpCode, 'email_change');
        if (!valid) {
          toast(otpErr || 'Kòd OTP la pa kòrèk oswa li ekspire.', 'error');
          return;
        }
      } else if (otpCode !== pendingOtpSecret) {
        toast('Kòd OTP la pa kòrèk oswa li ekspire.', 'error');
        return;
      }

      const { data, error } = await supabase.rpc('verify_name_change_otp', {
        p_request_id: pendingRequestId,
        p_code: pendingOtpSecret,
      });
      if (error || !data) {
        toast('Kòd OTP la pa kòrèk oswa li ekspire.', 'error');
        return;
      }
      setOtpModalOpen(false);
      setOtpCode('');
      setPendingOtpSecret(null);
      setNameChanged(true);
      toast('Demann chanjman non ou voye bay Admin pou revizyon. Ansyen non ou ap rete aktif jiskaske demann lan apwouve.', 'success');
      // Save other fields (email is managed in Settings)
      const { error: e2 } = await supabase.from('vendors').update({
        phone, address, pickup_address: pickupAddress, description,
        updated_at: new Date().toISOString(),
      }).eq('id', vendor.id);
      if (!e2) onSaved();
    } finally {
      setOtpVerifying(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      {/* Avatar */}
      <div>
        <label className="text-xs font-semibold text-slate-600">Foto Pwofil</label>
        <div className="mt-2 flex items-center gap-3">
          <div className="relative">
            <img
              src={avatarPreview ?? vendor.avatar_url ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(vendor.business_name)}&background=10b981&color=fff`}
              alt="Avatar"
              className="w-16 h-16 rounded-2xl object-cover border border-slate-200"
            />
            <label className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center cursor-pointer shadow">
              <Camera size={14} />
              <input type="file" accept="image/*" className="hidden" onChange={onPickAvatar} />
            </label>
          </div>
          <div className="flex-1">
            <p className="text-xs text-slate-500">
              Foto pwofil ou dwe montre <span className="font-semibold text-slate-700">KLÈMAN vizaj ou</span> — pa yon logo, yon foto pwodwi, oswa yon lòt imaj. Sa ede kliyan fè w konfyans.
            </p>
            {pendingAvatar && (
              <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                <Clock size={12} /> Yon foto ap tann apwobasyon Admin.
              </p>
            )}
          </div>
        </div>
      </div>

      <FormField label="Non biznis" value={businessName} onChange={setBusinessName} />
      {businessName.trim() !== vendor.business_name && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
          <KeyRound size={16} className="text-amber-600 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-700">
            Chanjman non bezwen yon kòd OTP (imèl) pou konfime idantite w, epi apwobasyon Admin. Ansyen non ou ap rete aktif jiskaske demann lan apwouve.
          </p>
        </div>
      )}
      {nameChanged && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-start gap-2">
          <Clock size={16} className="text-emerald-600 mt-0.5 shrink-0" />
          <p className="text-xs text-emerald-700">
            Demann chanjman non ou voye bay Admin pou revizyon. Ansyen non ou ap rete aktif jiskaske demann lan apwouve.
          </p>
        </div>
      )}
      <FormField label="Telefòn" value={phone} onChange={setPhone} />
      <div>
        <label className="text-xs font-semibold text-slate-600">Imèl</label>
        <input
          type="email"
          value={email}
          readOnly
          className="mt-1 w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-100 text-sm text-slate-600"
        />
        <p className="text-[11px] text-slate-400 mt-1">Chanje imèl nan Paramèt → Enfòmasyon kontak (OTP).</p>
      </div>
      <FormField label="Adrès" value={address} onChange={setAddress} />
      <FormField label="Adrès pickup" value={pickupAddress} onChange={setPickupAddress} />
      <div>
        <label className="text-xs font-semibold text-slate-600">Deskripsyon</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="mt-1 w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
        />
      </div>
      <button
        type="submit"
        disabled={saving || avatarUploading}
        className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm flex items-center justify-center gap-2 active:scale-95 transition disabled:opacity-60"
      >
        {saving || avatarUploading ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
        Anrejistre chanjman
      </button>

      <Modal open={otpModalOpen} onClose={() => setOtpModalOpen(false)} title="Konfime chanjman non">
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            {nameOtpViaEmail
              ? <>Nou voye yon kòd OTP nan imèl ou ({vendor.email}). Antre l la a pou konfime se w menm k ap mande chanjman non an.</>
              : <>Antre kòd OTP la pou konfime se w menm k ap mande chanjman non an.</>}
          </p>
          <input
            value={otpCode}
            onChange={(e) => setOtpCode(e.target.value)}
            placeholder="6 chif"
            inputMode="numeric"
            maxLength={6}
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm tracking-widest text-center focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <button
            onClick={verifyOtp}
            disabled={otpVerifying || otpCode.length !== 6}
            className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm flex items-center justify-center gap-2 active:scale-95 transition disabled:opacity-60"
          >
            {otpVerifying ? <Loader2 size={18} className="animate-spin" /> : <KeyRound size={18} />}
            Konfime OTP
          </button>
        </div>
      </Modal>
    </form>
  );
}

function FormField({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <label className="text-xs font-semibold text-slate-600">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
      />
    </div>
  );
}
