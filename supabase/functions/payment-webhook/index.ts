/**
 * Payment webhook / MonCash return handler.
 *
 * - POST ?provider=moncash  — server notification (requires MONCASH_WEBHOOK_SECRET)
 * - GET  ?provider=moncash&transactionId=&orderId= — browser return (verify + optional redirect)
 *
 * Deploy: supabase functions deploy payment-webhook
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { buildCorsHeaders } from '../_shared/cors.ts';
import {
  captureMoncashByOrderId,
  captureMoncashByTransactionId,
  moncashCredentialsConfigured,
  verifyMoncashWebhookSecret,
} from '../_shared/moncash.ts';

Deno.serve(async (req) => {
  const cors = buildCorsHeaders(req, 'x-signature, x-moncash-signature, stripe-signature, x-webhook-secret');

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors });
  }

  const url = new URL(req.url);
  const provider = (url.searchParams.get('provider') || 'manual').toLowerCase();
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const admin = createClient(supabaseUrl, serviceKey);
  const appReturn = Deno.env.get('PAYMENT_RETURN_URL') || Deno.env.get('APP_URL') || '';

  try {
    // Browser return (MonCash redirects with transactionId)
    if (req.method === 'GET' && provider === 'moncash') {
      const transactionId = url.searchParams.get('transactionId') || url.searchParams.get('transaction_id') || '';
      const orderId = url.searchParams.get('orderId') || url.searchParams.get('order_id') || '';

      if (!moncashCredentialsConfigured()) {
        return redirectOrJson(appReturn, { success: false, error: 'provider_not_connected' }, cors);
      }

      let details;
      if (transactionId) details = await captureMoncashByTransactionId(transactionId);
      else if (orderId) details = await captureMoncashByOrderId(orderId);
      else {
        return redirectOrJson(appReturn, { success: false, error: 'missing_ids' }, cors, 400);
      }

      const paymentId = orderId || details.orderId || '';
      await admin.rpc('record_payment_webhook', {
        p_provider: 'moncash',
        p_event_id: details.transactionId || transactionId || paymentId,
        p_event_type: details.ok ? 'payment.success' : 'payment.pending',
        p_payload: details.raw,
        p_headers: {},
        p_signature: null,
        p_signature_valid: details.ok,
        p_payment_id: paymentId || null,
      });

      if (details.ok && paymentId) {
        await admin.rpc('transition_payment_status', {
          p_payment_id: paymentId,
          p_new_status: 'paid',
          p_provider_payment_id: details.transactionId ?? null,
          p_provider_raw: details.raw,
          p_metadata: { moncash_webhook: true, source: 'get_return' },
        });
      }

      const dest = appReturn
        ? `${appReturn.replace(/\/$/, '')}/#/payment/return?payment_id=${encodeURIComponent(paymentId)}&ok=${details.ok ? '1' : '0'}`
        : null;
      if (dest) {
        return Response.redirect(dest, 302);
      }
      return new Response(JSON.stringify({ success: details.ok, payment_id: paymentId, settled: details.ok }), {
        status: details.ok ? 200 : 202,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const rawBody = await req.text();
    const headersObj: Record<string, string> = {};
    req.headers.forEach((v, k) => { headersObj[k.toLowerCase()] = v; });

    let payload: Record<string, unknown> = {};
    try {
      payload = rawBody ? JSON.parse(rawBody) : {};
    } catch {
      payload = { raw: rawBody };
    }

    // Merge query params for MonCash-style notifications
    url.searchParams.forEach((v, k) => { payload[k] = v; });

    let signatureValid = false;
    let settled = false;
    let paymentId: string | null =
      (payload.payment_id as string) ||
      (payload.orderId as string) ||
      (payload.order_id as string) ||
      null;
    const transactionId =
      (payload.transactionId as string) ||
      (payload.transaction_id as string) ||
      null;

    if (provider === 'moncash' && moncashCredentialsConfigured()) {
      signatureValid = verifyMoncashWebhookSecret(headersObj);
      // Also accept verified capture when secret matches OR when we can independently verify with API
      if (signatureValid || Deno.env.get('MONCASH_ALLOW_UNSIGNED_CAPTURE') === 'true') {
        const details = transactionId
          ? await captureMoncashByTransactionId(transactionId)
          : paymentId
            ? await captureMoncashByOrderId(paymentId)
            : null;
        if (details?.ok) {
          signatureValid = true;
          paymentId = paymentId || details.orderId || null;
          if (paymentId) {
            await admin.rpc('transition_payment_status', {
              p_payment_id: paymentId,
              p_new_status: 'paid',
              p_provider_payment_id: details.transactionId ?? null,
              p_provider_raw: details.raw,
              p_metadata: { moncash_webhook: true, source: 'post_webhook' },
            });
            settled = true;
          }
        }
      }
    }

    const eventId =
      (payload.id as string) ||
      transactionId ||
      (payload.event_id as string) ||
      null;
    const eventType =
      (payload.type as string) ||
      (payload.event_type as string) ||
      (settled ? 'payment.success' : 'unknown');

    const { data, error } = await admin.rpc('record_payment_webhook', {
      p_provider: provider,
      p_event_id: eventId,
      p_event_type: eventType,
      p_payload: payload,
      p_headers: headersObj,
      p_signature: headersObj['x-moncash-signature'] || headersObj['x-signature'] || null,
      p_signature_valid: signatureValid,
      p_payment_id: paymentId,
    });

    if (error) {
      console.error('[payment-webhook] record error', error);
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        settled,
        provider_connected: moncashCredentialsConfigured(),
        signature_valid: signatureValid,
        result: data,
      }),
      { status: settled ? 200 : 202, headers: { ...cors, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('[payment-webhook] fatal', err);
    return new Response(
      JSON.stringify({ success: false, error: err instanceof Error ? err.message : 'unknown' }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
    );
  }
});

function redirectOrJson(
  appReturn: string,
  body: Record<string, unknown>,
  cors: Record<string, string>,
  status = 200
) {
  if (appReturn) {
    const q = new URLSearchParams({ ok: body.success ? '1' : '0', error: String(body.error ?? '') });
    return Response.redirect(`${appReturn.replace(/\/$/, '')}/#/payment/return?${q}`, 302);
  }
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}
