import { Bell, ArrowLeft } from 'lucide-react';
import { Logo } from './Logo';

type HeaderProps = {
  title?: string;
  subtitle?: string;
  notificationCount?: number;
  onNotifications?: () => void;
  /** Optional back action — shown left of the title block when provided. */
  onBack?: () => void;
};

export function Header({ title, subtitle, notificationCount = 0, onNotifications, onBack }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-100">
      <div className="px-4 pt-3 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 hover:bg-slate-200 active:scale-90 transition shrink-0"
                aria-label="Retounen"
              >
                <ArrowLeft size={18} />
              </button>
            )}
            <Logo size="sm" />
          </div>
          <button
            onClick={onNotifications}
            className="relative w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 hover:bg-slate-200 active:scale-90 transition"
            aria-label="Notifikasyon"
          >
            <Bell size={18} />
            {notificationCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                {notificationCount > 9 ? '9+' : notificationCount}
              </span>
            )}
          </button>
        </div>
        {(title || subtitle) && (
          <div className="mt-2">
            {title && <h1 className="text-lg font-bold text-slate-900 leading-tight">{title}</h1>}
            {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
        )}
      </div>
    </header>
  );
}
