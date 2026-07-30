import type { Vendor } from './types';

function vendorIds(vendor: Pick<Vendor, 'id' | 'user_id'>): string[] {
  return Array.from(new Set([vendor.id, vendor.user_id].filter(Boolean)));
}

/** Inbox filter: messages addressed to the vendor (either id scheme). */
export function vendorInboxOrFilter(vendor: Pick<Vendor, 'id' | 'user_id'>): string {
  return vendorIds(vendor)
    .flatMap((id) => [`recipient_id.eq.${id}`, `receiver_id.eq.${id}`])
    .join(',');
}

/** Build an OR filter covering vendor row id and auth user_id for message columns. */
export function vendorMessageOrFilter(vendor: Pick<Vendor, 'id' | 'user_id'>): string {
  return vendorIds(vendor)
    .flatMap((id) => [
      `recipient_id.eq.${id}`,
      `receiver_id.eq.${id}`,
      `sender_id.eq.${id}`,
    ])
    .join(',');
}

export function isVendorParticipant(
  vendor: Pick<Vendor, 'id' | 'user_id'>,
  participantId: string | null | undefined
): boolean {
  if (!participantId) return false;
  return participantId === vendor.id || participantId === vendor.user_id;
}

export function notifUserId(vendor: Pick<Vendor, 'id' | 'user_id'> | null, authUserId?: string | null): string | null {
  return authUserId ?? vendor?.user_id ?? null;
}

/** Realtime postgres_changes filters for messages involving this vendor. */
export function vendorMessageRealtimeFilters(vendor: Pick<Vendor, 'id' | 'user_id'>): {
  event: '*';
  schema: 'public';
  table: 'messages';
  filter: string;
}[] {
  return vendorIds(vendor).flatMap((id) => [
    { event: '*' as const, schema: 'public' as const, table: 'messages' as const, filter: `recipient_id=eq.${id}` },
    { event: '*' as const, schema: 'public' as const, table: 'messages' as const, filter: `receiver_id=eq.${id}` },
    { event: '*' as const, schema: 'public' as const, table: 'messages' as const, filter: `sender_id=eq.${id}` },
  ]);
}
