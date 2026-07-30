/**
 * Build CORS headers for Edge Functions.
 * Set ALLOWED_ORIGINS as a comma-separated list (e.g. https://toupre.com,http://localhost:5173).
 * Falls back to denying browser origins when unset (webhooks still work without CORS).
 */
export function buildCorsHeaders(req: Request, extraAllowHeaders = ''): Record<string, string> {
  const configured = (Deno.env.get('ALLOWED_ORIGINS') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const origin = req.headers.get('Origin') ?? '';
  const allowOrigin =
    configured.length === 0
      ? 'null'
      : configured.includes('*')
        ? '*'
        : configured.includes(origin)
          ? origin
          : configured[0];

  const headers: Record<string, string> = {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers':
      `Content-Type, Authorization, X-Client-Info, Apikey${extraAllowHeaders ? `, ${extraAllowHeaders}` : ''}`,
    Vary: 'Origin',
  };
  if (allowOrigin !== '*' && allowOrigin !== 'null') {
    headers['Access-Control-Allow-Credentials'] = 'true';
  }
  return headers;
}
