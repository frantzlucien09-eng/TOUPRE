import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/lib/toast';
import { useConfirm } from '@/lib/confirm';
import { sendEmailOtp, verifyEmailOtp } from '@/lib/emailOtp';
import type { Zone, Vendor } from '@/lib/types';
import { Header } from '@/components/Header';
import { Modal } from '@/components/Modal';
import {
  Lock, Phone, Mail, MapPin, CreditCard, Bell, Globe, HelpCircle, FileText,
  LogOut, ChevronRight, Loader2, Save, Check, ShieldCheck,
} from 'lucide-react';

type Props = { onBack: () => void };

type SettingKey =
  | 'password' | 'contact' | 'address' | 'payment' | 'notifications'
  | 'language' | 'support' | 'terms';

export function SettingsPage({ onBack }: Props) {
  const { vendor, user, signOut } = useAuth();
  const { toast } = useToast();
  const { confirm } = useConfirm();
  const [open, setOpen] = useState<SettingKey | null>(null);
  const [zones, setZones] = useState<Zone[]>([]);

  useEffect(() => {
    supabase.from('zones').select('*').order('department, city').then(({ data }) => setZones((data ?? []) as Zone[]));
  }, []);

  if (!vendor) return null;

  const departments = Array.from(new Set(zones.map((z) => z.department))).sort();
  const citiesFor = (d: string) => zones.filter((z) => z.department === d).map((z) => z.city).sort();

  const handleSignOut = async () => {
    const ok = await confirm({
      title: 'Dekonekte',
      message: 'Ou si vle dekonekte? Ou ka konekte tounen nenpòt ki lè.',
      confirmText: 'Dekonekte',
      danger: true,
    });
    if (ok) {
      await signOut();
      toast('Ou dekonekte');
    }
  };

  const items: { key: SettingKey; label: string; icon: typeof Lock; desc: string }[] = [
    { key: 'password', label: 'Chanje modpas', icon: Lock, desc: 'Mete modpas ou an sekirite' },
    { key: 'contact', label: 'Enfòmasyon kontak', icon: Phone, desc: 'Telefòn ak imèl' },
    { key: 'address', label: 'Adrès / Kote map ye', icon: MapPin, desc: 'Depatman ak vil/komin' },
    { key: 'payment', label: 'Metòd peman', icon: CreditCard, desc: 'MonCash' },
    { key: 'notifications', label: 'Notifikasyon', icon: Bell, desc: 'Push, SMS, imèl' },
    { key: 'language', label: 'Lang', icon: Globe, desc: 'Kreyòl Ayisyen' },
    { key: 'support', label: 'Sipò / Ede', icon: HelpCircle, desc: 'Kontakte sipò' },
    { key: 'terms', label: 'Kondisyon itilizasyon ak règleman', icon: FileText, desc: 'Li dokiman yo' },
  ];

  return (
    <div className="pb-24">
      <Header title="Paramèt" />

      <div className="px-4 pt-4 space-y-2">
        {items.map((it) => {
          const Icon = it.icon;
          return (
            <button
              key={it.key}
              onClick={() => setOpen(it.key)}
              className="w-full flex items-center gap-3 bg-white rounded-xl p-4 border border-slate-100 shadow-sm active:scale-95 transition text-left"
            >
              <div className="w-9 h-9 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <Icon size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-900 text-sm">{it.label}</p>
                <p className="text-xs text-slate-500 truncate">{it.desc}</p>
              </div>
              <ChevronRight size={18} className="text-slate-300" />
            </button>
          );
        })}

        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-3 bg-white rounded-xl p-4 border border-red-100 shadow-sm active:scale-95 transition text-left mt-4"
        >
          <div className="w-9 h-9 rounded-full bg-red-50 text-red-600 flex items-center justify-center shrink-0">
            <LogOut size={18} />
          </div>
          <span className="font-semibold text-red-600 text-sm">Dekonekte</span>
        </button>
      </div>

      <Modal open={open === 'password'} onClose={() => setOpen(null)} title="Chanje Modpas">
        <PasswordForm
          email={user?.email ?? ''}
          onDone={() => { setOpen(null); toast('Modpas chanje ak siksè'); }}
        />
      </Modal>

      <Modal open={open === 'contact'} onClose={() => setOpen(null)} title="Enfòmasyon Kontak">
        <ContactForm vendor={vendor} onDone={() => { setOpen(null); toast('Chanjman anrejistre'); }} />
      </Modal>

      <Modal open={open === 'address'} onClose={() => setOpen(null)} title="Adrès / Kote map ye">
        <AddressForm vendor={vendor} departments={departments} citiesFor={citiesFor} onDone={() => { setOpen(null); toast('Chanjman anrejistre'); }} />
      </Modal>

      <Modal open={open === 'payment'} onClose={() => setOpen(null)} title="Metòd Peman">
        <PaymentForm vendor={vendor} onDone={() => { setOpen(null); toast('Enfòmasyon MonCash anrejistre'); }} />
      </Modal>

      <Modal open={open === 'notifications'} onClose={() => setOpen(null)} title="Notifikasyon">
        <NotificationsForm vendorId={vendor.id} onDone={() => { setOpen(null); toast('Chanjman anrejistre'); }} />
      </Modal>

      <Modal open={open === 'language'} onClose={() => setOpen(null)} title="Lang">
        <div className="space-y-3">
          <div className="flex items-center gap-3 p-3 bg-emerald-50 rounded-xl">
            <Globe size={20} className="text-emerald-600" />
            <span className="font-semibold text-slate-900 text-sm">Kreyòl Ayisyen</span>
            <Check size={18} className="text-emerald-600 ml-auto" />
          </div>
          <p className="text-xs text-slate-500">Sèlman Kreyòl Ayisyen disponib kounye a.</p>
        </div>
      </Modal>

      <Modal open={open === 'support'} onClose={() => setOpen(null)} title="Sipò / Ede">
        <div className="space-y-3 text-sm text-slate-600">
          <p>Pou èd, kontakte ekip sipò TOUPRE:</p>
          <div className="bg-slate-50 rounded-xl p-3 space-y-2">
            <a href="mailto:toupreed@gmail.com" className="flex items-center gap-2 text-emerald-600 font-semibold hover:underline">
              <Mail size={16} /> toupreed@gmail.com
            </a>
          </div>
          <p className="text-xs text-slate-500">Voye nou yon imèl, n ap reponn ou pi vit posib.</p>
        </div>
      </Modal>

      <Modal open={open === 'terms'} onClose={() => setOpen(null)} title="Kondisyon Itilizasyon">
        <div className="space-y-3 text-xs text-slate-600 leading-relaxed">
          <p>1. TOUPRE se yon platfòm mache pou vandè ak kliyan ayisyen.</p>
          <p>2. Tout transaksyon yo fèt an Goud Ayisyen (HTG) via MonCash.</p>
          <p>3. Vandè yo dwe respekte kliyan yo e livrer kòmand an tan.</p>
          <p>4. Nòt konfyans ka desann -25% pou chak erè oswa vyolasyon règleman.</p>
          <p>5. Admin ka sispann yon kont si gen pwoblèm.</p>
          <p>6. Rekonpans Top Vandè yo peye chak mwa: 25,000 G (Zòn), 50,000 G (Nasyonal).</p>
          <p>7. Tout enfòmasyon yo pataje ant 3 aplikasyon yo (Vandè, Kliyan, Admin) an tan reyèl.</p>
          <p className="font-semibold text-slate-700 mt-2">Nòt espesyal pou Kay ak Machin:</p>
          <p>Pou tranzaksyon Kay ak Machin, TOUPRE sèvi sèlman kòm platfòm piblisite — nou pa verifye, garanti, ni patisipe nan tranzaksyon final ant kliyan ak vandè pou kategori sa yo. Fè prekosyon w e verifye tout dokiman anvan nenpòt echanj lajan oswa randevou fizik. Vandè peye 2,500 HTG pa MonCash pou pibliye chak anons.</p>
          <p className="font-semibold text-slate-700 mt-3">Kontak Ofisyèl:</p>
          <a href="mailto:toupreed@gmail.com" className="flex items-center gap-2 text-emerald-600 font-semibold hover:underline">
            <Mail size={14} /> toupreed@gmail.com
          </a>
          <p className="text-xs text-slate-500">Voye nou yon imèl, n ap reponn ou pi vit posib.</p>
        </div>
      </Modal>
    </div>
  );
}

