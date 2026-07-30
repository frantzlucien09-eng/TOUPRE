import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { SocialPlatform } from '@/lib/types';
import { Header } from '@/components/Header';
import { Loader2, ExternalLink, Instagram, Music2, Facebook, MessageCircle, Globe, Mail } from 'lucide-react';

const ICONS: Record<string, { icon: typeof Globe; color: string; bg: string }> = {
  instagram: { icon: Instagram, color: 'text-pink-600', bg: 'bg-gradient-to-br from-amber-400 via-pink-500 to-purple-600' },
  tiktok: { icon: Music2, color: 'text-slate-900', bg: 'bg-slate-900' },
  facebook: { icon: Facebook, color: 'text-blue-600', bg: 'bg-blue-600' },
  whatsapp: { icon: MessageCircle, color: 'text-emerald-600', bg: 'bg-emerald-500' },
  globe: { icon: Globe, color: 'text-slate-600', bg: 'bg-slate-600' },
};

export function FollowTouprePage({ onBack }: { onBack: () => void }) {
  const [platforms, setPlatforms] = useState<SocialPlatform[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('social_platforms')
        .select('*')
        .eq('active', true)
        .order('sort_order', { ascending: true });
      setPlatforms((data ?? []) as SocialPlatform[]);
      setLoading(false);
    };
    load();
    const channel = supabase
      .channel('social-platforms')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'social_platforms' }, load)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const open = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="pb-24 min-h-screen bg-slate-50">
      <Header title="Swiv TOUPRE" subtitle="Swiv nou sou rezo sosyal yo" onBack={onBack} />

      <div className="px-4 pt-4">
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm text-center mb-4">
          <div className="w-16 h-16 rounded-2xl mx-auto bg-gradient-to-br from-emerald-500 to-emerald-700 text-white flex items-center justify-center text-2xl font-bold shadow-md">
            T
          </div>
          <h2 className="font-bold text-slate-900 text-base mt-3">Platfòm Ofisyèl TOUPRE</h2>
          <p className="text-xs text-slate-500 mt-1">Swiv nou pou wè dènye nouvèl, pwomosyon, ak konsèy pou vandè yo.</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="animate-spin text-slate-400" /></div>
        ) : platforms.length === 0 ? (
          <div className="text-center py-12 text-sm text-slate-400">Pa gen platfòm aktif toujou.</div>
        ) : (
          <div className="space-y-3">
            {platforms.map((p) => {
              const cfg = ICONS[p.icon_key] ?? ICONS.globe;
              const Icon = cfg.icon;
              return (
                <button
                  key={p.id}
                  onClick={() => open(p.url)}
                  className="w-full flex items-center gap-3 bg-white rounded-2xl p-4 border border-slate-100 shadow-sm active:scale-95 transition"
                >
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-white shrink-0 ${cfg.bg}`}>
                    <Icon size={22} />
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <p className="font-semibold text-slate-900 text-sm">{p.label}</p>
                    <p className="text-xs text-slate-400 truncate">{p.url.replace(/^https?:\/\//, '')}</p>
                  </div>
                  <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600 shrink-0">
                    Swiv <ExternalLink size={14} />
                  </span>
                </button>
              );
            })}
          </div>
        )}

        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm mt-4">
          <h3 className="font-bold text-slate-900 text-sm">Kontak Ofisyèl</h3>
          <a href="mailto:toupreed@gmail.com" className="mt-2 flex items-center gap-2 text-emerald-600 font-semibold text-sm hover:underline">
            <Mail size={16} /> toupreed@gmail.com
          </a>
          <p className="text-xs text-slate-500 mt-1">Voye nou yon imèl, n ap reponn ou pi vit posib.</p>
        </div>

        <button
          onClick={onBack}
          className="w-full mt-6 py-3 rounded-xl border border-slate-200 text-slate-700 font-semibold text-sm hover:bg-slate-50 active:scale-95 transition"
        >
          Retounen
        </button>
      </div>
    </div>
  );
}
