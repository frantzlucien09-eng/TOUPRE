import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase';

export type AdminRole = 'admin' | 'super_admin';

export type AdminProfile = {
  id: string;
  email: string | null;
  role: AdminRole;
  full_name: string | null;
};

type AdminAuthState = {
  session: Session | null;
  user: User | null;
  admin: AdminProfile | null;
  loading: boolean;
  signOut: () => Promise<void>;
};

const AdminAuthContext = createContext<AdminAuthState>({
  session: null,
  user: null,
  admin: null,
  loading: true,
  signOut: async () => {},
});

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [admin, setAdmin] = useState<AdminProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadAdmin = async (uid: string) => {
    const { data } = await supabase
      .from('admin_profiles')
      .select('id, email, role, full_name')
      .eq('user_id', uid)
      .eq('is_active', true)
      .is('deleted_at', null)
      .maybeSingle();
    setAdmin(data as AdminProfile | null);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      if (data.session?.user) {
        loadAdmin(data.session.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      (async () => {
        setSession(sess);
        setUser(sess?.user ?? null);
        if (sess?.user) {
          await loadAdmin(sess.user.id);
        } else {
          setAdmin(null);
        }
        setLoading(false);
      })();
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setAdmin(null);
  };

  return (
    <AdminAuthContext.Provider value={{ session, user, admin, loading, signOut }}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  return useContext(AdminAuthContext);
}
