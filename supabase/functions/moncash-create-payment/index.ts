/**
 * Initiate MonCash checkout for an existing payments row.
 * Auth: user JWT required. Secrets never leave Edge.
 *
 * Deploy: supabase functions deploy moncash-create-payment
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { buildCorsHeaders } from '../_shared/cors.ts';
import {
  createMoncashPayment,
  getMoncashMode,
  moncashCredentialsConfigured,
} from '../_shared/moncash.ts';

Deno.serve(async (req) => {
  const cors = buildCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: cors });

  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ success: false, error: 'POST obligatwa' }), {
        status: 405, headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    if (!moncashCredentialsConfigured()) {
      return new Response(JSON.stringify({
        success: false,
        error: 'MonCash pa konfigire (secrets manke)',
        error_code: 'provider_not_connected',
      }), { status: 503, headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    const authHeader = req.headers.get('Authorization') ?? '';
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(supabaseUrl, serviceKey);

    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ success: false, error: 'Ou pa konekte', error_code: 'unauthorized' }), {
        status: 401, headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const paymentId = String(body.payment_id ?? '');
    if (!paymentId) {
      return new Response(JSON.stringify({ success: false, error: 'payment_id obligatwa' }), {
        status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const { data: payment, error: payErr } = await admin
      .from('payments')
      .select('*')
      .eq('id', paymentId)
      .maybeSingle();

    if (payErr || !payment) {
      return new Response(JSON.stringify({ success: false, error: 'Peman pa jwenn' }), {
        status: 404, headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    if (payment.user_id && payment.user_id !== userData.user.id) {
      const { data: adminRow } = await admin
        .from('admin_profiles')
        .select('id')
        .eq('user_id', userData.user.id)
        .maybeSingle();
      if (!adminRow) {
        return new Response(JSON.stringify({ success: false, error: 'Ou pa otorize' }), {
          status: 403, headers: { ...cors, 'Content-Type': 'application/json' },
        });
      }
    }

    if (['paid', 'captured', 'refunded'].includes(payment.status)) {
      return new Response(JSON.stringify({
        success: true,
        already_paid: true,
        payment_id: paymentId,
        status: payment.status,
      }), { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    const amount = Number(payment.amount);
    if (!amount || amount <= 0) {
      return new Response(JSON.stringify({ success: false, error: 'Montan invalid' }), {
        status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    // Use payment UUID as MonCash orderId for idempotent capture later
    const created = await createMoncashPayment(paymentId, amount);

    await admin.from('payments').update({
      provider: 'moncash',
      provider_payment_id: created.token,
      provider_checkout_url: created.redirectUrl,
      provider_raw: created.raw,
      status: 'requires_action',
      metadata: {
        ...(payment.metadata ?? {}),
        moncash_mode: getMoncashMode(),
        moncash_order_id: paymentId,
      },
      updated_at: new Date().toISOString(),
    }).eq('id', paymentId);

    await admin.rpc('log_payment_audit', {
      p_action: 'payment.moncash_initiated',
      p_payment_id: paymentId,
      p_entity_type: 'payment',
      p_entity_id: paymentId,
      p_message: 'MonCash checkout created',
      p_before: null,
      p_after: { redirectUrl: created.redirectUrl, mode: getMoncashMode() },
      p_severity: 'info',
      p_error_code: null,
      p_error_message: null,
      p_metadata: { provider: 'moncash' },
    });

    return new Response(JSON.stringify({
      success: true,
      payment_id: paymentId,
      status: 'requires_action',
      checkoutUrl: created.redirectUrl,
      provider_payment_id: created.token,
      mode: getMoncashMode(),
    }), { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('[moncash-create-payment]', err instanceof Error ? err.message : err);
    return new Response(JSON.stringify({
      success: false,
      error: err instanceof Error ? err.message : 'Erè MonCash',
      error_code: 'provider_error',
    }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });
  }
});
