import { Calendar } from 'lucide-react';

export type DateRangeKey = '7d' | '30d' | '6m' | '1y' | 'all';

export const DATE_RANGE_OPTIONS: { key: DateRangeKey; label: string }[] = [
  { key: '7d', label: '7 Jou' },
  { key: '30d', label: '30 Jou' },
  { key: '6m', label: '6 Mwa' },
  { key: '1y', label: '1 Lane' },
  { key: 'all', label: 'Tout' },
];

export function getRangeStartDate(range: DateRangeKey): string | null {
  if (range === 'all') return null;
  const now = new Date();
  switch (range) {
    case '7d': now.setDate(now.getDate() - 7); break;
    case '30d': now.setDate(now.getDate() - 30); break;
    case '6m': now.setMonth(now.getMonth() - 6); break;
    case '1y': now.setFullYear(now.getFullYear() - 1); break;
  }
  return now.toISOString();
}

export function formatRangeLabel(range: DateRangeKey): string {
  const opt = DATE_RANGE_OPTIONS.find((o) => o.key === range);
  return opt?.label ?? '30 Jou';
}

type Props = {
  value: DateRangeKey;
  onChange: (range: DateRangeKey) => void;
  compact?: boolean;
};

export function DateRangeFilter({ value, onChange, compact }: Props) {
  return (
    <div className={`flex items-center gap-2 ${compact ? '' : 'mb-4'}`}>
      {!compact && (
        <div className="flex items-center gap-1.5 text-slate-400 shrink-0">
          <Calendar size={15} />
        </div>
      )}
      <div className="flex gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto">
        {DATE_RANGE_OPTIONS.map((opt) => (
          <button
            key={opt.key}
            onClick={() => onChange(opt.key)}
            className={`whitespace-nowrap py-1.5 px-2.5 rounded-md text-xs font-semibold transition active:scale-95 ${
              value === opt.key
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
