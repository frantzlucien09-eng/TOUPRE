import type { PaymentProvider } from './types';
import type {
  PaymentProviderAdapter,
  ProviderInitiateInput,
  ProviderInitiateResult,
  ProviderWebhookVerificationResult,
} from './providers';
import { supabase } from '../supabase';

/**
 * MonCash adapter — all secrets stay in Edge Functions.
 * Client only invokes moncash-create-payment / moncash-verify-payment.
 */
export class MonCashPaymentProvider implements PaymentProviderAdapter {
  readonly id: PaymentProvider = 'moncash';
  readonly displayName = 'MonCash';
  /** UI gate — set VITE_MONCASH_ENABLED=true after Edge secrets are configured. */
  readonly connected = (import.meta.env.VITE_MONCASH_ENABLED ?? '') === 'true';

  async initiate(input: ProviderInitiateInput): Promise<ProviderInitiateResult> {
    if (!this.connected) {
      return {
        ok: false,
        errorCode: 'provider_not_connected',
        errorMessage: 'MonCash poko aktive (VITE_MONCASH_ENABLED)',
      };
    }

    const { data, error } = await supabase.functions.invoke('moncash-create-payment', {
      body: {
        payment_id: input.paymentId,
        return_url: input.returnUrl,
        cancel_url: input.cancelUrl,
        metadata: input.metadata,
      },
    });

    if (error) {
      return {
        ok: false,
        errorCode: 'provider_error',
        errorMessage: error.message,
        raw: { error: error.message },
      };
    }

    const result = data as {
      success?: boolean;
      checkoutUrl?: string;
      provider_payment_id?: string;
      error?: string;
      error_code?: string;
      status?: string;
    };

    if (!result?.success || !result.checkoutUrl) {
      return {
        ok: false,
        errorCode: result?.error_code ?? 'provider_error',
        errorMessage: result?.error ?? 'MonCash initiate echwe',
        raw: result as Record<string, unknown>,
      };
    }

    return {
      ok: true,
      requiresAction: true,
      checkoutUrl: result.checkoutUrl,
      providerPaymentId: result.provider_payment_id,
      raw: result as Record<string, unknown>,
    };
  }

  async verifyWebhook(): Promise<ProviderWebhookVerificationResult> {
    // Webhook verification runs exclusively in Edge (payment-webhook).
    return {
      valid: false,
      errorCode: 'use_edge_webhook',
      errorMessage: 'Verify via payment-webhook / moncash-verify-payment edge functions',
    };
  }
}

export async function verifyMoncashPayment(args: {
  paymentId?: string;
  transactionId?: string;
}): Promise<{
  success: boolean;
  settled?: boolean;
  payment_id?: string;
  status?: string;
  error?: string;
}> {
  const { data, error } = await supabase.functions.invoke('moncash-verify-payment', {
    body: {
      payment_id: args.paymentId ?? null,
      transaction_id: args.transactionId ?? null,
    },
  });
  if (error) return { success: false, error: error.message };
  return data as {
    success: boolean;
    settled?: boolean;
    payment_id?: string;
    status?: string;
    error?: string;
  };
}
