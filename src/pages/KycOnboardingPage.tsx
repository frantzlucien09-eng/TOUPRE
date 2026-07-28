import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/lib/toast';
import { Logo } from '@/components/Logo';
import type { VendorKyc, KycStatus } from '@/lib/types';
import { CATEGORIES } from '@/lib/categories';
import {
  Loader2, Upload, Camera, CheckCircle2, XCircle, Clock, AlertCircle,
  User, Store, Phone, MapPin, CreditCard, FileText, ShieldCheck, ArrowRight, ArrowLeft,
} from 'lucide-react';

const STEPS = [
  { key: 'identity', label: 'Idantite', icon: User },
  { key: 'contact', label: 'Kontak', icon: Phone },
  { key: 'business', label: 'Biznis', icon: Store },
  { key: 'referral', label: 'Referans', icon: MapPin },
  { key: 'payment', label: 'Peman', icon: CreditCard },
  { key: 'consent', label: 'Konsantman', icon: ShieldCheck },
] as const;

type StepKey = typeof STEPS[number]['key'];

const REFERRAL_SOURCES = [
  { value: 'vendor_referral', label: 'Yon lòt vandè (gen kòd referans)' },
  { value: 'social', label: 'Rezo Sosyal (Facebook, Instagram, TikTok)' },
  { value: 'friend_family', label: 'Zanmi / Fanmi' },
  { value: 'self_search', label: 'Mwen menm mwen te chèche l (Google, piblisite)' },
  { value: 'other', label: 'Lòt' },
];

