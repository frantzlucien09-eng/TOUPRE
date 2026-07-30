import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/lib/toast';
import { sendEmailOtp, resetPasswordViaOtp } from '@/lib/emailOtp';
import { Logo } from '@/components/Logo';
import { Mail, Lock, Loader2, ArrowLeft, ArrowRight, KeyRound, ShieldCheck, User, MapPin, Phone, CheckCircle2, FileText } from 'lucide-react';
import { GoogleSignInButton } from '@/components/GoogleSignInButton';

type Mode = 'login' | 'register' | 'verify' | 'forgot' | 'reset';
type AccountType = 'customer' | 'vendor';

const DEPARTMENTS = [
  'Artibonite', 'Centre', "Grand'Anse", 'Nippes', 'Nord', 'Nord-Est',
  'Nord-Ouest', 'Ouest', 'Sud', 'Sud-Est',
];

const REG_STEPS = [
  { key: 'personal', label: 'Enfòmasyon Pèsonèl', icon: User },
  { key: 'address', label: 'Adrès', icon: MapPin },
  { key: 'phone', label: 'Telefòn', icon: Phone },
  { key: 'email', label: 'Imèl', icon: Mail },
  { key: 'password', label: 'Modpas', icon: Lock },
  { key: 'terms', label: 'Tèm ak Kondisyon', icon: FileText },
] as const;

