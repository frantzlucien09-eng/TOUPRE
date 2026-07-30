import type { PaymentProvider } from './types';
import { MonCashPaymentProvider } from './moncash';

/**
 * Payment provider adapter contract.
 * MonCash is wired via Edge Functions (secrets never in VITE_*).
 */
export type ProviderInitiateInput = {
  paymentId: string;
  amount: number;
  currency: string;
  purpose: string;
  metadata?: Record<string, unknown>;
  returnUrl?: string;
  cancelUrl?: string;
};

export type ProviderInitiateResult = {
  ok: boolean;
  providerPaymentId?: string;
  checkoutUrl?: string | null;
  raw?: Record<string, unknown>;
  errorCode?: string;
  errorMessage?: string;
  requiresAction?: boolean;
};

export type ProviderWebhookVerificationInput = {
  headers: Record<string, string>;
  rawBody: string;
  signature?: string | null;
};

export type ProviderWebhookVerificationResult = {
  valid: boolean;
  eventId?: string | null;
  eventType?: string | null;
  providerPaymentId?: string | null;
  paymentId?: string | null;
  mappedStatus?: string | null;
  errorCode?: string;
  errorMessage?: string;
};

export interface PaymentProviderAdapter {
  readonly id: PaymentProvider;
  readonly displayName: string;
  readonly connected: boolean;
  initiate(input: ProviderInitiateInput): Promise<ProviderInitiateResult>;
  verifyWebhook(input: ProviderWebhookVerificationInput): Promise<ProviderWebhookVerificationResult>;
  refund?(paymentId: string, amount?: number): Promise<ProviderInitiateResult>;
}

/** Manual / admin adapter — no external network calls. */
export class ManualPaymentProvider implements PaymentProviderAdapter {
  readonly id: PaymentProvider = 'manual';
  readonly displayName = 'Manual / Admin';
  readonly connected = true;

  async initiate(input: ProviderInitiateInput): Promise<ProviderInitiateResult> {
    return {
      ok: true,
      providerPaymentId: `manual_${input.paymentId}`,
      checkoutUrl: null,
      raw: { mode: 'manual', note: 'No external provider call' },
    };
  }

  async verifyWebhook(): Promise<ProviderWebhookVerificationResult> {
    return {
      valid: false,
      errorCode: 'provider_not_connected',
      errorMessage: 'Manual provider does not receive webhooks',
    };
  }
}

/** Placeholder adapters — refuse live calls until credentials are wired. */
class UnconnectedProvider implements PaymentProviderAdapter {
  readonly connected = false;
  constructor(
    readonly id: PaymentProvider,
    readonly displayName: string
  ) {}

  async initiate(): Promise<ProviderInitiateResult> {
    return {
      ok: false,
      errorCode: 'provider_not_connected',
      errorMessage: `${this.displayName} pa konekte ankò — achitekti sèlman.`,
    };
  }

  async verifyWebhook(): Promise<ProviderWebhookVerificationResult> {
    return {
      valid: false,
      errorCode: 'provider_not_connected',
      errorMessage: `${this.displayName} webhook verification not connected yet`,
    };
  }
}

const registry: Record<PaymentProvider, PaymentProviderAdapter> = {
  manual: new ManualPaymentProvider(),
  moncash: new MonCashPaymentProvider(),
  natcash: new UnconnectedProvider('natcash', 'NatCash'),
  visa: new UnconnectedProvider('visa', 'Visa'),
  mastercard: new UnconnectedProvider('mastercard', 'Mastercard'),
};

export function getPaymentProvider(provider: PaymentProvider | string): PaymentProviderAdapter {
  const key = provider as PaymentProvider;
  return registry[key] ?? new UnconnectedProvider('manual', String(provider));
}

export function listPaymentProviders(): PaymentProviderAdapter[] {
  return Object.values(registry);
}

export function isMonCashLiveEnabled(): boolean {
  return getPaymentProvider('moncash').connected;
}
