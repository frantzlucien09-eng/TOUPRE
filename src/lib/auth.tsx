import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase';
import type { Vendor, Customer } from './types';

export const OAUTH_INTENT_KEY = 'toupre_oauth_intent';

type AuthState = {
  session: Session | null;
  user: User | null;
  vendor: Vendor | null;
  customer: Customer | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshVendor: () => Promise<void>;
  reloadVendor: (uid: string) => Promise<Vendor | null>;
};

const AuthContext = createContext<AuthState>({
  session: null,
  user: null,
  vendor: null,
  customer: null,
  loading: true,
  signOut: async () => {},
  refreshVendor: async () => {},
  reloadVendor: async () => null,
});

async function ensureVendorFromOAuthIntent(user: User): Promise<void> {
  const intent = localStorage.getItem(OAUTH_INTENT_KEY);
  if (intent !== 'vendor') return;

  const { data: existing } = await supabase
    .from('vendors')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!existing) {
    const fullName =
      (user.user_metadata?.full_name as string | undefined) ||
      (user.user_metadata?.name as string | undefined) ||
      user.email?.split('@')[0] ||
      'Vandè TOUPRE';

    await supabase.from('vendors').insert({
      user_id: user.id,
      business_name: fullName,
      email: user.email ?? null,
      status: 'pending',
    });

    await supabase.from('profiles').update({ role: 'vendor' }).eq('user_id', user.id);
  }

  localStorage.removeItem(OAUTH_INTENT_KEY);
}

async function ensureCustomerFromOAuthIntent(user: User): Promise<void> {
  const intent = localStorage.getItem(OAUTH_INTENT_KEY);
  if (intent !== 'customer') return;

  const { data: existing } = await supabase
    .from('customers')
    .select('id')
    .or(`id.eq.${user.id},user_id.eq.${user.id}`)
    .maybeSingle();

  if (!existing) {
    const fullName =
      (user.user_metadata?.full_name as string | undefined) ||
      (user.user_metadata?.name as string | undefined) ||
      user.email?.split('@')[0] ||
      'Kliyan TOUPRE';

    await supabase.from('customers').insert({
      id: user.id,
      user_id: user.id,
      full_name: fullName,
      email: user.email ?? null,
    });

    await supabase.from('profiles').update({ role: 'customer' }).eq('user_id', user.id);
  }

  localStorage.removeItem(OAUTH_INTENT_KEY);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const pendingProfileUid = useRef<string | null>(null);

  const loadVendor = async (uid: string) => {
    const { data: vData, error: vError } = await supabase
      .from('vendors')
      .select('*')
      .eq('user_id', uid)
      .maybeSingle();
    if (vError) {
      console.error('[auth] loadVendor error:', vError.message);
    }
    setVendor(vData as Vendor | null);

    if (!vData) {
      const { data: cData, error: cError } = await supabase
        .from('customers')
        .select('*')
        .or(`id.eq.${uid},user_id.eq.${uid}`)
        .is('deleted_at', null)
        .limit(1)
        .maybeSingle();
      if (cError) {
        console.error('[auth] loadCustomer error:', cError.message);
      }
      setCustomer(cData as Customer | null);
    } else {
      setCustomer(null);
    }

    return vData as Vendor | null;
  };

  const bootstrapUser = async (u: User) => {
    await ensureVendorFromOAuthIntent(u);
    await ensureCustomerFromOAuthIntent(u);
    return loadVendor(u.id);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      if (data.session?.user) {
        bootstrapUser(data.session.user).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, sess) => {
      (async () => {
        setSession(sess);
        setUser(sess?.user ?? null);
        if (sess?.user) {
          if (event === 'SIGNED_IN' && pendingProfileUid.current === sess.user.id) {
            return;
          }
          await bootstrapUser(sess.user);
        } else {
          setVendor(null);
          setCustomer(null);
        }
        setLoading(false);
      })();
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    localStorage.removeItem(OAUTH_INTENT_KEY);
    await supabase.auth.signOut();
    setVendor(null);
    setCustomer(null);
  };

  const refreshVendor = async () => {
    if (user) await loadVendor(user.id);
  };

  return (
    <AuthContext.Provider value={{
      session, user, vendor, customer, loading, signOut, refreshVendor,
      reloadVendor: async (uid: string) => {
        pendingProfileUid.current = uid;
        const v = await loadVendor(uid);
        pendingProfileUid.current = null;
        return v;
      },
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