export function AuthPage() {
  const [mode, setMode] = useState<Mode>('login');
  const [accountType, setAccountType] = useState<AccountType>('customer');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const [devCode, setDevCode] = useState<string | null>(null);
  const { toast } = useToast();
  const { reloadVendor } = useAuth();

  // Registration wizard state
  const [regStep, setRegStep] = useState(0);
  const [regData, setRegData] = useState({
    fullName: '',
    display_name: '',
    department: '',
    city: '',
    address: '',
    phone: '',
    email: '',
    password: '',
    confirmPassword: '',
    termsAccepted: false,
  otpCode: '',
  });
  const [regError, setRegError] = useState('');

  useEffect(() => {
    if (resendTimer <= 0) return;
    const t = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
    return () => clearTimeout(t);
  }, [resendTimer]);

  const setReg = (field: keyof typeof regData, value: string | boolean) => {
    setRegData((prev) => ({ ...prev, [field]: value }));
    setRegError('');
  };

  // ── Login ──
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) { toast('Tanpri antre imèl ou.', 'error'); return; }
    if (!password.trim()) { toast('Tanpri antre modpas ou.', 'error'); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (data.user) await reloadVendor(data.user.id);
      toast('Konekte ak siksè');
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      let msg: string;
      if (/rate limit/i.test(raw)) {
        msg = 'Twòp tantativ resamman — tanpri tann kèk minit anvan w eseye ankò.';
      } else if (/invalid credentials|invalid login/i.test(raw)) {
        msg = 'Imèl oswa modpas la pa kòrèk.';
      } else {
        msg = raw || 'Erè, eseye ankò';
      }
      toast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  // ── Forgot password ──
  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) { toast('Tanpri antre imèl ou.', 'error'); return; }
    setLoading(true);
    try {
      const result = await sendEmailOtp(email.trim(), 'password_reset');
      if (!result.success) {
        toast(result.error ?? 'Erè, eseye ankò', 'error');
        return;
      }
      setDevCode(result.code ?? null);
      setMode('reset');
      setResendTimer(45);
      toast(`Kòd pou reyajiste modpas voye bay ${email}`, 'success');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otpCode.length !== 6) { toast('Tanpri antre 6 chif yo.', 'error'); return; }
    if (newPassword.length < 6) { toast('Modpas dwe gen omwen 6 karaktè.', 'error'); return; }
    if (newPassword !== confirmPassword) { toast('Modpas yo pa parèy.', 'error'); return; }
    setLoading(true);
    try {
      const { success, error } = await resetPasswordViaOtp(email.trim(), otpCode, newPassword);
      if (!success) { toast(error ?? 'Erè, eseye ankò', 'error'); return; }
      toast('Modpas ou chanje ak siksè. Ou ka konekte kounye a.');
      setMode('login');
      setPassword('');
      setOtpCode('');
      setNewPassword('');
      setConfirmPassword('');
      setDevCode(null);
    } catch {
      toast('Erè, eseye ankò', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendTimer > 0) return;
    setLoading(true);
    try {
      const result = await sendEmailOtp(email.trim(), 'password_reset');
      if (!result.success) {
        toast(result.error ?? 'Erè, eseye ankò', 'error');
        return;
      }
      setDevCode(result.code ?? null);
      setResendTimer(45);
      toast('Kòd nouvo a voye.', 'success');
    } finally {
      setLoading(false);
    }
  };

  // ── Registration step validation ──
  const validateRegStep = (): boolean => {
    setRegError('');
    const d = regData;
    switch (REG_STEPS[regStep].key) {
      case 'personal':
        if (!d.fullName.trim()) { setRegError('Tanpri antre non konplè ou.'); return false; }
        return true;
      case 'address':
        if (!d.department) { setRegError('Tanpri chwazi depatman ou.'); return false; }
        if (!d.city.trim()) { setRegError('Tanpri antre vil/komin ou.'); return false; }
        return true;
      case 'phone':
        if (!d.phone.trim()) { setRegError('Tanpri antre nimewo telefòn ou.'); return false; }
        if (d.phone.replace(/\D/g, '').length < 8) { setRegError('Nimewo telefòn ou pa valab.'); return false; }
        return true;
      case 'email':
        if (!d.email.trim()) { setRegError('Tanpri antre imèl ou.'); return false; }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email.trim())) { setRegError('Imèl ou pa valab.'); return false; }
        return true;
      case 'password':
        if (d.password.length < 6) { setRegError('Modpas dwe gen omwen 6 karaktè.'); return false; }
        if (d.password !== d.confirmPassword) { setRegError('Modpas yo pa parèy.'); return false; }
        return true;
      case 'terms':
        if (!d.termsAccepted) { setRegError('Ou dwe aksepte tèm ak kondisyon yo pou w kontinye.'); return false; }
        return true;
    }
    return false;
  };

  const handleRegNext = () => {
    if (!validateRegStep()) return;
    if (regStep < REG_STEPS.length - 1) {
      setRegStep(regStep + 1);
    }
  };

  const handleRegBack = () => {
    setRegError('');
    if (regStep > 0) setRegStep(regStep - 1);
  };

  // ── Final account creation ──
  const handleCreateAccount = async () => {
    if (!validateRegStep()) return;
    setLoading(true);
    setRegError('');
    try {
      const displayName = regData.display_name.trim() || regData.fullName.trim();
      const role = accountType === 'vendor' ? 'vendor' : 'customer';
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: regData.email.trim(),
        password: regData.password,
        options: {
          data: {
            role,
            full_name: regData.fullName.trim(),
            display_name: displayName,
            business_name: accountType === 'vendor' ? displayName : undefined,
            phone: regData.phone.trim(),
            department: regData.department,
            city: regData.city.trim(),
            address: regData.address.trim(),
          },
        },
      });
      if (signUpError) throw signUpError;
      if (!data.user) throw new Error('Kont pa t kreye. Eseye ankò.');

      if (accountType === 'vendor') {
        const { data: existingVendor } = await supabase
          .from('vendors')
          .select('id')
          .eq('user_id', data.user.id)
          .maybeSingle();

        if (existingVendor) {
          await supabase.from('vendors').update({
            business_name: displayName,
            email: regData.email.trim(),
            phone: regData.phone.trim(),
            department: regData.department,
            city: regData.city.trim(),
            address: regData.address.trim(),
            status: 'pending',
            updated_at: new Date().toISOString(),
          }).eq('id', existingVendor.id);
        } else {
          const { error: vendError } = await supabase.from('vendors').insert({
            user_id: data.user.id,
            business_name: displayName,
            email: regData.email.trim(),
            phone: regData.phone.trim(),
            department: regData.department,
            city: regData.city.trim(),
            address: regData.address.trim(),
            status: 'pending',
            terms_accepted_at: new Date().toISOString(),
            privacy_accepted_at: new Date().toISOString(),
            vendor_terms_accepted_at: new Date().toISOString(),
            terms_version: '2026-07-30',
            privacy_version: '2026-07-30',
            vendor_terms_version: '2026-07-30',
          });
          if (vendError) {
            console.error('[register] vendor insert error:', vendError.message);
            throw new Error(vendError.message || 'Pa t kapab kreye pwofil vandè.');
          }
        }
        await supabase.from('profiles').update({ role: 'vendor' }).eq('user_id', data.user.id);
        toast('Kont vandè kreye ak siksè! Konplete KYC pou kòmanse.', 'success');
      } else {
        const { data: existingCustomer } = await supabase
          .from('customers')
          .select('id')
          .or(`id.eq.${data.user.id},user_id.eq.${data.user.id}`)
          .maybeSingle();

        if (existingCustomer) {
          await supabase.from('customers').update({
            user_id: data.user.id,
            full_name: regData.fullName.trim(),
            email: regData.email.trim(),
            phone: regData.phone.trim(),
            department: regData.department,
            city: regData.city.trim(),
            address: regData.address.trim(),
          }).eq('id', existingCustomer.id);
        } else {
          const { error: custError } = await supabase.from('customers').insert({
            id: data.user.id,
            user_id: data.user.id,
            full_name: regData.fullName.trim(),
            email: regData.email.trim(),
            phone: regData.phone.trim(),
            department: regData.department,
            city: regData.city.trim(),
            address: regData.address.trim(),
            terms_accepted_at: new Date().toISOString(),
            privacy_accepted_at: new Date().toISOString(),
            terms_version: '2026-07-30',
            privacy_version: '2026-07-30',
          });
          if (custError) {
            console.error('[register] customer insert error:', custError.message);
            throw new Error(custError.message || 'Pa t kapab kreye pwofil kliyan.');
          }
        }
        await supabase.from('profiles').update({ role: 'customer' }).eq('user_id', data.user.id);
        toast('Kont kliyan kreye ak siksè! Byenveni sou TOUPRE.', 'success');
      }

      await reloadVendor(data.user.id);
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      if (/already registered|user already/i.test(raw)) {
        setRegError('Gen yon kont ki egziste deja ak imèl sa a. Eseye konekte.');
      } else {
        setRegError(raw || 'Erè, eseye ankò');
      }
    } finally {
      setLoading(false);
    }
  };

  const startRegister = () => {
    setMode('register');
    setRegStep(0);
    setRegError('');
    setRegData({
      fullName: '', display_name: '', department: '', city: '', address: '',
      phone: '', email: '', password: '', confirmPassword: '',
      termsAccepted: false, otpCode: '',
    });
  };

  // ── Render ──
  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 via-slate-50 to-slate-50 flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-10">
        <div className="mb-8 flex flex-col items-center">
          <Logo size="lg" />
          <p className="text-slate-500 text-sm mt-3 text-center max-w-xs">
            {accountType === 'vendor'
              ? 'Platfòm mache pou vandè ayisyen — jere pwodwi, kòmand, ak lajan ou.'
              : 'Mache TOUPRE — achte pwodwi lokal, pase kòmand, swiv livrezon.'}
          </p>
        </div>

        <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl border border-slate-100 p-6">
          {/* Account type — shared for login / register */}
          {(mode === 'login' || mode === 'register') && (
            <div className="flex gap-1 p-1 bg-slate-100 rounded-xl mb-4">
              <TabButton active={accountType === 'customer'} label="Kliyan" onClick={() => setAccountType('customer')} />
              <TabButton active={accountType === 'vendor'} label="Vandè" onClick={() => setAccountType('vendor')} />
            </div>
          )}

          {/* LOGIN */}
          {mode === 'login' && (
            <>
              <div className="flex gap-1 p-1 bg-slate-100 rounded-xl mb-5">
                <TabButton active label="Konekte" />
                <TabButton active={false} label="Enskri" onClick={startRegister} />
              </div>
              <form onSubmit={handleLogin} className="space-y-3">
                <Field icon={<Mail size={18} />} type="email" placeholder="Imèl" value={email} onChange={setEmail} required />
                <Field icon={<Lock size={18} />} type="password" placeholder="Modpas" value={password} onChange={setPassword} required />
                <button type="submit" disabled={loading} className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm flex items-center justify-center gap-2 active:scale-95 transition disabled:opacity-60">
                  {loading && <Loader2 size={18} className="animate-spin" />} Konekte
                </button>
              </form>
              <button onClick={() => setMode('forgot')} className="w-full text-center text-xs text-emerald-600 font-semibold hover:underline mt-3">
                Mwen bliye modpas mwen
              </button>
              <div className="flex items-center gap-3 my-4">
                <div className="flex-1 h-px bg-slate-200" />
                <span className="text-xs text-slate-400">oswa</span>
                <div className="flex-1 h-px bg-slate-200" />
              </div>
              <GoogleSignInButton context={accountType} />
              <p className="text-center text-xs text-slate-400 mt-3">
                Pa gen kont?{' '}
                <button onClick={startRegister} className="text-emerald-600 font-semibold hover:underline">Enskri kounye a</button>
              </p>
            </>
          )}

          {/* REGISTER — multi-step wizard */}
          {mode === 'register' && (
            <RegisterWizard
              step={regStep}
              data={regData}
              error={regError}
              loading={loading}
              onSet={setReg}
              onNext={handleRegNext}
              onBack={handleRegBack}
              onCreate={handleCreateAccount}
              onSwitchLogin={() => { setMode('login'); setRegError(''); }}
            />
          )}

          {/* VERIFY (signup confirmation) — kept for OTP if needed later */}
          {mode === 'verify' && (
            <>
              <div className="text-center mb-5">
                <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-3">
                  <ShieldCheck size={28} />
                </div>
                <h2 className="font-bold text-slate-900 text-base">Konfime Imèl Ou</h2>
                <p className="text-xs text-slate-500 mt-1">
                  Nou voye yon kòd 6 chif bay <span className="font-semibold text-slate-700">{email}</span>. Antre l la a.
                </p>
              </div>
              {import.meta.env.DEV && devCode && (
                <div className="mb-3 bg-amber-50 border border-amber-200 rounded-xl p-2.5 text-center">
                  <p className="text-xs text-amber-700">Kòd dev (tanporè): <span className="font-bold tracking-widest">{devCode}</span></p>
                </div>
              )}
              <form onSubmit={(e) => { e.preventDefault(); }} className="space-y-3">
                <input
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="6 chif"
                  inputMode="numeric"
                  maxLength={6}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm tracking-widest text-center focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <button type="submit" disabled={loading} className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm flex items-center justify-center gap-2 active:scale-95 transition disabled:opacity-60">
                  {loading && <Loader2 size={18} className="animate-spin" />} Konfime Kòd
                </button>
              </form>
              <div className="flex items-center justify-between mt-3">
                <button onClick={() => setMode('login')} className="text-xs text-slate-500 font-medium hover:underline flex items-center gap-1">
                  <ArrowLeft size={14} /> Retounen
                </button>
                <button onClick={handleResend} disabled={resendTimer > 0 || loading} className="text-xs text-emerald-600 font-semibold hover:underline disabled:opacity-40">
                  {resendTimer > 0 ? `Voye ankò (${resendTimer}s)` : 'Voye Kòd Ankò'}
                </button>
              </div>
            </>
          )}

          {/* FORGOT — enter email */}
          {mode === 'forgot' && (
            <>
              <div className="text-center mb-5">
                <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-3">
                  <KeyRound size={28} />
                </div>
                <h2 className="font-bold text-slate-900 text-base">Mwen Bliye Modpas</h2>
                <p className="text-xs text-slate-500 mt-1">Antre imèl ou, n ap voye yon kòd pou reyajiste modpas ou.</p>
              </div>
              <form onSubmit={handleForgot} className="space-y-3">
                <Field icon={<Mail size={18} />} type="email" placeholder="Imèl" value={email} onChange={setEmail} required />
                <button type="submit" disabled={loading} className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm flex items-center justify-center gap-2 active:scale-95 transition disabled:opacity-60">
                  {loading && <Loader2 size={18} className="animate-spin" />} Voye Kòd
                </button>
              </form>
              <button onClick={() => setMode('login')} className="w-full text-center text-xs text-slate-500 font-medium hover:underline mt-3 flex items-center justify-center gap-1">
                <ArrowLeft size={14} /> Retounen nan konekte
              </button>
            </>
          )}

          {/* RESET — enter code + new password */}
          {mode === 'reset' && (
            <>
              <div className="text-center mb-5">
                <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-3">
                  <KeyRound size={28} />
                </div>
                <h2 className="font-bold text-slate-900 text-base">Reyajiste Modpas</h2>
                <p className="text-xs text-slate-500 mt-1">
                  Antre kòd a voye bay <span className="font-semibold text-slate-700">{email}</span> ak nouvo modpas ou.
                </p>
              </div>
              {import.meta.env.DEV && devCode && (
                <div className="mb-3 bg-amber-50 border border-amber-200 rounded-xl p-2.5 text-center">
                  <p className="text-xs text-amber-700">Kòd dev (tanporè): <span className="font-bold tracking-widest">{devCode}</span></p>
                </div>
              )}
              <form onSubmit={handleReset} className="space-y-3">
                <input
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="Kòd (6 chif)"
                  inputMode="numeric"
                  maxLength={6}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm tracking-widest text-center focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <Field icon={<Lock size={18} />} type="password" placeholder="Modpas nouvo (min 6 karaktè)" value={newPassword} onChange={setNewPassword} required />
                <Field icon={<Lock size={18} />} type="password" placeholder="Konfime modpas nouvo" value={confirmPassword} onChange={setConfirmPassword} required />
                <button type="submit" disabled={loading} className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm flex items-center justify-center gap-2 active:scale-95 transition disabled:opacity-60">
                  {loading && <Loader2 size={18} className="animate-spin" />} Reyajiste Modpas
                </button>
              </form>
              <button onClick={handleResend} disabled={resendTimer > 0 || loading} className="w-full text-center text-xs text-emerald-600 font-semibold hover:underline mt-3 disabled:opacity-40">
                {resendTimer > 0 ? `Voye ankò (${resendTimer}s)` : 'Voye Kòd Ankò'}
              </button>
            </>
          )}
        </div>

        <div className="mt-6 flex items-center gap-2 text-xs text-slate-400">
          <img src="/toupre_vande_logo.png" alt="TOUPRE" className="w-3.5 h-3.5 object-contain" />
          <span>Peman sèlman via MonCash · Lajan an Goud Ayisyen</span>
        </div>
      </div>
    </div>
  );
}