function PasswordForm({ email, onDone }: { email: string; onDone: () => void }) {
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPwd) { toast('Tanpri antre modpas aktyèl ou.', 'error'); return; }
    if (newPwd.length < 6) { toast('Modpas nouvo dwe gen 6 karaktè minimum', 'error'); return; }
    if (newPwd !== confirm) { toast('Modpas yo pa parèy', 'error'); return; }
    if (newPwd === currentPwd) { toast('Modpas nouvo pa ka menm ak modpas aktyèl la.', 'error'); return; }
    setLoading(true);

    // Verify current password by re-authenticating
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password: currentPwd,
    });
    if (signInError) {
      setLoading(false);
      toast('Modpas aktyèl la pa kòrèk.', 'error');
      return;
    }

    // Current password verified — update to new password
    const { error: updateError } = await supabase.auth.updateUser({ password: newPwd });
    setLoading(false);
    if (updateError) { toast('Erè, eseye ankò', 'error'); return; }
    setCurrentPwd('');
    setNewPwd('');
    setConfirm('');
    onDone();
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <label className="text-xs font-semibold text-slate-600">Modpas aktyèl</label>
        <input type="password" value={currentPwd} onChange={(e) => setCurrentPwd(e.target.value)} placeholder="Modpas aktyèl" className="mt-1 w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
      </div>
      <div>
        <label className="text-xs font-semibold text-slate-600">Modpas nouvo</label>
        <input type="password" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} placeholder="Modpas nouvo (min 6 karaktè)" className="mt-1 w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
      </div>
      <div>
        <label className="text-xs font-semibold text-slate-600">Konfime modpas nouvo</label>
        <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Konfime modpas" className="mt-1 w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
      </div>
      <button type="submit" disabled={loading} className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm flex items-center justify-center gap-2 active:scale-95 transition disabled:opacity-60">
        {loading ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />} Chanje Modpas
      </button>
    </form>
  );
}

