/**
 * Verify MonCash payment (return URL / polling) and settle via service_role.
 *
 * Body: { payment_id?, transaction_id? }
 * Deploy: supabase functions deploy moncash-verify-payment
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { buildCorsHeaders } from '../_shared/cors.ts';
import {
  captureMoncashByOrderId,
  captureMoncashByTransactionId,
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
        error_code: 'provider_not_connected',
        error: 'MonCash pa konfigire',
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

    const { data: userData } = await userClient.auth.getUser();
    if (!userData?.user) {
      return new Response(JSON.stringify({ success: false, error: 'Ou pa konekte' }), {
        status: 401, headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    let paymentId = body.payment_id ? String(body.payment_id) : '';
    const transactionId = body.transaction_id ? String(body.transaction_id) : '';

    let details;
    if (transactionId) {
      details = await captureMoncashByTransactionId(transactionId);
      if (!paymentId && details.orderId) paymentId = details.orderId;
    } else if (paymentId) {
      details = await captureMoncashByOrderId(paymentId);
    } else {
      return new Response(JSON.stringify({ success: false, error: 'payment_id oswa transaction_id obligatwa' }), {
        status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    if (!paymentId) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Pa ka map peman',
        details: details.raw,
      }), { status: 422, headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    const { data: payment } = await admin.from('payments').select('*').eq('id', paymentId).maybeSingle();
    if (!payment) {
      return new Response(JSON.stringify({ success: false, error: 'Peman pa jwenn' }), {
        status: 404, headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    // Ownership: payer or admin
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

    if (!details.ok) {
      await admin.rpc('schedule_payment_retry', {
        p_payment_id: paymentId,
        p_delay_seconds: 60,
      }).catch(() => null);

      return new Response(JSON.stringify({
        success: false,
        settled: false,
        payment_id: paymentId,
        error: details.message || 'Peman poko konfime',
        error_code: 'payment_pending',
        raw: details.raw,
      }), { status: 202, headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    // Settle as service_role (admin path of transition_payment_status)
    const { data: settled, error: settleErr } = await admin.rpc('transition_payment_status', {
      p_payment_id: paymentId,
      p_new_status: 'paid',
      p_provider_payment_id: details.transactionId ?? payment.provider_payment_id,
      p_provider_raw: details.raw,
      p_metadata: {
        moncash_verified: true,
        moncash_payer: details.payer ?? null,
        moncash_cost: details.cost ?? null,
      },
    });

    if (settleErr) {
      console.error('[moncash-verify] settle', settleErr);
      return new Response(JSON.stringify({ success: false, error: settleErr.message }), {
        status: 500, headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    // Sync ad_payments if linked (also handled in transition_payment_status)
    if (payment.ad_payment_id) {
      await admin.from('ad_payments').update({
        status: 'paid',
        paid_at: new Date().toISOString(),
        payment_id: paymentId,
      }).eq('id', payment.ad_payment_id);
    }

    // Informational ledger entries (service_role bypasses RLS on transactions)
    try {
      const amount = Number(payment.amount) || 0;
      if (amount > 0) {
        await admin.from('transactions').insert([
          {
            payment_id: paymentId,
            entry_type: 'debit',
            account: 'escrow',
            amount,
            currency: payment.currency ?? 'HTG',
            description: 'Release escrow on MonCash capture',
            reference_type: 'payment',
            reference_id: paymentId,
            metadata: { source: 'moncash-verify-payment' },
          },
          {
            payment_id: paymentId,
            entry_type: 'credit',
            account: 'vendor',
            amount,
            currency: payment.currency ?? 'HTG',
            description: 'Vendor net (pre-commission split)',
            reference_type: 'payment',
            reference_id: paymentId,
            metadata: { source: 'moncash-verify-payment' },
          },
        ]);
      }
    } catch (ledgerErr) {
      console.error('[moncash-verify] ledger', ledgerErr instanceof Error ? ledgerErr.message : ledgerErr);
    }

    return new Response(JSON.stringify({
      success: true,
      settled: true,
      payment_id: paymentId,
      status: 'paid',
      transaction_id: details.transactionId ?? null,
      result: settled,
    }), { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('[moncash-verify-payment]', err instanceof Error ? err.message : err);
    return new Response(JSON.stringify({
      success: false,
      error: err instanceof Error ? err.message : 'Erè verifikasyon',
      error_code: 'provider_error',
    }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });
  }
});
