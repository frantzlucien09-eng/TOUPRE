import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/lib/toast';
import { Logo } from '@/components/Logo';
import { Shield, Mail, Lock, Loader2 } from 'lucide-react';
import { GoogleSignInButton } from '@/components/GoogleSignInButton';

export function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      const { data: adminRow } = await supabase
        .from('admin_profiles')
        .select('id, role')
        .eq('id', data.user?.id)
        .maybeSingle();

      if (!adminRow) {
        await supabase.auth.signOut();
        throw new Error('Kont sa a pa gen aksè admin.');
      }

      toast('Byenveni sou Sit Admin');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erè, eseye ankò';
      toast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-10">
        <div className="mb-8 flex flex-col items-center">
          <div className="w-16 h-16 rounded-2xl bg-slate-700/60 border border-slate-600 flex items-center justify-center mb-3 overflow-hidden">
            <img src="/toupre_vande_logo.png" alt="TOUPRE" className="w-12 h-12 object-contain" />
          </div>
          <Logo size="sm" />
          <p className="text-slate-400 text-sm mt-3 text-center max-w-xs">
            Sit Administrasyon TOUPRE — aksè rezève pou administratè yo.
          </p>
        </div>

        <div className="w-full max-w-sm bg-slate-800/80 backdrop-blur rounded-2xl shadow-xl border border-slate-700 p-6">
          <h1 className="text-white font-bold text-lg mb-1">Konekte kòm Admin</h1>
          <p className="text-slate-400 text-xs mb-5">
            Sèlman kont ki gen wòl admin oswa soupèt admin ka konekte isit la.
          </p>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                <Mail size={18} />
              </div>
              <input
                type="email"
                placeholder="Imèl Admin"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-900/60 border border-slate-700 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
              />
            </div>
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                <Lock size={18} />
              </div>
              <input
                type="password"
                placeholder="Modpas"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-900/60 border border-slate-700 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm flex items-center justify-center gap-2 active:scale-95 transition disabled:opacity-60"
            >
              {loading && <Loader2 size={18} className="animate-spin" />}
              Konekte
            </button>
          </form>
          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px bg-white/20" />
            <span className="text-xs text-slate-400">oswa</span>
            <div className="flex-1 h-px bg-white/20" />
          </div>
          <GoogleSignInButton context="admin" variant="dark" />
        </div>

        <button
          onClick={() => { window.location.hash = ''; window.location.reload(); }}
          className="mt-6 text-xs text-slate-500 hover:text-slate-300 transition"
        >
          ← Retounen nan App Vandè
        </button>
      </div>
    </div>
  );
}
