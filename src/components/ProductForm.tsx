import { useRef, useState } from 'react';
import type { Product, ProductCategory } from '@/lib/types';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/lib/toast';
import {
  CATEGORIES, CATEGORY_LABEL,
  KAY_TYPES, KAY_FEATURES,
  CAR_MAKES, CAR_FUELS, CAR_TRANSMISSIONS, CAR_CONDITIONS,
  FOOD_TYPES, FOOD_AVAILABILITY,
  CLOTHING_TYPES, CLOTHING_SIZES, CLOTHING_SEXES,
  SHOE_BRANDS, SHOE_CONDITIONS, SHOE_SIZES,
} from '@/lib/categories';
import { uploadProductPhoto, uploadProductVideo, deleteProductMedia } from '@/lib/media';
import {
  Loader2, Save, Trash2, X, Video, Plus, Star, Camera,
} from 'lucide-react';

type Props = {
  product: Product | null;
  onSave: (vals: {
    name: string;
    description: string;
    price: number;
    stock: number;
    category: ProductCategory;
    details: Record<string, unknown>;
    photos: string[];
    cover_index: number;
    video_url: string | null;
    price_on_request: boolean;
  }) => Promise<void>;
  onDelete?: () => void;
};

const MIN_PHOTOS = 4;
const MAX_PHOTOS = 7;

