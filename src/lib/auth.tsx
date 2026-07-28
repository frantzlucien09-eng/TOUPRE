import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase';
import type { Vendor, Customer } from './types';

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
        .eq('id', uid)
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

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      if (data.session?.user) {
        loadVendor(data.session.user.id).finally(() => setLoading(false));
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
          await loadVendor(sess.user.id);
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
