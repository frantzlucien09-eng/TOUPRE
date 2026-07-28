export function formatHTG(amount: number | null | undefined): string {
  const value = Number(amount ?? 0);
  return `${value.toLocaleString('fr-HT', { maximumFractionDigits: 2 })} G`;
}

export function formatHTGShort(amount: number | null | undefined): string {
  const value = Number(amount ?? 0);
  if (Math.abs(value) >= 1000) {
    return `${(value / 1000).toLocaleString('fr-HT', { maximumFractionDigits: 1 })}k G`;
  }
  return `${value.toLocaleString('fr-HT', { maximumFractionDigits: 0 })} G`;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('fr-HT', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('fr-HT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleTimeString('fr-HT', { hour: '2-digit', minute: '2-digit' });
}

export function isToday(iso: string | null | undefined): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear()
  );
}

export function relativeTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'kounye a';
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} lè`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} jou`;
  return formatDate(iso);
}
