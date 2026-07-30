import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/lib/toast';
import {
  loadListingFeeSettings,
  saveListingFeeSettings,
  type ListingFeeSettings,
} from '@/lib/listingSettings';
import { Loader2, ToggleLeft, ToggleRight, Save, Puzzle } from 'lucide-react';

type SettingRow = {
  id?: string;
  key?: string;
  name?: string;
  value?: string | boolean | number | null;
  label?: string | null;
  description?: string | null;
  enabled?: boolean | null;
  is_active?: boolean | null;
  updated_at?: string | null;
};

type ToggleItem = {
  key: string;
  label: string;
  description: string;
  enabled: boolean;
  raw?: SettingRow;
};

const DEFAULT_TOGGLES: Omit<ToggleItem, 'enabled' | 'raw'>[] = [
  { key: 'google_oauth', label: 'Google OAuth', description: 'Pèmèt koneksyon ak Google' },
  { key: 'moncash_payments', label: 'MonCash', description: 'Peman ak demann retire via MonCash (poko konekte)' },
  { key: 'natcash_payments', label: 'NatCash', description: 'Peman via NatCash (poko konekte)' },
  { key: 'visa_payments', label: 'Visa', description: 'Peman kat Visa (poko konekte)' },
  { key: 'mastercard_payments', label: 'Mastercard', description: 'Peman kat Mastercard (poko konekte)' },
  { key: 'ad_publishing', label: 'Anons Kay / Machin', description: 'Piblikasyon anons peye' },
  { key: 'vendor_messaging', label: 'Mesajri', description: 'Chat ant vandè ak kliyan' },
  { key: 'kyc_required', label: 'KYC Obligatwa', description: 'Vandè dwe konplete KYC anvan yo itilize app la' },
  { key: 'customer_app', label: 'App Kliyan', description: 'Aktive aksè kliyan nan platfòm nan' },
];

function parseEnabled(row: SettingRow | undefined, fallback: boolean): boolean {
  if (!row) return fallback;
  if (typeof row.enabled === 'boolean') return row.enabled;
  if (typeof row.is_active === 'boolean') return row.is_active;
  if (typeof row.value === 'boolean') return row.value;
  if (typeof row.value === 'string') {
    return row.value === 'true' || row.value === '1' || row.value === 'on';
  }
  if (typeof row.value === 'number') return row.value === 1;
  return fallback;
}

