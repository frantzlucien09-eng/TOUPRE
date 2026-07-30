import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/lib/toast';
import {
  createAddress,
  deleteAddress,
  listAddresses,
  setDefaultAddress,
  type SavedAddress,
} from '@/lib/addresses';
import { Loader2, MapPin, Plus, Star, Trash2 } from 'lucide-react';

export function CustomerAddressesPanel() {
  const { user, customer } = useAuth();
  const { toast } = useToast();
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [label, setLabel] = useState('Kay');
  const [phone, setPhone] = useState(customer?.phone ?? '');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState(customer?.city ?? '');
  const [department, setDepartment] = useState(customer?.department ?? '');
  const [isDefault, setIsDefault] = useState(false);

  const reload = async () => {
    if (!user) return;
    setLoading(true);
    try {
      setAddresses(await listAddresses(user.id));
    } catch {
      setAddresses([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const save = async () => {
    if (!user) return;
    if (!address.trim()) {
      toast('Antre adrès la', 'error');
      return;
    }
    setSaving(true);
    try {
      await createAddress(user.id, {
        label: label.trim() || 'Kay',
        full_name: customer?.full_name ?? null,
        phone: phone.trim() || null,
        address: address.trim(),
        city: city.trim() || null,
        department: department.trim() || null,
        is_default: isDefault || addresses.length === 0,
      });
      setShowForm(false);
      setAddress('');
      setLabel('Kay');
      setIsDefault(false);
      toast('Adrès anrejistre');
      await reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Erè, eseye ankò', 'error');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!user) return;
    try {
      await deleteAddress(user.id, id);
      toast('Adrès efase');
      await reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Erè', 'error');
    }
  };

  const makeDefault = async (id: string) => {
    if (!user) return;
    try {
      await setDefaultAddress(user.id, id);
      toast('Adrès defo mete ajou');
      await reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Erè', 'error');
    }
  };

  if (loading) {
    return <div className="flex justify-center py-6"><Loader2 className="animate-spin text-slate-300" size={20} /></div>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
          <MapPin size={14} className="text-emerald-600" /> Adrès livrezon
        </h3>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="text-xs font-semibold text-emerald-700 flex items-center gap-1"
        >
          <Plus size={14} /> Ajoute
        </button>
      </div>

      {showForm && (
        <div className="rounded-xl bg-white border border-slate-100 p-3 space-y-2">
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Etikèt (Kay, Travay...)"
            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Telefòn"
            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Adrès"
            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Vil"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <input
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              placeholder="Depatman"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-600">
            <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
            Fè l adrès defo
          </label>
          <button
            type="button"
            disabled={saving}
            onClick={() => void save()}
            className="w-full py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold disabled:opacity-50"
          >
            {saving ? <Loader2 size={14} className="animate-spin inline" /> : 'Sove adrès'}
          </button>
        </div>
      )}

      {addresses.length === 0 && !showForm ? (
        <p className="text-xs text-slate-400 text-center py-3">Pa gen adrès anrejistre.</p>
      ) : (
        addresses.map((a) => (
          <div key={a.id} className="rounded-xl bg-white border border-slate-100 p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900">
                  {a.label || 'Adrès'}{a.is_default ? ' · Defo' : ''}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {[a.address, a.city, a.department].filter(Boolean).join(', ')}
                </p>
                {a.phone && <p className="text-[11px] text-slate-400 mt-0.5">{a.phone}</p>}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {!a.is_default && (
                  <button
                    type="button"
                    onClick={() => void makeDefault(a.id)}
                    className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-amber-500"
                    aria-label="Fè defo"
                  >
                    <Star size={14} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void remove(a.id)}
                  className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-rose-500"
                  aria-label="Efase"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
