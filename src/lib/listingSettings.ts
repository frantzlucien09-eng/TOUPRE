import { supabase } from './supabase';
import type { ProductCategory } from './types';

/** Defaults only — runtime values come from Admin settings. */
export const DEFAULT_HOUSE_LISTING_FEE = 2500;
export const DEFAULT_VEHICLE_LISTING_FEE = 2500;
export const DEFAULT_LISTING_DURATION_DAYS = 30;

export const SETTING_HOUSE_LISTING_FEE = 'house_listing_fee';
export const SETTING_VEHICLE_LISTING_FEE = 'vehicle_listing_fee';
export const SETTING_LISTING_DURATION_DAYS = 'listing_duration_days';

export type ListingFeeSettings = {
  houseListingFee: number;
  vehicleListingFee: number;
  listingDurationDays: number;
};

function parseNumber(raw: unknown, fallback: number): number {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw === 'string' && raw.trim() !== '') {
    const n = Number(raw);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

function rowValue(row: Record<string, unknown> | undefined): unknown {
  if (!row) return undefined;
  return row.value ?? row.enabled ?? row.is_active;
}

export async function loadListingFeeSettings(): Promise<ListingFeeSettings> {
  const defaults: ListingFeeSettings = {
    houseListingFee: DEFAULT_HOUSE_LISTING_FEE,
    vehicleListingFee: DEFAULT_VEHICLE_LISTING_FEE,
    listingDurationDays: DEFAULT_LISTING_DURATION_DAYS,
  };

  try {
    const { data, error } = await supabase
      .from('settings')
      .select('*')
      .in('key', [
        SETTING_HOUSE_LISTING_FEE,
        SETTING_VEHICLE_LISTING_FEE,
        SETTING_LISTING_DURATION_DAYS,
      ]);
    if (error || !data) return defaults;

    const byKey = new Map<string, Record<string, unknown>>();
    for (const row of data as Record<string, unknown>[]) {
      const k = String(row.key ?? row.name ?? '');
      if (k) byKey.set(k, row);
    }

    return {
      houseListingFee: Math.max(
        0,
        parseNumber(rowValue(byKey.get(SETTING_HOUSE_LISTING_FEE)), defaults.houseListingFee)
      ),
      vehicleListingFee: Math.max(
        0,
        parseNumber(rowValue(byKey.get(SETTING_VEHICLE_LISTING_FEE)), defaults.vehicleListingFee)
      ),
      listingDurationDays: Math.max(
        1,
        Math.floor(
          parseNumber(rowValue(byKey.get(SETTING_LISTING_DURATION_DAYS)), defaults.listingDurationDays)
        )
      ),
    };
  } catch {
    return defaults;
  }
}

export function listingFeeForCategory(
  settings: ListingFeeSettings,
  category: ProductCategory | 'kay' | 'machin'
): number {
  return category === 'machin' ? settings.vehicleListingFee : settings.houseListingFee;
}

async function upsertSetting(key: string, value: number, label: string): Promise<void> {
  const payload = {
    key,
    value: String(value),
    label,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from('settings').upsert(payload, { onConflict: 'key' });
  if (error) {
    const { error: err2 } = await supabase.from('settings').insert({
      ...payload,
      name: key,
    });
    if (err2) throw err2;
  }
}

export async function saveListingFeeSettings(settings: ListingFeeSettings): Promise<void> {
  await upsertSetting(SETTING_HOUSE_LISTING_FEE, settings.houseListingFee, 'House Listing Fee (HTG)');
  await upsertSetting(SETTING_VEHICLE_LISTING_FEE, settings.vehicleListingFee, 'Vehicle Listing Fee (HTG)');
  await upsertSetting(
    SETTING_LISTING_DURATION_DAYS,
    settings.listingDurationDays,
    'Listing Duration (days)'
  );
}
