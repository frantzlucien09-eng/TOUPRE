import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { OAUTH_INTENT_KEY } from '@/lib/auth';
import { useToast } from '@/lib/toast';
import { Loader2 } from 'lucide-react';

type Props = {
  /** Which app is signing in — determines redirect route after OAuth */
  context: 'vendor' | 'customer' | 'admin';
  /** Visual variant */
  variant?: 'light' | 'dark';
  /** Label override */
  label?: string;
  className?: string;
};

function GoogleIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
      <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z" />
    </svg>
  );
}

export function GoogleSignInButton({ context, variant = 'light', label, className = '' }: Props) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleGoogle = async () => {
    setLoading(true);
    try {
      localStorage.setItem(OAUTH_INTENT_KEY, context);
      const hash =
        context === 'admin' ? 'admin'
          : context === 'vendor' ? 'oauth-vendor'
            : '';
      const redirectTo = `${window.location.origin}/#${hash}`;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          queryParams: context === 'admin'
            ? { access_type: 'offline', prompt: 'consent' }
            : undefined,
        },
      });
      if (error) throw error;
    } catch (err) {
      localStorage.removeItem(OAUTH_INTENT_KEY);
      const msg = err instanceof Error ? err.message : 'Erè ak koneksyon Google, eseye ankò';
      toast(msg, 'error');
      setLoading(false);
    }
  };

  const isDark = variant === 'dark';

  return (
    <button
      type="button"
      onClick={handleGoogle}
      disabled={loading}
      className={`w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-3 active:scale-95 transition disabled:opacity-60 ${className} ${
        isDark
          ? 'bg-white hover:bg-slate-100 text-slate-800 border border-slate-300'
          : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200'
      }`}
    >
      {loading ? <Loader2 size={18} className="animate-spin" /> : <GoogleIcon />}
      {label ?? 'Kontinye ak Google'}
    </button>
  );
}
