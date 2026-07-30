/**
 * Production health check for Edge / uptime monitors.
 * Deploy: supabase functions deploy health
 * Probe: GET /functions/v1/health
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { buildCorsHeaders } from '../_shared/cors.ts';
import { moncashCredentialsConfigured, getMoncashMode } from '../_shared/moncash.ts';

Deno.serve(async (req) => {
  const cors = buildCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: cors });

  const started = Date.now();
  const checks: Record<string, unknown> = {
    service: 'toupre-health',
    time: new Date().toISOString(),
  };

  let dbOk = false;
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    const { error } = await supabase.from('settings').select('key').limit(1);
    dbOk = !error;
    checks.database = dbOk ? 'ok' : error?.message;
  } catch (e) {
    checks.database = e instanceof Error ? e.message : 'error';
  }

  const moncashConfigured = moncashCredentialsConfigured();
  checks.moncash = {
    credentials: moncashConfigured ? 'configured' : 'missing',
    mode: getMoncashMode(),
  };
  checks.resend = Deno.env.get('RESEND_API_KEY') ? 'configured' : 'missing';
  checks.latency_ms = Date.now() - started;

  const ok = dbOk;
  return new Response(JSON.stringify({ ok, checks }), {
    status: ok ? 200 : 503,
    headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
});