function ContactForm({ vendor, onDone }: { vendor: Vendor; onDone: () => void }) {
  const { toast } = useToast();
  const { refreshVendor } = useAuth();
  const [phone, setPhone] = useState(vendor.phone ?? '');
  const [email, setEmail] = useState(vendor.email ?? '');
  const [loading, setLoading] = useState(false);
  const [emailChanged, setEmailChanged] = useState(false);
  const [otpStep, setOtpStep] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [resendTimer, setResendTimer] = useState(0);

  useEffect(() => {
    if (resendTimer <= 0) return;
    const t = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
    return () => clearTimeout(t);
  }, [resendTimer]);

  useEffect(() => {
    setEmailChanged(email.trim().toLowerCase() !== (vendor.email ?? '').trim().toLowerCase());
  }, [email, vendor.email]);

  const sendOtp = async () => {
    setLoading(true);
    try {
      const result = await sendEmailOtp(email.trim(), 'email_change');
      if (!result.success) {
        toast(result.error ?? 'Erè, eseye ankò', 'error');
        return;
      }
      setDevCode(result.code ?? null);
      setOtpStep(true);
      setResendTimer(45);
      toast(`Kòd konfimasyon voye bay ${email}`, 'success');
    } finally {
      setLoading(false);
    }
  };

  const confirmOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otpCode.length !== 6) { toast('Tanpri antre 6 chif yo.', 'error'); return; }
    setLoading(true);
    try {
      const { valid, error } = await verifyEmailOtp(email.trim(), otpCode, 'email_change');
      if (!valid) { toast(error ?? 'Kòd la pa kòrèk.', 'error'); return; }

      // OTP verified — update email in auth and vendors table
      const { error: authError } = await supabase.auth.updateUser({ email: email.trim() });
      if (authError) {
        toast('Erè, eseye ankò', 'error');
        return;
      }
      await supabase.from('vendors').update({ email, updated_at: new Date().toISOString() }).eq('id', vendor.id);
      await refreshVendor();
      toast('Imèl ou chanje ak siksè.');
      onDone();
    } finally {
      setLoading(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (emailChanged) {
      // Email changed — start OTP flow instead of saving directly
      await sendOtp();
      return;
    }
    setLoading(true);
    const { error } = await supabase.from('vendors').update({ phone, updated_at: new Date().toISOString() }).eq('id', vendor.id);
    setLoading(false);
    if (error) { toast(error.message || 'Erè, eseye ankò', 'error'); return; }
    await refreshVendor();
    onDone();
  };

  if (otpStep) {
    return (
      <div className="space-y-3">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-2">
            <ShieldCheck size={24} />
          </div>
          <p className="text-sm text-slate-600">
            Nou voye yon kòd bay <span className="font-semibold text-slate-800">{email}</span>. Antre l la a pou konfime chanjman imèl ou.
          </p>
          <p className="text-[11px] text-slate-400 mt-1">Ansyen imèl ou ap rete aktif jiskaske nouvo a konfime.</p>
        </div>
        {import.meta.env.DEV && devCode && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 text-center">
            <p className="text-xs text-amber-700">Kòd dev (tanporè): <span className="font-bold tracking-widest">{devCode}</span></p>
          </div>
        )}
        <form onSubmit={confirmOtp} className="space-y-3">
          <input
            value={otpCode}
            onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="6 chif"
            inputMode="numeric"
            maxLength={6}
            className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm tracking-widest text-center focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <button type="submit" disabled={loading} className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm flex items-center justify-center gap-2 active:scale-95 transition disabled:opacity-60">
            {loading ? <Loader2 size={18} className="animate-spin" /> : <ShieldCheck size={18} />} Konfime Chanjman
          </button>
        </form>
        <div className="flex items-center justify-between">
          <button onClick={() => setOtpStep(false)} className="text-xs text-slate-500 font-medium hover:underline">
            Retounen
          </button>
          <button onClick={sendOtp} disabled={resendTimer > 0 || loading} className="text-xs text-emerald-600 font-semibold hover:underline disabled:opacity-40">
            {resendTimer > 0 ? `Voye ankò (${resendTimer}s)` : 'Voye Kòd Ankò'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <label className="text-xs font-semibold text-slate-600">Telefòn</label>
        <input value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1 w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
      </div>
      <div>
        <label className="text-xs font-semibold text-slate-600">Imèl</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
      </div>
      {emailChanged && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
          <p className="text-xs text-amber-700">
            Ou chanje imèl ou. Nou ap voye yon kòd konfimasyon bay nouvo imèl la anvan n aplike chanjman an. Ansyen imèl ou ap rete aktiv jiskaske nouvo a konfime.
          </p>
        </div>
      )}
      <button type="submit" disabled={loading} className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm flex items-center justify-center gap-2 active:scale-95 transition disabled:opacity-60">
        {loading ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />} {emailChanged ? 'Voye Kòd Konfimasyon' : 'Anrejistre'}
      </button>
    </form>
  );
}

