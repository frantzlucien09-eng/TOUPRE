/**
 * Provider-agnostic payment webhook edge function.
 *
 * Accepts callbacks for MonCash / NatCash / Visa / Mastercard once adapters
 * are connected. Currently verifies via the adapter registry and records the
 * event — it does NOT settle live money or call provider APIs.
 *
 * Deploy later with:
 *   supabase functions deploy payment-webhook
 */
import { buildCorsHeaders } from "../_shared/cors.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

Deno.serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req, 'x-signature, x-moncash-signature, stripe-signature');

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const provider = (url.searchParams.get('provider') || 'manual').toLowerCase();
    const rawBody = await req.text();
    const headersObj: Record<string, string> = {};
    req.headers.forEach((v, k) => {
      headersObj[k.toLowerCase()] = v;
    });

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, serviceKey);

    // Architecture-only: providers are not connected. We still persist the
    // inbound event with signature_valid=false unless a future secret exists.
    const signature =
      headersObj['x-signature'] ||
      headersObj['x-moncash-signature'] ||
      headersObj['stripe-signature'] ||
      null;

    let payload: Record<string, unknown> = {};
    try {
      payload = rawBody ? JSON.parse(rawBody) : {};
    } catch {
      payload = { raw: rawBody };
    }

    const eventId =
      (payload.id as string | undefined) ||
      (payload.event_id as string | undefined) ||
      (payload.transactionId as string | undefined) ||
      null;
    const eventType =
      (payload.type as string | undefined) ||
      (payload.event_type as string | undefined) ||
      (payload.status as string | undefined) ||
      'unknown';

    // Without provider secrets, mark unverified — never auto-settle.
    const signatureValid = false;

    const { data, error } = await supabase.rpc('record_payment_webhook', {
      p_provider: provider,
      p_event_id: eventId,
      p_event_type: eventType,
      p_payload: payload,
      p_headers: headersObj,
      p_signature: signature,
      p_signature_valid: signatureValid,
      p_payment_id: (payload.payment_id as string | undefined) ?? null,
    });

    if (error) {
      console.error('[payment-webhook] record error', error);
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    await supabase.rpc('log_payment_audit', {
      p_action: 'payment.webhook_edge_received',
      p_payment_id: (payload.payment_id as string | undefined) ?? null,
      p_entity_type: 'webhook',
      p_entity_id: null,
      p_message: `Edge webhook for ${provider} (unsettled — provider not connected)`,
      p_before: null,
      p_after: data,
      p_severity: 'info',
      p_error_code: 'provider_not_connected',
      p_error_message: 'Webhook accepted for logging only; settlement disabled',
      p_metadata: { provider, eventId, eventType },
    });

    return new Response(
      JSON.stringify({
        success: true,
        settled: false,
        provider_connected: false,
        message: 'Webhook recorded. Provider settlement not connected yet.',
        result: data,
      }),
      { status: 202, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('[payment-webhook] fatal', err);
    return new Response(
      JSON.stringify({ success: false, error: err instanceof Error ? err.message : 'unknown' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
