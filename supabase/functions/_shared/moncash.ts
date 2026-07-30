/**
 * Digicel MonCash REST helpers for Edge Functions.
 * Secrets: MONCASH_CLIENT_ID, MONCASH_CLIENT_SECRET, MONCASH_MODE=sandbox|live
 * Docs: sandbox.moncashbutton.digicelgroup.com RestAPI
 */

export type MoncashMode = 'sandbox' | 'live';

export function getMoncashMode(): MoncashMode {
  const m = (Deno.env.get('MONCASH_MODE') ?? 'sandbox').toLowerCase();
  return m === 'live' ? 'live' : 'sandbox';
}

export function moncashApiHost(mode: MoncashMode = getMoncashMode()): string {
  return mode === 'live'
    ? 'https://moncashbutton.digicelgroup.com/Api'
    : 'https://sandbox.moncashbutton.digicelgroup.com/Api';
}

export function moncashGatewayBase(mode: MoncashMode = getMoncashMode()): string {
  return mode === 'live'
    ? 'https://moncashbutton.digicelgroup.com/Moncash-middleware'
    : 'https://sandbox.moncashbutton.digicelgroup.com/Moncash-middleware';
}

export function moncashCredentialsConfigured(): boolean {
  return !!(Deno.env.get('MONCASH_CLIENT_ID') && Deno.env.get('MONCASH_CLIENT_SECRET'));
}

type TokenCache = { accessToken: string; expiresAt: number };
let tokenCache: TokenCache | null = null;

export async function getMoncashAccessToken(): Promise<string> {
  const clientId = Deno.env.get('MONCASH_CLIENT_ID');
  const clientSecret = Deno.env.get('MONCASH_CLIENT_SECRET');
  if (!clientId || !clientSecret) {
    throw new Error('MONCASH_CLIENT_ID / MONCASH_CLIENT_SECRET pa konfigire');
  }

  if (tokenCache && tokenCache.expiresAt > Date.now() + 5_000) {
    return tokenCache.accessToken;
  }

  const host = moncashApiHost();
  const basic = btoa(`${clientId}:${clientSecret}`);
  const res = await fetch(`${host}/oauth/token`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'scope=read,write&grant_type=client_credentials',
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.access_token) {
    throw new Error(
      `MonCash OAuth echwe: ${body.error_description || body.error || res.status}`
    );
  }

  const expiresIn = Number(body.expires_in ?? 55);
  tokenCache = {
    accessToken: String(body.access_token),
    expiresAt: Date.now() + Math.max(10, expiresIn - 5) * 1000,
  };
  return tokenCache.accessToken;
}

export type CreateMoncashPaymentResult = {
  token: string;
  redirectUrl: string;
  raw: Record<string, unknown>;
};

export async function createMoncashPayment(
  orderId: string,
  amount: number
): Promise<CreateMoncashPaymentResult> {
  const token = await getMoncashAccessToken();
  const host = moncashApiHost();
  const mode = getMoncashMode();

  const res = await fetch(`${host}/v1/CreatePayment`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ amount: Number(amount), orderId: String(orderId) }),
  });

  const raw = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  const paymentToken = raw.payment_token as { token?: string } | undefined;
  const payToken = paymentToken?.token;
  if (!res.ok || !payToken) {
    throw new Error(
      `MonCash CreatePayment echwe: ${(raw.message as string) || (raw.error as string) || res.status}`
    );
  }

  const redirectUrl = `${moncashGatewayBase(mode)}/Payment/Redirect?token=${encodeURIComponent(payToken)}`;
  return { token: payToken, redirectUrl, raw };
}

export type MoncashPaymentDetails = {
  ok: boolean;
  message?: string;
  transactionId?: string;
  orderId?: string;
  cost?: number;
  payer?: string;
  raw: Record<string, unknown>;
};

/** Capture / verify payment by our orderId (payment UUID). */
export async function captureMoncashByOrderId(orderId: string): Promise<MoncashPaymentDetails> {
  const token = await getMoncashAccessToken();
  const host = moncashApiHost();
  const res = await fetch(`${host}/v1/RetrieveOrderPayment`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ orderId: String(orderId) }),
  });
  const raw = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  const payment = (raw.payment as Record<string, unknown> | undefined) ?? raw;
  const message = String(payment.message ?? raw.message ?? '');
  const ok =
    res.ok &&
    (String(raw.status ?? '') === '200' ||
      message.toLowerCase().includes('successful') ||
      message.toLowerCase() === 'successful');

  return {
    ok,
    message,
    transactionId: payment.transaction_id
      ? String(payment.transaction_id)
      : payment.transactionId
        ? String(payment.transactionId)
        : undefined,
    orderId: payment.reference ? String(payment.reference) : orderId,
    cost: payment.cost != null ? Number(payment.cost) : undefined,
    payer: payment.payer ? String(payment.payer) : undefined,
    raw,
  };
}

/** Capture / verify by MonCash transactionId from return URL. */
export async function captureMoncashByTransactionId(
  transactionId: string
): Promise<MoncashPaymentDetails> {
  const token = await getMoncashAccessToken();
  const host = moncashApiHost();
  const res = await fetch(`${host}/v1/RetrieveTransactionPayment`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ transactionId: String(transactionId) }),
  });
  const raw = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  const payment = (raw.payment as Record<string, unknown> | undefined) ?? raw;
  const message = String(payment.message ?? raw.message ?? '');
  const ok =
    res.ok &&
    (String(raw.status ?? '') === '200' ||
      message.toLowerCase().includes('successful') ||
      message.toLowerCase() === 'successful');

  return {
    ok,
    message,
    transactionId: String(transactionId),
    orderId: payment.reference ? String(payment.reference) : undefined,
    cost: payment.cost != null ? Number(payment.cost) : undefined,
    payer: payment.payer ? String(payment.payer) : undefined,
    raw,
  };
}

/** Constant-time string compare (Edge-safe). */
function timingSafeEqualString(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const bufA = enc.encode(a);
  const bufB = enc.encode(b);
  if (bufA.length !== bufB.length) return false;
  let diff = 0;
  for (let i = 0; i < bufA.length; i++) diff |= bufA[i]! ^ bufB[i]!;
  return diff === 0;
}

/**
 * Verify MonCash / TOUPRE webhook shared secret.
 * Accepts: x-moncash-signature | x-webhook-secret | x-signature
 */
export function verifyMoncashWebhookSecret(headers: Record<string, string>): boolean {
  const expected = Deno.env.get('MONCASH_WEBHOOK_SECRET');
  if (!expected) return false;
  const got =
    headers['x-moncash-signature'] ||
    headers['x-webhook-secret'] ||
    headers['x-signature'] ||
    '';
  if (!got) return false;
  return timingSafeEqualString(got, expected);
}

/** Production: require configured secret; reject unsigned unless explicitly allowed. */
export function moncashWebhookAuthAllowed(headers: Record<string, string>): {
  allowed: boolean;
  signatureValid: boolean;
  reason?: string;
} {
  const secretConfigured = Boolean(Deno.env.get('MONCASH_WEBHOOK_SECRET'));
  const signatureValid = verifyMoncashWebhookSecret(headers);
  if (signatureValid) return { allowed: true, signatureValid: true };
  if (Deno.env.get('MONCASH_ALLOW_UNSIGNED_CAPTURE') === 'true') {
    return { allowed: true, signatureValid: false, reason: 'unsigned_capture_allowed' };
  }
  if (!secretConfigured) {
    return { allowed: false, signatureValid: false, reason: 'webhook_secret_missing' };
  }
  return { allowed: false, signatureValid: false, reason: 'invalid_signature' };
}

