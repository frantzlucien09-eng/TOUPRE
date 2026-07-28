export const ORDER_STATUS = {
  pending: 'pending',
  accepted: 'accepted',
  preparing: 'preparing',
  ready_pickup: 'ready_pickup',
  delivering: 'delivering',
  delivered: 'delivered',
  picked_up: 'picked_up',
  cancelled: 'cancelled',
} as const;

export type OrderStatus = typeof ORDER_STATUS[keyof typeof ORDER_STATUS];

export const STATUS_LABELS_VENDOR: Record<string, string> = {
  pending: 'Nouvo',
  accepted: 'Aksepte',
  preparing: 'An Preparasyon',
  ready_pickup: 'Pare pou Retire',
  delivering: 'Ap Livre',
  delivered: 'Livre',
  picked_up: 'Kliyan Retire l',
  cancelled: 'Anile',
};

export const STATUS_LABELS_CUSTOMER: Record<string, string> = {
  pending: 'An Atant',
  accepted: 'Konfime',
  preparing: 'An Preparasyon',
  ready_pickup: 'Pare pou Retire',
  delivering: 'Vandè a Ap Vini',
  delivered: 'Livre',
  picked_up: 'Retire',
  cancelled: 'Anile',
};

export const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  accepted: 'bg-blue-100 text-blue-700',
  preparing: 'bg-blue-100 text-blue-700',
  ready_pickup: 'bg-violet-100 text-violet-700',
  delivering: 'bg-indigo-100 text-indigo-700',
  delivered: 'bg-emerald-100 text-emerald-700',
  picked_up: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-slate-200 text-slate-600',
};

export const NEW_STATUSES = ['pending'];
export const ACTIVE_STATUSES = ['accepted', 'preparing', 'ready_pickup', 'delivering'];
export const DONE_STATUSES = ['delivered', 'picked_up', 'cancelled'];

export function isNew(status: string): boolean {
  return status === 'pending';
}

export function isActive(status: string): boolean {
  return ACTIVE_STATUSES.includes(status);
}

export function isDone(status: string): boolean {
  return DONE_STATUSES.includes(status);
}

export function isDelivered(status: string): boolean {
  return status === 'delivered' || status === 'picked_up';
}

export function isCancelled(status: string): boolean {
  return status === 'cancelled';
}
