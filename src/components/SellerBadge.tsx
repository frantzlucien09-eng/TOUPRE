import { Crown, Medal, Award, Shield, Sparkles } from 'lucide-react';

export const BADGE_CONFIG: Record<string, { icon: typeof Crown; label: string; gradient: string; ring: string }> = {
  elite: { icon: Crown, label: 'Elite Seller', gradient: 'from-amber-400 to-yellow-600', ring: 'ring-amber-400' },
  gold: { icon: Medal, label: 'Gold Seller', gradient: 'from-yellow-400 to-amber-600', ring: 'ring-yellow-400' },
  silver: { icon: Award, label: 'Silver Seller', gradient: 'from-slate-300 to-slate-500', ring: 'ring-slate-300' },
  bronze: { icon: Shield, label: 'Bronze Seller', gradient: 'from-orange-400 to-amber-700', ring: 'ring-orange-400' },
  rising: { icon: Sparkles, label: 'Rising Seller', gradient: 'from-emerald-400 to-teal-600', ring: 'ring-emerald-400' },
};

export function SellerBadge({ badge, size = 'md' }: { badge: string | null; size?: 'sm' | 'md' | 'lg' }) {
  if (!badge) return null;
  const cfg = BADGE_CONFIG[badge];
  if (!cfg) return null;
  const Icon = cfg.icon;
  const sizes = {
    sm: { box: 'w-6 h-6', icon: 12, text: 'text-[10px]' },
    md: { box: 'w-8 h-8', icon: 16, text: 'text-xs' },
    lg: { box: 'w-10 h-10', icon: 20, text: 'text-sm' },
  };
  const s = sizes[size];
  return (
    <div className="inline-flex items-center gap-1.5">
      <div className={`${s.box} rounded-full bg-gradient-to-br ${cfg.gradient} flex items-center justify-center text-white shrink-0`}>
        <Icon size={s.icon} />
      </div>
      <span className={`font-semibold text-slate-700 ${s.text}`}>{cfg.label}</span>
    </div>
  );
}
