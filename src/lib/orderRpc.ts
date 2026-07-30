/** Helpers for order status RPC responses that return jsonb { success, error }. */

export type OrderStatusRpcResult = {
  success?: boolean;
  error?: string;
} | null;

export function orderStatusRpcFailed(
  transportError: { message: string } | null,
  data: unknown
): string | null {
  if (transportError) return transportError.message || 'Erè, eseye ankò';
  const result = data as OrderStatusRpcResult;
  if (result && typeof result === 'object' && result.success === false) {
    return result.error || 'Erè, eseye ankò';
  }
  return null;
}