export function ProductForm({ product, onSave, onDelete }: Props) {
  const { vendor } = useAuth();
  const { toast } = useToast();

  const existingCategory = (product?.category ?? null) as ProductCategory | null;
  const [step, setStep] = useState<'category' | 'form'>(existingCategory ? 'form' : 'category');
  const [category, setCategory] = useState<ProductCategory>(existingCategory ?? 'lot');

  const [name, setName] = useState(product?.name ?? '');
  const [description, setDescription] = useState(product?.description ?? '');
  const [price, setPrice] = useState(String(product?.price ?? ''));
  const [priceOnRequest, setPriceOnRequest] = useState(product?.price_on_request ?? false);
  const [stock, setStock] = useState(String(product?.stock ?? '0'));
  const [department, setDepartment] = useState((product?.details?.department as string) ?? '');
  const [city, setCity] = useState((product?.details?.city as string) ?? '');
  const [photos, setPhotos] = useState<string[]>(product?.photos ?? []);
  const [coverIndex, setCoverIndex] = useState(product?.cover_index ?? 0);
  const [videoUrl, setVideoUrl] = useState(product?.video_url ?? '');
  const [details, setDetails] = useState<Record<string, unknown>>(product?.details ?? {});
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const tempIdRef = useRef<string>(product?.id ?? crypto.randomUUID());
  const vendorId = vendor?.id ?? '';

  const handlePhotoUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    if (photos.length >= MAX_PHOTOS) {
      toast(`Maksimòm ${MAX_PHOTOS} foto`, 'error');
      return;
    }
    setUploading(true);
    try {
      const remaining = MAX_PHOTOS - photos.length;
      const toUpload = Array.from(files).slice(0, remaining);
      const urls: string[] = [];
      for (const f of toUpload) {
        const url = await uploadProductPhoto(f, vendorId, tempIdRef.current);
        urls.push(url);
      }
      setPhotos((p) => [...p, ...urls]);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Erè telechaje', 'error');
    } finally {
      setUploading(false);
      if (photoInputRef.current) photoInputRef.current.value = '';
    }
  };

  const handleVideoUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const url = await uploadProductVideo(files[0], vendorId, tempIdRef.current);
      setVideoUrl(url);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Erè telechaje videyo', 'error');
    } finally {
      setUploading(false);
      if (videoInputRef.current) videoInputRef.current.value = '';
    }
  };

  const removePhoto = async (idx: number) => {
    const url = photos[idx];
    setPhotos((p) => p.filter((_, i) => i !== idx));
    if (coverIndex === idx) setCoverIndex(0);
    else if (coverIndex > idx) setCoverIndex(coverIndex - 1);
    await deleteProductMedia(url);
  };

  const movePhoto = (idx: number, dir: -1 | 1) => {
    const ni = idx + dir;
    if (ni < 0 || ni >= photos.length) return;
    const next = [...photos];
    [next[idx], next[ni]] = [next[ni], next[idx]];
    setPhotos(next);
    if (coverIndex === idx) setCoverIndex(ni);
    else if (coverIndex === ni) setCoverIndex(idx);
  };

  const removeVideo = async () => {
    if (videoUrl) await deleteProductMedia(videoUrl);
    setVideoUrl('');
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { toast('Tanpri antre non pwodwi', 'error'); return; }
    if (!priceOnRequest && (!price || Number(price) < 0)) { toast('Tanpri antre pri', 'error'); return; }
    if (photos.length < MIN_PHOTOS) {
      toast(`Ou dwe ajoute omwen ${MIN_PHOTOS} foto pou pibliye pwodwi sa a.`, 'error');
      return;
    }
    setSaving(true);
    const fullDetails = { ...details };
    if (department) fullDetails.department = department;
    if (city) fullDetails.city = city;
    await onSave({
      name: name.trim(),
      description: description.trim(),
      price: priceOnRequest ? 0 : Number(price),
      stock: category === 'kay' || category === 'machin' ? 1 : Number(stock) || 0,
      category,
      details: fullDetails,
      photos,
      cover_index: coverIndex,
      video_url: videoUrl.trim() || null,
      price_on_request: priceOnRequest,
    });
    setSaving(false);
  };

  // ---------- Step 1: category picker ----------
  if (step === 'category') {
    return (
      <div className="space-y-4">
        <div>
          <p className="text-sm font-semibold text-slate-700 mb-1">Chwazi kategori pwodwi a</p>
          <p className="text-xs text-slate-500">Fòm nan ap chanje selon kategori ou chwazi a.</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {CATEGORIES.map((c) => (
            <button
              key={c.key}
              onClick={() => { setCategory(c.key); setStep('form'); }}
              className="flex flex-col items-center gap-2 p-4 rounded-2xl border-2 border-slate-100 hover:border-emerald-400 hover:bg-emerald-50/50 active:scale-95 transition"
            >
              <span className="text-3xl">{c.icon}</span>
              <span className="text-xs font-semibold text-slate-700 text-center leading-tight">{c.label}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ---------- Step 2: full form ----------
  const isRealEstate = category === 'kay' || category === 'machin';

  return (
    <form onSubmit={submit} className="space-y-5">
      {/* Category badge */}
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold">
          {CATEGORIES.find((c) => c.key === category)?.icon} {CATEGORY_LABEL[category]}
        </span>
        {!product && (
          <button type="button" onClick={() => setStep('category')} className="text-xs text-slate-500 font-medium hover:underline">
            Chanje kategori
          </button>
        )}
      </div>

      {/* Photos */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-semibold text-slate-600">Foto ({photos.length}/{MAX_PHOTOS}) — omwen {MIN_PHOTOS}</label>
          {photos.length < MAX_PHOTOS && (
            <button type="button" onClick={() => photoInputRef.current?.click()} className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
              <Plus size={14} /> Ajoute
            </button>
          )}
        </div>
        <input ref={photoInputRef} type="file" accept="image/*" multiple hidden onChange={(e) => handlePhotoUpload(e.target.files)} />
        {photos.length === 0 ? (
          <button type="button" onClick={() => photoInputRef.current?.click()} className="w-full h-28 rounded-xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center gap-1 text-slate-400 hover:border-emerald-400 hover:bg-emerald-50/50 transition">
            {uploading ? <Loader2 size={22} className="animate-spin" /> : <Camera size={22} />}
            <span className="text-xs">Klike pou ajoute foto</span>
          </button>
        ) : (
          <div className="grid grid-cols-4 gap-2">
            {photos.map((url, i) => (
              <div key={i} className="relative group aspect-square rounded-lg overflow-hidden bg-slate-100">
                <img src={url} alt="" className="w-full h-full object-cover" />
                {i === coverIndex && (
                  <span className="absolute top-1 left-1 bg-amber-400 text-white rounded-full p-0.5">
                    <Star size={11} fill="white" />
                  </span>
                )}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100">
                  <button type="button" onClick={() => setCoverIndex(i)} className="w-6 h-6 rounded-full bg-white/90 flex items-center justify-center" title="Fè kouvèti">
                    <Star size={12} className={i === coverIndex ? 'text-amber-500 fill-amber-500' : 'text-slate-600'} />
                  </button>
                  <button type="button" onClick={() => movePhoto(i, -1)} className="w-6 h-6 rounded-full bg-white/90 flex items-center justify-center text-xs" title="Deplase ago">‹</button>
                  <button type="button" onClick={() => movePhoto(i, 1)} className="w-6 h-6 rounded-full bg-white/90 flex items-center justify-center text-xs" title="Deplase apre">›</button>
                  <button type="button" onClick={() => removePhoto(i)} className="w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center" title="Efase">
                    <X size={12} />
                  </button>
                </div>
              </div>
            ))}
            {photos.length < MAX_PHOTOS && (
              <button type="button" onClick={() => photoInputRef.current?.click()} className="aspect-square rounded-lg border-2 border-dashed border-slate-200 flex items-center justify-center text-slate-400 hover:border-emerald-400 transition">
                {uploading ? <Loader2 size={18} className="animate-spin" /> : <Plus size={20} />}
              </button>
            )}
          </div>
        )}
        <p className="text-[11px] text-slate-400 mt-1.5">Etwal la = foto kouvèti. Klike sou foto pou jwe l.</p>
      </section>

      {/* Video */}
      <section>
        <label className="text-xs font-semibold text-slate-600">Videyo (opsyonèl, rekòmande)</label>
        <input ref={videoInputRef} type="file" accept="video/*" hidden onChange={(e) => handleVideoUpload(e.target.files)} />
        {videoUrl ? (
          <div className="mt-1.5 relative rounded-xl overflow-hidden bg-slate-900">
            <video src={videoUrl} controls className="w-full h-32 object-cover" />
            <button type="button" onClick={removeVideo} className="absolute top-1 right-1 w-7 h-7 rounded-full bg-red-500 text-white flex items-center justify-center">
              <X size={14} />
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => videoInputRef.current?.click()} className="mt-1.5 w-full h-20 rounded-xl border-2 border-dashed border-slate-200 flex items-center justify-center gap-2 text-slate-400 hover:border-emerald-400 hover:bg-emerald-50/50 transition">
            {uploading ? <Loader2 size={18} className="animate-spin" /> : <Video size={18} />}
            <span className="text-xs">Ajoute yon ti videyo (15-60 segond)</span>
          </button>
        )}
      </section>

      {/* Common fields */}
      <Input label="Non pwodwi/sèvis" value={name} onChange={setName} placeholder="Egz: Diri Nasyonal" required />

      <div>
        <label className="text-xs font-semibold text-slate-600">Deskripsyon</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Dekri pwodwi a..." className="mt-1 w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none" />
      </div>

      {/* Price */}
      <div>
        <label className="text-xs font-semibold text-slate-600">Pri (Goud)</label>
        {isRealEstate && (
          <label className="flex items-center gap-2 mt-1.5 mb-1">
            <input type="checkbox" checked={priceOnRequest} onChange={(e) => setPriceOnRequest(e.target.checked)} className="w-4 h-4 accent-emerald-600" />
            <span className="text-xs text-slate-600">Pri sou Demand (pa mete pri fiks)</span>
          </label>
        )}
        {!priceOnRequest && (
          <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0" className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        )}
      </div>

      {/* Stock (hidden for kay/machin) */}
      {!isRealEstate && (
        <Input label="Kantite disponib (stok)" value={stock} onChange={setStock} placeholder="0" type="number" />
      )}
      {isRealEstate && (
        <p className="text-[11px] text-slate-400 -mt-2">Kantite: 1 inite otomatik pou kategori sa a.</p>
      )}

      {/* Location */}
      <div className="grid grid-cols-2 gap-3">
        <Input label="Depatman (kote pwodwi a ye)" value={department} onChange={setDepartment} placeholder="Egz: Ouest" />
        <Input label="Vil / Komin" value={city} onChange={setCity} placeholder="Egz: Pétion-Ville" />
      </div>

      {/* Category-specific fields */}
      <CategoryFields category={category} details={details} setDetails={setDetails} />

      {/* Actions */}
      <div className="flex gap-3 pt-1">
        {onDelete && (
          <button type="button" onClick={onDelete} className="px-4 py-3 rounded-xl border border-red-200 text-red-600 font-semibold text-sm flex items-center gap-2 hover:bg-red-50 active:scale-95 transition">
            <Trash2 size={16} /> Efase
          </button>
        )}
        <button type="submit" disabled={saving || uploading} className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm flex items-center justify-center gap-2 active:scale-95 transition disabled:opacity-60">
          {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
          {product ? 'Anrejistre chanjman' : 'Pibliye pwodwi a'}
        </button>
      </div>
    </form>
  );
}

// ============ Category-specific fields ============

function CategoryFields({
  category, details, setDetails,
}: {
  category: ProductCategory;
  details: Record<string, unknown>;
  setDetails: (d: Record<string, unknown>) => void;
}) {
  const set = (key: string, val: unknown) => setDetails({ ...details, [key]: val });
  const str = (key: string) => {
    const v = details[key];
    return typeof v === 'string' || typeof v === 'number' ? String(v) : '';
  };
  const strArr = (key: string) => {
    const v = details[key];
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  };

  if (category === 'kay') {
    return (
      <Section title="Detay Kay">
        <Select label="Tip anons" value={str('listing_type')} onChange={(v) => set('listing_type', v)} options={['Pou Lwe', 'Pou Vann']} />
        <Select label="Tip kay" value={str('kay_type')} onChange={(v) => set('kay_type', v)} options={KAY_TYPES} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Kantite chanm" value={str('rooms')} onChange={(v) => set('rooms', v)} type="number" />
          <Input label="Kantite twalèt" value={str('bathrooms')} onChange={(v) => set('bathrooms', v)} type="number" />
        </div>
        <Input label="Sipèfisi (m²)" value={str('area')} onChange={(v) => set('area', v)} type="number" />
        <Input label="Etaj (si apatman)" value={str('floor')} onChange={(v) => set('floor', v)} />
        <Input label="Adrès presi / Kote" value={str('address')} onChange={(v) => set('address', v)} placeholder="Dekri kote a ye byen" />
        <div>
          <p className="text-xs font-semibold text-slate-600 mb-2">Ekipman / Karakteristik</p>
          <div className="flex flex-wrap gap-2">
            {KAY_FEATURES.map((f) => {
              const on = !!details[f.key];
              return (
                <button key={f.key} type="button" onClick={() => set(f.key, !on)} className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${on ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-600 border-slate-200'}`}>
                  {on ? '✓ ' : ''}{f.label}
                </button>
              );
            })}
          </div>
        </div>
      </Section>
    );
  }

  if (category === 'machin') {
    return (
      <Section title="Detay Machin">
        <Select label="Mak" value={str('make')} onChange={(v) => set('make', v)} options={CAR_MAKES} />
        <Input label="Modèl" value={str('model')} onChange={(v) => set('model', v)} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Ane fabrikasyon" value={str('year')} onChange={(v) => set('year', v)} type="number" />
          <Input label="Kilomtraj (mileyaj)" value={str('mileage')} onChange={(v) => set('mileage', v)} type="number" />
        </div>
        <Select label="Tip motè" value={str('fuel')} onChange={(v) => set('fuel', v)} options={CAR_FUELS} />
        <Select label="Transmisyon" value={str('transmission')} onChange={(v) => set('transmission', v)} options={CAR_TRANSMISSIONS} />
        <Input label="Koulè" value={str('color')} onChange={(v) => set('color', v)} />
        <Select label="Kondisyon" value={str('condition')} onChange={(v) => set('condition', v)} options={CAR_CONDITIONS} />
        <div>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={!!details.has_papers} onChange={(e) => set('has_papers', e.target.checked)} className="w-4 h-4 accent-emerald-600" />
            <span className="text-xs text-slate-600">Gen plak / dokiman valid</span>
          </label>
        </div>
      </Section>
    );
  }

  if (category === 'manje') {
    return (
      <Section title="Detay Manje">
        <Select label="Tip manje" value={str('food_type')} onChange={(v) => set('food_type', v)} options={FOOD_TYPES} />
        <Input label="Pòsyon / Gwosè" value={str('portion')} onChange={(v) => set('portion', v)} placeholder="Egz: 1 asyèt, 1 galon, 24oz" />
        <Input label="Engredyan prensipal" value={str('ingredients')} onChange={(v) => set('ingredients', v)} placeholder="Egz: Ble, let, nwa..." />
        <Select label="Disponiblite" value={str('availability')} onChange={(v) => set('availability', v)} options={FOOD_AVAILABILITY} />
        {str('availability') === 'Sou Kòmand Sèlman' && (
          <Input label="Tan preparasyon (egz: 24 èdtan davans)" value={str('prep_time')} onChange={(v) => set('prep_time', v)} />
        )}
      </Section>
    );
  }

  if (category === 'rad') {
    return (
      <Section title="Detay Rad">
        <Select label="Tip rad" value={str('clothing_type')} onChange={(v) => set('clothing_type', v)} options={CLOTHING_TYPES} />
        <MultiChip label="Mezi / Gwosè disponib" value={strArr('sizes')} onChange={(v) => set('sizes', v)} options={CLOTHING_SIZES} />
        <Input label="Koulè(y) disponib" value={str('colors')} onChange={(v) => set('colors', v)} placeholder="Egz: Nwa, Ble, Wouj" />
        <Input label="Materyèl (opsyonèl)" value={str('material')} onChange={(v) => set('material', v)} placeholder="Egz: Koton, Polyestè" />
        <Select label="Sèks / Kategori" value={str('sex')} onChange={(v) => set('sex', v)} options={CLOTHING_SEXES} />
      </Section>
    );
  }

  if (category === 'soulye') {
    return (
      <Section title="Detay Soulye">
        <Select label="Mak" value={str('brand')} onChange={(v) => set('brand', v)} options={SHOE_BRANDS} />
        <Input label="Modèl" value={str('model')} onChange={(v) => set('model', v)} />
        <MultiChip label="Pwentiraj / Gwosè disponib" value={strArr('sizes')} onChange={(v) => set('sizes', v)} options={SHOE_SIZES} />
        <Input label="Koulè" value={str('color')} onChange={(v) => set('color', v)} />
        <Select label="Kondisyon" value={str('condition')} onChange={(v) => set('condition', v)} options={SHOE_CONDITIONS} />
      </Section>
    );
  }

  // lot — no extra fields
  return null;
}

// ============ Small field components ============

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3 border-t border-slate-100 pt-4">
      <p className="text-sm font-bold text-slate-800">{title}</p>
      {children}
    </div>
  );
}

function Input({
  label, value, onChange, placeholder, type = 'text', required,
}: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; required?: boolean;
}) {
  return (
    <div>
      <label className="text-xs font-semibold text-slate-600">{label}{required && ' *'}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} required={required} className="mt-1 w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
    </div>
  );
}

function Select({
  label, value, onChange, options,
}: {
  label: string; value: string; onChange: (v: string) => void; options: string[];
}) {
  return (
    <div>
      <label className="text-xs font-semibold text-slate-600">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
        <option value="">Chwazi...</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

function MultiChip({
  label, value, onChange, options,
}: {
  label: string; value: string[]; onChange: (v: string[]) => void; options: string[];
}) {
  const toggle = (o: string) => {
    if (value.includes(o)) onChange(value.filter((x) => x !== o));
    else onChange([...value, o]);
  };
  return (
    <div>
      <label className="text-xs font-semibold text-slate-600">{label}</label>
      <div className="flex flex-wrap gap-2 mt-1.5">
        {options.map((o) => {
          const on = value.includes(o);
          return (
            <button key={o} type="button" onClick={() => toggle(o)} className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${on ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-600 border-slate-200'}`}>
              {on ? '✓ ' : ''}{o}
            </button>
          );
        })}
      </div>
    </div>
  );
}
