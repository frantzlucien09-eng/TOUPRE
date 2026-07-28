export function Logo({ size = 'md', variant = 'light' }: { size?: 'sm' | 'md' | 'lg' | 'xl'; variant?: 'light' | 'dark' }) {
  const dims = {
    sm: { img: 'w-7 h-7', text: 'text-sm', sub: 'text-[9px]' },
    md: { img: 'w-9 h-9', text: 'text-base', sub: 'text-[10px]' },
    lg: { img: 'w-14 h-14', text: 'text-2xl', sub: 'text-xs' },
    xl: { img: 'w-20 h-20', text: 'text-3xl', sub: 'text-sm' },
  }[size];

  const textColor = variant === 'dark' ? 'text-white' : 'text-slate-900';
  const subColor = variant === 'dark' ? 'text-emerald-400' : 'text-emerald-600';

  return (
    <div className="flex items-center gap-2 select-none">
      <img
        src="/toupre_vande_logo.png"
        alt="TOUPRE VANDE"
        className={`${dims.img} object-contain shrink-0`}
      />
      <div className="leading-none">
        <div className={`font-extrabold tracking-tight ${textColor} ${dims.text}`}>
          TOUPRE
        </div>
        <div className={`font-semibold ${subColor} ${dims.sub} tracking-wide`}>
          VANDE
        </div>
      </div>
    </div>
  );
}

export function LogoMark({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const dims = {
    sm: 'w-6 h-6',
    md: 'w-9 h-9',
    lg: 'w-14 h-14',
  }[size];

  return (
    <img
      src="/toupre_vande_logo.png"
      alt="TOUPRE"
      className={`${dims} object-contain shrink-0`}
    />
  );
}