function AddressForm({
  vendor, departments, citiesFor, onDone,
}: {
  vendor: any;
  departments: string[];
  citiesFor: (d: string) => string[];
  onDone: () => void;
}) {
  const { refreshVendor } = useAuth();
  const { toast } = useToast();
  const [department, setDepartment] = useState(vendor.department ?? '');
  const [city, setCity] = useState(vendor.city ?? '');
  const [otherCity, setOtherCity] = useState('');
  const [address, setAddress] = useState(vendor.address ?? '');
  const [loading, setLoading] = useState(false);

  const cities = department ? citiesFor(department) : [];
  const finalCity = city === '__other' ? otherCity : city;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.from('vendors').update({
      department, city: finalCity, address, updated_at: new Date().toISOString(),
    }).eq('id', vendor.id);
    setLoading(false);
    if (error) { toast(error.message || 'Erè, eseye ankò', 'error'); return; }
    await refreshVendor();
    onDone();
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <label className="text-xs font-semibold text-slate-600">Depatman</label>
        <select value={department} onChange={(e) => { setDepartment(e.target.value); setCity(''); }} className="mt-1 w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
          <option value="">Chwazi...</option>
          {departments.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>
      <div>
        <label className="text-xs font-semibold text-slate-600">Vil / Komin</label>
        <select value={city} onChange={(e) => setCity(e.target.value)} disabled={!department} className="mt-1 w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50">
          <option value="">Chwazi...</option>
          {cities.map((c) => <option key={c} value={c}>{c}</option>)}
          <option value="__other">Lòt vil (Ekri l)</option>
        </select>
      </div>
      {city === '__other' && (
        <input value={otherCity} onChange={(e) => setOtherCity(e.target.value)} placeholder="Non vil la" className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
      )}
      <div>
        <label className="text-xs font-semibold text-slate-600">Adrès</label>
        <input value={address} onChange={(e) => setAddress(e.target.value)} className="mt-1 w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
      </div>
      <button type="submit" disabled={loading} className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm flex items-center justify-center gap-2 active:scale-95 transition disabled:opacity-60">
        {loading ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />} Anrejistre
      </button>
    </form>
  );
}

