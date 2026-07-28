import { type ReactNode } from 'react';

export function EmptyState({
  icon,
  title,
  message,
  showLogo = false,
}: {
  icon: ReactNode;
  title: string;
  message?: string;
  showLogo?: boolean;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
      {showLogo ? (
        <img src="/toupre_vande_logo.png" alt="TOUPRE" className="w-12 h-12 object-contain mb-3 opacity-40" />
      ) : (
        <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
          {icon}
        </div>
      )}
      <p className="font-semibold text-slate-700 text-sm">{title}</p>
      {message && <p className="text-xs text-slate-400 mt-1 max-w-xs">{message}</p>}
    </div>
  );
}