export function AdminIntegrationsPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [toggles, setToggles] = useState<ToggleItem[]>([]);
  const [rawSettings, setRawSettings] = useState<SettingRow[]>([]);
  const [mode, setMode] = useState<'settings' | 'defaults'>('defaults');
  const [listingSettings, setListingSettings] = useState<ListingFeeSettings>({
    houseListingFee: 2500,
    vehicleListingFee: 2500,
    listingDurationDays: 30,
  });
  const [savingListing, setSavingListing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const listing = await loadListingFeeSettings();
    setListingSettings(listing);

    const { data, error } = await supabase.from('settings').select('*').limit(200);
    if (error || !data) {
      setMode('defaults');
      setToggles(DEFAULT_TOGGLES.map((t) => ({ ...t, enabled: true })));
      setRawSettings([]);
      setLoading(false);
      return;
    }

    const rows = data as SettingRow[];
    setRawSettings(rows);
    setMode('settings');

    const byKey = new Map<string, SettingRow>();
    for (const row of rows) {
      const k = row.key ?? row.name;
      if (k) byKey.set(k, row);
    }

    const mapped = DEFAULT_TOGGLES.map((t) => {
      const row = byKey.get(t.key);
      return {
        ...t,
        enabled: parseEnabled(row, true),
        raw: row,
      };
    });

    // Include any extra boolean-like settings not in defaults
    for (const row of rows) {
      const k = row.key ?? row.name;
      if (!k || mapped.some((m) => m.key === k)) continue;
      mapped.push({
        key: k,
        label: row.label ?? k,
        description: row.description ?? '',
        enabled: parseEnabled(row, false),
        raw: row,
      });
    }

    setToggles(mapped);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggle = async (item: ToggleItem) => {
    const next = !item.enabled;
    setSavingKey(item.key);
    setToggles((prev) => prev.map((t) => (t.key === item.key ? { ...t, enabled: next } : t)));

    if (mode === 'defaults' || !item.raw) {
      // Persist by upserting into settings when possible
      const payload: Record<string, unknown> = {
        key: item.key,
        value: String(next),
        label: item.label,
        description: item.description,
        enabled: next,
        is_active: next,
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase.from('settings').upsert(payload, { onConflict: 'key' });
      setSavingKey(null);
      if (error) {
        // Try insert with name column variant
        const { error: err2 } = await supabase.from('settings').insert({
          name: item.key,
          value: String(next),
          label: item.label,
          description: item.description,
          enabled: next,
          is_active: next,
        });
        if (err2) {
          toast('Pa ka anrejistre paramèt (RLS oswa schema). Chanjman lokal sèlman.', 'error');
          return;
        }
      }
      toast(`${item.label}: ${next ? 'aktif' : 'inaktif'}`);
      load();
      return;
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if ('enabled' in (item.raw ?? {})) updates.enabled = next;
    if ('is_active' in (item.raw ?? {})) updates.is_active = next;
    if ('value' in (item.raw ?? {})) updates.value = typeof item.raw?.value === 'boolean' ? next : String(next);

    const idOrKey = item.raw?.id;
    let error = null as { message: string } | null;
    if (idOrKey) {
      ({ error } = await supabase.from('settings').update(updates).eq('id', idOrKey));
    } else if (item.raw?.key) {
      ({ error } = await supabase.from('settings').update(updates).eq('key', item.raw.key));
    } else if (item.raw?.name) {
      ({ error } = await supabase.from('settings').update(updates).eq('name', item.raw.name));
    }

    setSavingKey(null);
    if (error) toast(error.message || 'Erè, eseye ankò', 'error');
    else toast(`${item.label}: ${next ? 'aktif' : 'inaktif'}`);
    load();
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">
        Aktive oswa dezaktive entegrasyon ak karakteristik platfòm yo.
        {mode === 'defaults' && rawSettings.length === 0 ? ' (ap itilize paramèt lokal / settings tab)' : ''}
      </p>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-slate-400" /></div>
      ) : (
        <div className="space-y-1.5">
          {toggles.map((t) => (
            <div key={t.key} className="bg-white border border-slate-200 rounded-xl px-3 py-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 shrink-0">
                <Puzzle size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900">{t.label}</p>
                <p className="text-xs text-slate-500 mt-0.5">{t.description || t.key}</p>
              </div>
              <button
                disabled={savingKey === t.key}
                onClick={() => toggle(t)}
                className="w-10 h-10 rounded-lg bg-slate-50 flex items-center justify-center disabled:opacity-50"
              >
                {savingKey === t.key
                  ? <Loader2 size={16} className="animate-spin text-slate-400" />
                  : t.enabled
                    ? <ToggleRight size={22} className="text-emerald-600" />
                    : <ToggleLeft size={22} className="text-slate-400" />}
              </button>
            </div>
          ))}
        </div>
      )}

      {rawSettings.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Save size={14} className="text-slate-400" />
            <p className="text-xs font-semibold text-slate-600">{rawSettings.length} paramèt nan tab settings</p>
          </div>
          <p className="text-[11px] text-slate-400">Chanjman yo anrejistre dirèkteman nan Supabase selon RLS admin.</p>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">Frè & Dire Anons (Kay / Machin)</p>
          <p className="text-xs text-slate-500 mt-0.5">
            Valè sa yo pa fikse nan kòd — modifye yo isit la san redeplwaye.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label className="block text-xs text-slate-500">
            House Listing Fee (HTG)
            <input
              type="number"
              min={0}
              value={listingSettings.houseListingFee}
              onChange={(e) =>
                setListingSettings((s) => ({ ...s, houseListingFee: Math.max(0, Number(e.target.value) || 0) }))
              }
              className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </label>
          <label className="block text-xs text-slate-500">
            Vehicle Listing Fee (HTG)
            <input
              type="number"
              min={0}
              value={listingSettings.vehicleListingFee}
              onChange={(e) =>
                setListingSettings((s) => ({ ...s, vehicleListingFee: Math.max(0, Number(e.target.value) || 0) }))
              }
              className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </label>
          <label className="block text-xs text-slate-500">
            Listing Duration (days)
            <input
              type="number"
              min={1}
              value={listingSettings.listingDurationDays}
              onChange={(e) =>
                setListingSettings((s) => ({
                  ...s,
                  listingDurationDays: Math.max(1, Math.floor(Number(e.target.value) || 1)),
                }))
              }
              className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </label>
        </div>
        <button
          type="button"
          disabled={savingListing}
          onClick={async () => {
            setSavingListing(true);
            try {
              await saveListingFeeSettings(listingSettings);
              toast('Paramèt anons sove');
              await load();
            } catch (err) {
              toast(err instanceof Error ? err.message : 'Erè, eseye ankò', 'error');
            } finally {
              setSavingListing(false);
            }
          }}
          className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold flex items-center gap-2 disabled:opacity-50"
        >
          {savingListing ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          Sove frè / dire anons
        </button>
      </div>
    </div>
  );
}