function notifPrefsKey(vendorId: string) {
  return `toupre_vendor_notif_prefs_${vendorId}`;
}

function NotificationsForm({ vendorId, onDone }: { vendorId: string; onDone: () => void }) {
  const [push, setPush] = useState(true);
  const [sms, setSms] = useState(true);
  const [email, setEmail] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(notifPrefsKey(vendorId));
      if (!raw) return;
      const parsed = JSON.parse(raw) as { push?: boolean; sms?: boolean; email?: boolean };
      if (typeof parsed.push === 'boolean') setPush(parsed.push);
      if (typeof parsed.sms === 'boolean') setSms(parsed.sms);
      if (typeof parsed.email === 'boolean') setEmail(parsed.email);
    } catch {
      // ignore corrupt local prefs
    }
  }, [vendorId]);

  const Toggle = ({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) => (
    <button type="button" onClick={() => onChange(!value)} className="w-full flex items-center justify-between p-3 bg-slate-50 rounded-xl">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <span className={`w-11 h-6 rounded-full transition relative ${value ? 'bg-emerald-500' : 'bg-slate-300'}`}>
        <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${value ? 'left-[22px]' : 'left-0.5'}`} />
      </span>
    </button>
  );

  const save = async () => {
    setLoading(true);
    const prefs = { push, sms, email, updated_at: new Date().toISOString() };
    localStorage.setItem(notifPrefsKey(vendorId), JSON.stringify(prefs));
    // Best-effort sync into settings table when available
    await supabase.from('settings').upsert({
      key: `vendor_notifications:${vendorId}`,
      value: JSON.stringify(prefs),
      label: 'Vendor notification preferences',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'key' });
    setLoading(false);
    onDone();
  };

  return (
    <div className="space-y-3">
      <Toggle label="Push" value={push} onChange={setPush} />
      <Toggle label="SMS" value={sms} onChange={setSms} />
      <Toggle label="Imèl" value={email} onChange={setEmail} />
      <button onClick={save} disabled={loading} className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm flex items-center justify-center gap-2 active:scale-95 transition disabled:opacity-60">
        {loading ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />} Anrejistre
      </button>
    </div>
  );
}

function PaymentForm({ vendor, onDone }: { vendor: Vendor; onDone: () => void }) {
  const { refreshVendor } = useAuth();
  const { toast } = useToast();
  const [phone, setPhone] = useState(vendor.moncash_phone ?? '');
  const [name, setName] = useState(vendor.moncash_name ?? '');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim() || !name.trim()) {
      toast('Tanpri antre nimewo ak non MonCash', 'error');
      return;
    }
    setLoading(true);
    const { error } = await supabase.from('vendors').update({
      moncash_phone: phone.trim(),
      moncash_name: name.trim(),
      updated_at: new Date().toISOString(),
    }).eq('id', vendor.id);
    setLoading(false);
    if (error) { toast(error.message || 'Erè, eseye ankò', 'error'); return; }
    await refreshVendor();
    onDone();
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="flex items-center gap-3 p-3 bg-emerald-50 rounded-xl">
        <CreditCard size={20} className="text-emerald-600" />
        <div>
          <p className="font-semibold text-slate-900 text-sm">MonCash</p>
          <p className="text-xs text-slate-500">Sèl metòd peman disponib</p>
        </div>
        <Check size={18} className="text-emerald-600 ml-auto" />
      </div>
      <div>
        <label className="text-xs font-semibold text-slate-600">Nimewo MonCash</label>
        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+509 3700 0000" className="mt-1 w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
      </div>
      <div>
        <label className="text-xs font-semibold text-slate-600">Non sou kont MonCash</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Non konplè" className="mt-1 w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
      </div>
      <p className="text-xs text-slate-500">Peman pou kliyan ak retrè pou vandè sèlman via MonCash.</p>
      <button type="submit" disabled={loading} className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm flex items-center justify-center gap-2 active:scale-95 transition disabled:opacity-60">
        {loading ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />} Anrejistre
      </button>
    </form>
  );
}
