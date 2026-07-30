/** Provider-agnostic payment domain types (no live provider SDKs). */

export type PaymentProvider = 'moncash' | 'natcash' | 'visa' | 'mastercard' | 'manual';

export type PaymentPurpose = 'order' | 'ad_fee' | 'withdrawal' | 'topup' | 'refund' | 'other';

export type PaymentStatus =
  | 'created'
  | 'pending'
  | 'processing'
  | 'requires_action'
  | 'authorized'
  | 'captured'
  | 'paid'
  | 'failed'
  | 'cancelled'
  | 'expired'
  | 'blocked'
  | 'refunded'
  | 'partially_refunded';

export type RiskLevel = 'low' | 'medium' | 'high' | 'blocked';

export type LedgerAccount = 'customer' | 'vendor' | 'platform' | 'provider' | 'escrow';

export type Payment = {
  id: string;
  idempotency_key: string | null;
  user_id: string | null;
  customer_id: string | null;
  vendor_id: string | null;
  order_id: string | null;
  ad_payment_id: string | null;
  withdrawal_id: string | null;
  purpose: PaymentPurpose | string;
  provider: PaymentProvider | string;
  provider_method: string | null;
  amount: number;
  currency: string;
  status: PaymentStatus | string;
  provider_payment_id: string | null;
  provider_checkout_url: string | null;
  provider_raw: Record<string, unknown>;
  metadata: Record<string, unknown>;
  error_code: string | null;
  error_message: string | null;
  error_details: Record<string, unknown>;
  attempt_count: number;
  max_attempts: number;
  next_retry_at: string | null;
  last_attempt_at: string | null;
  expires_at: string | null;
  paid_at: string | null;
  failed_at: string | null;
  cancelled_at: string | null;
  refunded_at: string | null;
  fraud_score: number;
  fraud_flags: unknown[];
  risk_level: RiskLevel | string;
  client_ip: string | null;
  user_agent: string | null;
  reconciled_at: string | null;
  reconciliation_status: string | null;
  created_at: string;
  updated_at: string;
};

export type LedgerTransaction = {
  id: string;
  payment_id: string | null;
  wallet_id: string | null;
  entry_type: 'debit' | 'credit' | string;
  account: LedgerAccount | string;
  amount: number;
  currency: string;
  balance_after: number | null;
  description: string | null;
  reference_type: string | null;
  reference_id: string | null;
  metadata: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
};

export type PaymentWebhookEvent = {
  id: string;
  provider: string;
  event_id: string | null;
  event_type: string | null;
  payment_id: string | null;
  signature: string | null;
  signature_valid: boolean | null;
  headers: Record<string, unknown>;
  payload: Record<string, unknown>;
  verified: boolean;
  processed: boolean;
  processing_error: string | null;
  duplicate_of: string | null;
  received_at: string;
  processed_at: string | null;
};

export type PaymentProviderConfig = {
  id: string;
  provider: PaymentProvider | string;
  display_name: string;
  enabled: boolean;
  sandbox: boolean;
  supports_refunds: boolean;
  supports_webhooks: boolean;
  timeout_seconds: number;
  max_retries: number;
  config: Record<string, unknown>;
  webhook_path: string | null;
  created_at: string;
  updated_at: string;
};

export type PaymentReconciliationRun = {
  id: string;
  provider: string | null;
  status: string;
  started_at: string;
  finished_at: string | null;
  matched_count: number;
  mismatch_count: number;
  unpaid_stale_count: number;
  details: Record<string, unknown>;
  created_by: string | null;
};

export type CreatePaymentInput = {
  idempotencyKey: string;
  amount: number;
  provider: PaymentProvider;
  purpose?: PaymentPurpose;
  currency?: string;
  orderId?: string | null;
  adPaymentId?: string | null;
  vendorId?: string | null;
  customerId?: string | null;
  metadata?: Record<string, unknown>;
  clientIp?: string | null;
  userAgent?: string | null;
  timeoutSeconds?: number | null;
};

export type PaymentRpcResult = {
  success: boolean;
  payment_id?: string;
  status?: string;
  idempotent?: boolean;
  expires_at?: string;
  risk_level?: string;
  fraud_score?: number;
  provider_enabled?: boolean;
  error?: string;
  error_code?: string;
  webhook_id?: string;
  duplicate?: boolean;
  verified?: boolean;
  run_id?: string;
  matched_count?: number;
  mismatch_count?: number;
  unpaid_stale_count?: number;
  expired_count?: number;
  next_retry_at?: string;
  from?: string;
  to?: string;
};

export type PaymentErrorCode =
  | 'missing_idempotency_key'
  | 'invalid_amount'
  | 'unknown_provider'
  | 'provider_not_connected'
  | 'fraud_blocked'
  | 'invalid_transition'
  | 'payment_not_found'
  | 'payment_timeout'
  | 'max_retries'
  | 'invalid_signature'
  | 'webhook_unverified'
  | 'forbidden'
  | 'network_error'
  | 'unknown';
