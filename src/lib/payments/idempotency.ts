/** Generate a client idempotency key for payment initiation. */
export function createIdempotencyKey(prefix = 'pay'): string {
  const rand =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}_${rand}`;
}

/** Deterministic key for a known business operation (order checkout, ad fee, etc.). */
export function buildScopedIdempotencyKey(
  scope: string,
  parts: Array<string | number | null | undefined>
): string {
  const body = parts
    .filter((p) => p !== null && p !== undefined && String(p).length > 0)
    .map((p) => String(p))
    .join(':');
  return `${scope}:${body}`;
}
