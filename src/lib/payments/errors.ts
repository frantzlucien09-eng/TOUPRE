import type { PaymentErrorCode } from './types';

export class PaymentError extends Error {
  code: PaymentErrorCode;
  details?: Record<string, unknown>;

  constructor(code: PaymentErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'PaymentError';
    this.code = code;
    this.details = details;
  }
}

export function toPaymentError(err: unknown, fallback: PaymentErrorCode = 'unknown'): PaymentError {
  if (err instanceof PaymentError) return err;
  if (err instanceof Error) {
    return new PaymentError(fallback, err.message);
  }
  return new PaymentError(fallback, 'Erè peman enkoni');
}

/** Structured client-side payment error log (also mirrored to audit via RPCs). */
export function logPaymentError(
  context: string,
  err: unknown,
  extra?: Record<string, unknown>
): void {
  const pe = toPaymentError(err);
  console.error('[payment:error]', {
    context,
    code: pe.code,
    message: pe.message,
    details: pe.details,
    ...extra,
    at: new Date().toISOString(),
  });
}
