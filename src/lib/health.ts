/**
 * Client-side health probe for staging/production dashboards.
 * Edge health: GET /functions/v1/health
 */
import { supabase } from './supabase';

export type HealthReport = {
  ok: boolean;
  checkedAt: string;
  supabaseReachable: boolean;
  moncashUiEnabled: boolean;
  details: Record<string, unknown>;
};

export async function runClientHealthCheck(): Promise<HealthReport> {
  const checkedAt = new Date().toISOString();
  let supabaseReachable = false;
  const details: Record<string, unknown> = {};

  try {
    const { error } = await supabase.from('settings').select('key').limit(1);
    supabaseReachable = !error;
    if (error) details.supabaseError = error.message;
  } catch (e) {
    details.supabaseError = e instanceof Error ? e.message : 'unknown';
  }

  const moncashUiEnabled = (import.meta.env.VITE_MONCASH_ENABLED ?? '') === 'true';
  details.moncashUiEnabled = moncashUiEnabled;
  details.appVersion = import.meta.env.VITE_APP_VERSION ?? '1.0.0-beta.1';

  return {
    ok: supabaseReachable,
    checkedAt,
    supabaseReachable,
    moncashUiEnabled,
    details,
  };
}