export function KycOnboardingPage() {
  const { vendor, refreshVendor } = useAuth();
  const { toast } = useToast();
  const [existing, setExisting] = useState<VendorKyc | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [step, setStep] = useState(0);

  // Section A — Identity
  const [lastName, setLastName] = useState('');
  const [firstNames, setFirstNames] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [sex, setSex] = useState<'male' | 'female' | 'other'>('male');
  const [idNumber, setIdNumber] = useState('');
  const [idFront, setIdFront] = useState<File | null>(null);
  const [idBack, setIdBack] = useState<File | null>(null);
  const [selfieId, setSelfieId] = useState<File | null>(null);
  const [idFrontPreview, setIdFrontPreview] = useState('');
  const [idBackPreview, setIdBackPreview] = useState('');
  const [selfiePreview, setSelfiePreview] = useState('');

  // Section B — Contact
  const [department, setDepartment] = useState('');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [bizDescription, setBizDescription] = useState('');

  // Section C — Business
  const [businessName, setBusinessName] = useState(vendor?.business_name ?? '');
  const [businessCategory, setBusinessCategory] = useState('');
  const [businessShortDesc, setBusinessShortDesc] = useState('');
  const [businessReg, setBusinessReg] = useState('');

  // Section D — Referral
  const [referralSource, setReferralSource] = useState('');
  const [referralDetail, setReferralDetail] = useState('');

  // Section E — Payment
  const [moncashPhone, setMoncashPhone] = useState(vendor?.phone ?? '');
  const [moncashName, setMoncashName] = useState('');

  // Section F — Consent
  const [consent, setConsent] = useState(false);
  const [signature, setSignature] = useState('');

  useEffect(() => {
    const load = async () => {
      if (!vendor) return;
      const { data } = await supabase
        .from('vendor_kyc')
        .select('*')
        .eq('vendor_id', vendor.id)
        .maybeSingle();
      if (data) {
        setExisting(data as VendorKyc);
      }
      setLoading(false);
    };
    load();
  }, [vendor]);

  const uploadDoc = async (file: File, label: string): Promise<string | null> => {
    if (!vendor) return null;
    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
    const path = `${vendor.id}/${label}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('kyc-documents').upload(path, file, { upsert: true });
    if (error) { toast('Pwoblèm telechaje dokiman an.', 'error'); return null; }
    const { data } = supabase.storage.from('kyc-documents').getPublicUrl(path);
    return data.publicUrl;
  };

  const onPick = (
    e: React.ChangeEvent<HTMLInputElement>,
    setFile: (f: File | null) => void,
    setPreview: (s: string) => void,
  ) => {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : '');
  };

  const validateStep = (s: number): boolean => {
    switch (s) {
      case 0:
        if (!lastName.trim() || !firstNames.trim() || !birthDate || !idNumber.trim()) {
          toast('Tanpri konplete tout chan idantite yo.', 'error'); return false;
        }
        if (!idFront || !idBack || !selfieId) {
          toast('Tanpri telechaje 3 foto yo (ID devan, ID dèyè, selfie ak ID).', 'error'); return false;
        }
        return true;
      case 1:
        if (!department.trim() || !city.trim()) {
          toast('Tanpri chwazi depatman ak vil ou.', 'error'); return false;
        }
        return true;
      case 2:
        if (!businessName.trim() || !businessCategory) {
          toast('Tanpri antre non biznis ou ak kategori a.', 'error'); return false;
        }
        return true;
      case 3:
        if (!referralSource) { toast('Tanpri chwazi kiyès ki refere w.', 'error'); return false; }
        return true;
      case 4:
        if (!moncashPhone.trim() || !moncashName.trim()) {
          toast('Tanpri antre info MonCash ou.', 'error'); return false;
        }
        return true;
      case 5:
        if (!consent || !signature.trim()) {
          toast('Tanpri koche konsantman an e siye non ou.', 'error'); return false;
        }
        return true;
      default: return true;
    }
  };

  const next = () => {
    if (!validateStep(step)) return;
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };
  const prev = () => setStep((s) => Math.max(s - 1, 0));

  const submit = async () => {
    if (!vendor) return;
    if (!validateStep(5)) return;
    setSubmitting(true);
    const frontUrl = idFront ? await uploadDoc(idFront, 'id-front') : null;
    const backUrl = idBack ? await uploadDoc(idBack, 'id-back') : null;
    const selfieUrl = selfieId ? await uploadDoc(selfieId, 'selfie-id') : null;
    if (!frontUrl || !backUrl || !selfieUrl) { setSubmitting(false); return; }

    const payload = {
      vendor_id: vendor.id,
      last_name: lastName.trim(),
      first_names: firstNames.trim(),
      birth_date: birthDate,
      sex,
      id_number: idNumber.trim(),
      id_front_url: frontUrl,
      id_back_url: backUrl,
      selfie_with_id_url: selfieUrl,
      department, city, address,
      business_description: bizDescription,
      business_name: businessName.trim(),
      business_category: businessCategory,
      business_short_desc: businessShortDesc,
      business_registration: businessReg,
      referral_source: referralSource,
      referral_detail: referralDetail,
      moncash_phone: moncashPhone.trim(),
      moncash_name: moncashName.trim(),
      consent_accepted: consent,
      signature: signature.trim(),
      status: 'pending' as KycStatus,
      submitted_at: new Date().toISOString(),
    };

    const { error } = await supabase.from('vendor_kyc').upsert(payload, { onConflict: 'vendor_id' });
    setSubmitting(false);
    if (error) { toast('Pwoblèm anrejistre dosye a. Eseye ankò.', 'error'); return; }
    toast('Dosye enskripsyon ou voye bay Admin pou revizyon.', 'success');
    refreshVendor();
    const { data } = await supabase.from('vendor_kyc').select('*').eq('vendor_id', vendor.id).maybeSingle();
    if (data) setExisting(data as VendorKyc);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-slate-50">
        <Logo size="md" />
        <Loader2 className="animate-spin text-emerald-500" size={24} />
      </div>
    );
  }

  // If KYC already submitted, show status page
  if (existing && existing.status !== 'rejected' && existing.status !== 'resubmit') {
    return <KycStatusView kyc={existing} />;
  }

  const currentStepKey = STEPS[step].key;

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 sticky top-0 z-10">
        <div className="max-w-md mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-3">
            <Logo size="sm" />
            <span className="text-xs text-slate-400">Ensripsyon Vandè</span>
          </div>
          {/* Progress bar */}
          <div className="flex items-center gap-1">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              return (
                <div key={s.key} className="flex items-center flex-1">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition ${
                      i < step ? 'bg-emerald-600 text-white' :
                      i === step ? 'bg-emerald-600 text-white ring-4 ring-emerald-100' :
                      'bg-slate-100 text-slate-400'
                    }`}
                  >
                    {i < step ? <CheckCircle2 size={16} /> : <Icon size={14} />}
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className={`flex-1 h-0.5 mx-1 ${i < step ? 'bg-emerald-500' : 'bg-slate-200'}`} />
                  )}
                </div>
              );
            })}
          </div>
          <p className="text-xs text-slate-500 mt-2 text-center font-medium">
            {step + 1}. {STEPS[step].label}
          </p>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-5 space-y-4">
        {existing?.status === 'resubmit' && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
            <AlertCircle size={16} className="text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-amber-700">Admin mande w voye dosye a ankò</p>
              {existing.rejection_reason && (
                <p className="text-xs text-amber-600 mt-0.5">Rezon: {existing.rejection_reason}</p>
              )}
            </div>
          </div>
        )}

        {/* STEP 0: Identity */}
        {currentStepKey === 'identity' && (
          <div className="space-y-3">
            <SectionTitle icon={User} title="Idantite Pèsonèl" desc="Non ki make la dwe matche EGZAKTEMAN ak non ki sou ID ou." />
            <Input label="Non Fanmi (Non Papa)" value={lastName} onChange={setLastName} placeholder="Jan ou ekri sou ID la" />
            <Input label="Non Prenon(yo)" value={firstNames} onChange={setFirstNames} placeholder="Jan ou ekri sou ID la" />
            <Input label="Dat Nesans" type="date" value={birthDate} onChange={setBirthDate} />
            <div>
              <label className="text-xs font-semibold text-slate-600">Sèks</label>
              <div className="mt-1 flex gap-2">
                {([['male','Gason'],['female','Fanm'],['other','Lòt']] as const).map(([v,l]) => (
                  <button key={v} type="button" onClick={() => setSex(v)}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition ${
                      sex === v ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-600 border-slate-200'
                    }`}>{l}</button>
                ))}
              </div>
            </div>
            <Input label="Nimewo CIN / Paspò" value={idNumber} onChange={setIdNumber} placeholder="Nimewo kat idantite ou" />
            <DocUpload label="Foto ID — Devan" file={idFront} preview={idFrontPreview}
              onPick={(e) => onPick(e, setIdFront, setIdFrontPreview)} />
            <DocUpload label="Foto ID — Dèyè" file={idBack} preview={idBackPreview}
              onPick={(e) => onPick(e, setIdBack, setIdBackPreview)} />
            <DocUpload label="Selfie ak ID" file={selfieId} preview={selfiePreview}
              onPick={(e) => onPick(e, setSelfieId, setSelfiePreview)}
              hint="Pran yon foto tèt ou ap kenbe ID ou bò kote figi ou." />
          </div>
        )}

        {/* STEP 1: Contact */}
        {currentStepKey === 'contact' && (
          <div className="space-y-3">
            <SectionTitle icon={Phone} title="Kontak" desc="Kote nou ka jwint ou ak kote biznis la ye." />
            <Input label="Depatman" value={department} onChange={setDepartment} placeholder="Egz: Lwès" />
            <Input label="Vil" value={city} onChange={setCity} placeholder="Egz: Pòtoprens" />
            <Input label="Adrès" value={address} onChange={setAddress} placeholder="Adrès biznis ou" />
            <div>
              <label className="text-xs font-semibold text-slate-600">Ban m plis detay sou kote biznis la ye</label>
              <textarea value={bizDescription} onChange={(e) => setBizDescription(e.target.value)} rows={3}
                className="mt-1 w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none" />
            </div>
          </div>
        )}

        {/* STEP 2: Business */}
        {currentStepKey === 'business' && (
          <div className="space-y-3">
            <SectionTitle icon={Store} title="Info Biznis" desc="Idantifye boutik ou ak sa w ap vann." />
            <Input label="Non Biznis / Boutik" value={businessName} onChange={setBusinessName} placeholder="Egz: Boutik Marie" />
            <div>
              <label className="text-xs font-semibold text-slate-600">Kategori prensipal</label>
              <div className="mt-1 grid grid-cols-2 gap-2">
                {CATEGORIES.map((c) => (
                  <button key={c.key} type="button" onClick={() => setBusinessCategory(c.key)}
                    className={`py-2.5 rounded-xl text-sm font-medium border transition flex items-center gap-2 ${
                      businessCategory === c.key ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-600 border-slate-200'
                    }`}>
                    <span>{c.icon}</span> {c.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600">Deskripsyon kout sou sa w ap vann</label>
              <textarea value={businessShortDesc} onChange={(e) => setBusinessShortDesc(e.target.value)} rows={2}
                className="mt-1 w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none" />
            </div>
            <Input label="Nimewo Patant/Immatriculation (opsyonèl)" value={businessReg} onChange={setBusinessReg} placeholder="Si ou gen youn" />
          </div>
        )}

        {/* STEP 3: Referral */}
        {currentStepKey === 'referral' && (
          <div className="space-y-3">
            <SectionTitle icon={MapPin} title="Referans" desc="Kiyès ki envite w vin sou TOUPRE?" />
            <div className="space-y-2">
              {REFERRAL_SOURCES.map((r) => (
                <button key={r.value} type="button" onClick={() => setReferralSource(r.value)}
                  className={`w-full text-left p-3 rounded-xl text-sm font-medium border transition ${
                    referralSource === r.value ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'bg-white border-slate-200 text-slate-600'
                  }`}>
                  {r.label}
                </button>
              ))}
            </div>
            {referralSource === 'vendor_referral' && (
              <Input label="Kòd referans oswa non vandè a" value={referralDetail} onChange={setReferralDetail} placeholder="Kòd oswa non" />
            )}
            {referralSource === 'social' && (
              <Input label="Ki rezo sosyal?" value={referralDetail} onChange={setReferralDetail} placeholder="Facebook, Instagram, TikTok" />
            )}
            {referralSource === 'other' && (
              <Input label="Presize" value={referralDetail} onChange={setReferralDetail} placeholder="Eksplike" />
            )}
          </div>
        )}

        {/* STEP 4: Payment */}
        {currentStepKey === 'payment' && (
          <div className="space-y-3">
            <SectionTitle icon={CreditCard} title="Metòd Peman" desc="Info MonCash pou l resevwa peman." />
            <Input label="Nimewo MonCash" value={moncashPhone} onChange={setMoncashPhone} placeholder="Egz: +509 3700 0000" />
            <Input label="Non konplè ki sou kont MonCash la" value={moncashName} onChange={setMoncashName}
              placeholder="Dwe matche ak non pèsonèl ou" />
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
              <p className="text-xs text-blue-700">
                Non ki sou kont MonCash la dwe matche ak non pèsonèl ou (Seksyon A) pou rezon sekirite.
              </p>
            </div>
          </div>
        )}

        {/* STEP 5: Consent */}
        {currentStepKey === 'consent' && (
          <div className="space-y-4">
            <SectionTitle icon={ShieldCheck} title="Konsantman" desc="Konfime enfòmasyon ou bay yo egzat." />
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)}
                className="mt-1 w-5 h-5 rounded accent-emerald-600 shrink-0" />
              <span className="text-sm text-slate-700">
                Mwen konfime tout enfòmasyon mwen bay yo egzat, e mwen aksepte <span className="text-emerald-600 font-semibold">Kondisyon ak Règleman TOUPRE</span> yo.
              </span>
            </label>
            <div>
              <label className="text-xs font-semibold text-slate-600">Siyati elektwonik (ekri non ou)</label>
              <input value={signature} onChange={(e) => setSignature(e.target.value)} placeholder="Non konplè ou"
                className="mt-1 w-full px-3 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-start gap-2">
              <ShieldCheck size={16} className="text-emerald-600 mt-0.5 shrink-0" />
              <p className="text-xs text-emerald-700">
                Dosye ou a ap ale nan revizyon Admin. Yo ap verifye idantite ou, dokiman ou yo, e si non ou matche ak ID ou. Sa ede pwoteje tout moun sou platfòm nan.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Navigation buttons */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100">
        <div className="max-w-md mx-auto px-4 py-3 flex gap-3">
          {step > 0 && (
            <button onClick={prev} className="flex-1 py-3 rounded-xl bg-slate-100 text-slate-700 font-semibold text-sm flex items-center justify-center gap-2 active:scale-95 transition">
              <ArrowLeft size={18} /> Retounen
            </button>
          )}
          {step < STEPS.length - 1 ? (
            <button onClick={next} className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm flex items-center justify-center gap-2 active:scale-95 transition">
              Kontinye <ArrowRight size={18} />
            </button>
          ) : (
            <button onClick={submit} disabled={submitting}
              className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm flex items-center justify-center gap-2 active:scale-95 transition disabled:opacity-60">
              {submitting ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
              Voye dosye a
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function KycStatusView({ kyc }: { kyc: VendorKyc }) {
  const { vendor, signOut } = useAuth();
  const status = kyc.status;
  const config = {
    pending: { icon: Clock, color: 'amber', title: 'An Revizyon', desc: 'Admin ap egzamine dosye ou. Sa ka pran kèk tan.' },
    approved: { icon: CheckCircle2, color: 'emerald', title: 'Apwouve', desc: 'Dosye ou a apwouve. Ou ka kòmanse itilize app la.' },
    rejected: { icon: XCircle, color: 'red', title: 'Rejte', desc: kyc.rejection_reason ?? 'Dosye ou rejte.' },
    resubmit: { icon: AlertCircle, color: 'amber', title: 'Enfòmasyon Manke', desc: kyc.rejection_reason ?? 'Tanpri voye dosye a ankò.' },
  }[status];

  const Icon = config.icon;
  const colorClasses: Record<string, string> = {
    amber: 'bg-amber-50 border-amber-200 text-amber-700',
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    red: 'bg-red-50 border-red-200 text-red-700',
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-6">
      <Logo size="md" />
      <div className={`mt-8 w-full max-w-sm rounded-2xl border p-6 text-center ${colorClasses[config.color]}`}>
        <Icon size={48} className="mx-auto mb-3" />
        <h2 className="text-lg font-bold">{config.title}</h2>
        <p className="text-sm mt-1 opacity-90">{config.desc}</p>
      </div>
      {kyc.rejection_reason && status === 'rejected' && (
        <div className="mt-4 w-full max-w-sm bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500">Rezon rejè:</p>
          <p className="text-sm text-slate-700 mt-1">{kyc.rejection_reason}</p>
        </div>
      )}
      <button onClick={signOut} className="mt-6 text-sm text-slate-500 font-medium hover:text-slate-700">
        Dekonekte
      </button>
    </div>
  );
}

function SectionTitle({ icon: Icon, title, desc }: { icon: typeof User; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-3 mb-2">
      <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
        <Icon size={20} className="text-emerald-600" />
      </div>
      <div>
        <h2 className="font-bold text-slate-900">{title}</h2>
        <p className="text-xs text-slate-500">{desc}</p>
      </div>
    </div>
  );
}

function Input({ label, value, onChange, placeholder, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <div>
      <label className="text-xs font-semibold text-slate-600">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="mt-1 w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition" />
    </div>
  );
}

function DocUpload({ label, file, preview, onPick, hint }: {
  label: string; file: File | null; preview: string;
  onPick: (e: React.ChangeEvent<HTMLInputElement>) => void; hint?: string;
}) {
  return (
    <div>
      <label className="text-xs font-semibold text-slate-600">{label}</label>
      <label className="mt-1 block cursor-pointer">
        <div className="relative w-full aspect-[4/3] rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 overflow-hidden flex items-center justify-center hover:border-emerald-400 transition">
          {preview ? (
            <img src={preview} alt={label} className="w-full h-full object-cover" />
          ) : (
            <div className="text-center text-slate-400">
              <Camera size={24} className="mx-auto mb-1" />
              <span className="text-xs">Klike pou pran/telechaje foto</span>
            </div>
          )}
        </div>
        <input type="file" accept="image/*" className="absolute" style={{ position: 'absolute', width: '1px', height: '1px', opacity: 0, overflow: 'hidden' }} onChange={onPick} />
      </label>
      {hint && <p className="text-xs text-slate-400 mt-1">{hint}</p>}
      {file && <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1"><CheckCircle2 size={12} /> Foto chwazi</p>}
    </div>
  );
}
