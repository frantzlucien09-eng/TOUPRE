import { Home, Package, ClipboardList, User, MessageCircle } from 'lucide-react';

export type Page = 'home' | 'products' | 'orders' | 'messages' | 'profile';

type BottomNavProps = {
  current: Page;
  onNavigate: (page: Page) => void;
  orderBadge?: number;
  messageBadge?: number;
};

const items: { key: Page; label: string; icon: typeof Home }[] = [
  { key: 'home', label: 'Akèy', icon: Home },
  { key: 'products', label: 'Pwodwi', icon: Package },
  { key: 'orders', label: 'Kòmand', icon: ClipboardList },
  { key: 'messages', label: 'Mesaj', icon: MessageCircle },
  { key: 'profile', label: 'Pwofil', icon: User },
];

export function BottomNav({ current, onNavigate, orderBadge = 0, messageBadge = 0 }: BottomNavProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-100 pb-[env(safe-area-inset-bottom)]">
      <div className="max-w-md mx-auto grid grid-cols-5">
        {items.map((item) => {
          const active = current === item.key;
          const Icon = item.icon;
          const badge = item.key === 'orders' ? orderBadge : item.key === 'messages' ? messageBadge : 0;
          return (
            <button
              key={item.key}
              onClick={() => onNavigate(item.key)}
              className={`relative flex flex-col items-center gap-1 py-2.5 transition active:scale-90 ${
                active ? 'text-emerald-600' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <div className="relative">
                <Icon size={22} strokeWidth={active ? 2.4 : 2} />
                {badge > 0 && (
                  <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                    {badge > 9 ? '9+' : badge}
                  </span>
                )}
              </div>
              <span className={`text-[11px] font-medium ${active ? 'font-semibold' : ''}`}>
                {item.label}
              </span>
              {active && (
                <span className="absolute top-0 h-0.5 w-8 rounded-full bg-emerald-500" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