// ── Multi-step Registration Wizard ──
function RegisterWizard({
  step, data, error, loading, onSet, onNext, onBack, onCreate, onSwitchLogin,
}: {
  step: number;
  data: {
    fullName: string; display_name: string; department: string; city: string;
    address: string; phone: string; email: string; password: string;
    confirmPassword: string; termsAccepted: boolean;
  };
  error: string;
  loading: boolean;
  onSet: (field: keyof typeof data, value: string | boolean) => void;
  onNext: () => void;
  onBack: () => void;
  onCreate: () => void;
  onSwitchLogin: () => void;
}) {
  const isLast = step === REG_STEPS.length - 1;
  const StepIcon = REG_STEPS[step].icon;

  return (
    <div>
      {/* Header with back + step indicator */}
      <div className="flex items-center gap-2 mb-4">
        <button onClick={onBack} disabled={step === 0} className="text-slate-400 disabled:opacity-30 hover:text-slate-600 transition">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1 flex gap-1">
          {REG_STEPS.map((s, i) => (
            <div
              key={s.key}
              className={`flex-1 h-1.5 rounded-full transition ${i <= step ? 'bg-emerald-500' : 'bg-slate-200'}`}
            />
          ))}
        </div>
        <span className="text-xs text-slate-400 font-medium">{step + 1}/{REG_STEPS.length}</span>
      </div>

      {/* Step icon + title */}
      <div className="text-center mb-5">
        <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-2">
          <StepIcon size={24} />
        </div>
        <h2 className="font-bold text-slate-900 text-base">{REG_STEPS[step].label}</h2>
      </div>

      {/* Step content */}
      <div className="space-y-3">
        {/* Step 1: Personal Info */}
        {REG_STEPS[step].key === 'personal' && (
          <>
            <RegInput
              label="Non Konplè"
              placeholder="Egz: Jan Pièr Oben"
              value={data.fullName}
              onChange={(v) => onSet('fullName', v)}
              autoFocus
            />
            <RegInput
              label="Non Jodi (opsyonèl)"
              placeholder="Kòm w vle lòt moun wè"
              value={data.display_name}
              onChange={(v) => onSet('display_name', v)}
            />
          </>
        )}

        {/* Step 2: Address */}
        {REG_STEPS[step].key === 'address' && (
          <>
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">Depatman</label>
              <select
                value={data.department}
                onChange={(e) => onSet('department', e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">Chwazi depatman...</option>
                {DEPARTMENTS.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
            <RegInput
              label="Vil / Komin"
              placeholder="Egz: Pétion-Ville"
              value={data.city}
              onChange={(v) => onSet('city', v)}
            />
            <RegInput
              label="Adrès (opsyonèl)"
              placeholder="Rue, katye, referans..."
              value={data.address}
              onChange={(v) => onSet('address', v)}
            />
          </>
        )}

        {/* Step 3: Phone */}
        {REG_STEPS[step].key === 'phone' && (
          <>
            <RegInput
              label="Nimewo Telefòn"
              placeholder="+509 3700 0000"
              value={data.phone}
              onChange={(v) => onSet('phone', v)}
              type="tel"
              autoFocus
            />
            <p className="text-xs text-slate-400">N ap itilize nimewo sa a pou w kontakte w apwopo.</p>
          </>
        )}

        {/* Step 4: Email */}
        {REG_STEPS[step].key === 'email' && (
          <>
            <RegInput
              label="Imèl"
              placeholder="ekzanp@gmail.com"
              value={data.email}
              onChange={(v) => onSet('email', v)}
              type="email"
              autoFocus
            />
            <p className="text-xs text-slate-400">N ap voye konfimasyon bay imèl sa a.</p>
          </>
        )}

        {/* Step 5: Password */}
        {REG_STEPS[step].key === 'password' && (
          <>
            <RegInput
              label="Modpas"
              placeholder="Minimòm 6 karaktè"
              value={data.password}
              onChange={(v) => onSet('password', v)}
              type="password"
              autoFocus
            />
            <RegInput
              label="Konfime Modpas"
              placeholder="Antre modpas ou ankò"
              value={data.confirmPassword}
              onChange={(v) => onSet('confirmPassword', v)}
              type="password"
            />
          </>
        )}

        {/* Step 6: Terms */}
        {REG_STEPS[step].key === 'terms' && (
          <div className="space-y-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 max-h-48 overflow-y-auto space-y-2">
              <h3 className="font-semibold text-slate-900 text-sm">Akseptasyon Legal TOUPRE</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Ou dwe aksepte Tèm ak Kondisyon epi Règleman sou Vi Prive pou kreye yon kont.
                Vandè yo aksepte tou Tèm Vandè yo.
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                <a href="#/legal/terms" className="text-[11px] text-emerald-700 font-semibold underline">Tèm</a>
                <a href="#/legal/privacy" className="text-[11px] text-emerald-700 font-semibold underline">Vi Prive</a>
                <a href="#/legal/vendor-terms" className="text-[11px] text-emerald-700 font-semibold underline">Akò Vandè</a>
                <a href="#/legal/payment-policy" className="text-[11px] text-emerald-700 font-semibold underline">Peman</a>
                <a href="#/legal/classified-policy" className="text-[11px] text-emerald-700 font-semibold underline">Anons</a>
                <a href="#/legal/refund-policy" className="text-[11px] text-emerald-700 font-semibold underline">Rembousman</a>
              </div>
            </div>
            <label className="flex items-start gap-3 cursor-pointer">
              <button
                type="button"
                onClick={() => onSet('termsAccepted', !data.termsAccepted)}
                className={`mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition ${
                  data.termsAccepted ? 'bg-emerald-600 border-emerald-600' : 'border-slate-300 bg-white'
                }`}
              >
                {data.termsAccepted && <CheckCircle2 size={14} className="text-white" />}
              </button>
              <span className="text-sm text-slate-700">
                Mwen li e m aksepte Tèm ak Kondisyon, Règleman sou Vi Prive, epi règleman peman/anons yo.
              </span>
            </label>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mt-3 bg-red-50 border border-red-200 rounded-xl p-2.5">
          <p className="text-xs text-red-600 font-medium">{error}</p>
        </div>
      )}

      {/* Action buttons */}
      <div className="mt-5 space-y-2">
        {!isLast ? (
          <button
            onClick={onNext}
            disabled={loading}
            className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm flex items-center justify-center gap-2 active:scale-95 transition disabled:opacity-60"
          >
            Kontinye <ArrowRight size={16} />
          </button>
        ) : (
          <button
            onClick={onCreate}
            disabled={loading}
            className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm flex items-center justify-center gap-2 active:scale-95 transition disabled:opacity-60"
          >
            {loading && <Loader2 size={18} className="animate-spin" />} Kreye Kont
          </button>
        )}
        <button
          onClick={onSwitchLogin}
          className="w-full text-center text-xs text-slate-500 font-medium hover:underline"
        >
          Gen kont deja? Konekte
        </button>
      </div>
    </div>
  );
}

// ── Reusable input with label ──
function RegInput({
  label, placeholder, value, onChange, type = 'text', autoFocus,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  autoFocus?: boolean;
}) {
  return (
    <div>
      <label className="text-xs font-semibold text-slate-600 mb-1 block">{label}</label>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoFocus={autoFocus}
        className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
      />
    </div>
  );
}

function TabButton({ active, label, onClick }: { active: boolean; label: string; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${active ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
    >
      {label}
    </button>
  );
}

function Field({
  icon, type, placeholder, value, onChange, required,
}: {
  icon: React.ReactNode; type: string; placeholder: string; value: string; onChange: (v: string) => void; required?: boolean;
}) {
  return (
    <div className="relative">
      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">{icon}</div>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
      />
    </div>
  );
}
