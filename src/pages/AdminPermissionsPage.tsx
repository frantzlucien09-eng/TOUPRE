import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAdminAuth } from '@/lib/adminAuth';
import { useToast } from '@/lib/toast';
import { useConfirm } from '@/lib/confirm';
import { formatDateTime, relativeTime } from '@/lib/format';
import { Loader2, Shield, UserCog, ToggleLeft, ToggleRight } from 'lucide-react';

type AdminProfile = {
  id: string;
  user_id?: string | null;
  email: string | null;
  full_name: string | null;
  role: string | null;
  is_active?: boolean | null;
  created_at?: string | null;
  deleted_at?: string | null;
};

type PermissionRow = {
  id: string;
  name?: string | null;
  key?: string | null;
  label?: string | null;
  description?: string | null;
  role?: string | null;
  allowed?: boolean | null;
  enabled?: boolean | null;
};

type RoleRow = {
  id: string;
  name?: string | null;
  label?: string | null;
  description?: string | null;
};

export function AdminPermissionsPage() {
  const { admin } = useAdminAuth();
  const { toast } = useToast();
  const { confirm } = useConfirm();
  const [loading, setLoading] = useState(true);
  const [admins, setAdmins] = useState<AdminProfile[]>([]);
  const [permissions, setPermissions] = useState<PermissionRow[]>([]);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [acting, setActing] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [aRes, pRes, rRes] = await Promise.all([
      supabase.from('admin_profiles').select('*').order('created_at', { ascending: false }).limit(100),
      supabase.from('admin_permissions').select('*').limit(200),
      supabase.from('admin_roles').select('*').limit(50),
    ]);

    if (aRes.error) toast('Erè lè w ap chaje admin yo', 'error');
    setAdmins((aRes.data ?? []) as AdminProfile[]);
    setPermissions((pRes.data ?? []) as PermissionRow[]);
    setRoles((rRes.data ?? []) as RoleRow[]);
    setLoading(false);
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const toggleActive = async (profile: AdminProfile) => {
    if (profile.id === admin?.id || profile.user_id === admin?.id) {
      toast('Ou pa ka dezaktive pwòp kont ou', 'error');
      return;
    }
    const next = !(profile.is_active ?? true);
    const ok = await confirm({
      title: next ? 'Aktive Admin' : 'Dezaktive Admin',
      message: `${next ? 'Aktive' : 'Dezaktive'} ${profile.full_name ?? profile.email}?`,
      confirmText: 'Wi',
      danger: !next,
    });
    if (!ok) return;

    setActing(profile.id);
    const { error } = await supabase
      .from('admin_profiles')
      .update({ is_active: next })
      .eq('id', profile.id);
    setActing(null);
    if (error) toast(error.message || 'Erè, eseye ankò', 'error');
    else { toast(next ? 'Admin aktive' : 'Admin dezaktive'); load(); }
  };

  const setRole = async (profile: AdminProfile, role: string) => {
    if (admin?.role !== 'super_admin') {
      toast('Sèlman soupèt admin ka chanje wòl', 'error');
      return;
    }
    setActing(profile.id);
    const { error } = await supabase
      .from('admin_profiles')
      .update({ role })
      .eq('id', profile.id);
    setActing(null);
    if (error) toast(error.message || 'Erè, eseye ankò', 'error');
    else { toast('Wòl mete ajou'); load(); }
  };

  const togglePermission = async (perm: PermissionRow) => {
    const next = !(perm.allowed ?? perm.enabled ?? true);
    setActing(perm.id);
    const updates: Record<string, unknown> = {};
    if ('allowed' in perm) updates.allowed = next;
    if ('enabled' in perm) updates.enabled = next;
    if (Object.keys(updates).length === 0) {
      updates.allowed = next;
      updates.enabled = next;
    }
    const { error } = await supabase.from('admin_permissions').update(updates).eq('id', perm.id);
    setActing(null);
    if (error) toast(error.message || 'Erè, eseye ankò', 'error');
    else load();
  };

  return (
    <div className="space-y-5">
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-slate-400" /></div>
      ) : (
        <>
          <section>
            <h3 className="text-sm font-bold text-slate-900 mb-2 flex items-center gap-2">
              <UserCog size={16} className="text-emerald-600" /> Kont Admin
            </h3>
            {admins.length === 0 ? (
              <Empty text="Pa gen pwofil admin." />
            ) : (
              <div className="space-y-1.5">
                {admins.map((a) => (
                  <div key={a.id} className="bg-white border border-slate-200 rounded-xl px-3 py-3 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-emerald-500/15 text-emerald-700 flex items-center justify-center text-xs font-bold shrink-0">
                      {(a.full_name ?? a.email ?? 'A')[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">{a.full_name ?? 'Admin'}</p>
                      <p className="text-xs text-slate-500 truncate">{a.email}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {a.role ?? 'admin'}
                        {a.created_at ? ` · ${relativeTime(a.created_at)}` : ''}
                        {a.deleted_at ? ' · efase' : ''}
                      </p>
                    </div>
                    {admin?.role === 'super_admin' && (
                      <select
                        value={a.role ?? 'admin'}
                        onChange={(e) => setRole(a, e.target.value)}
                        className="text-[11px] border border-slate-200 rounded-lg px-2 py-1.5 bg-white"
                      >
                        <option value="admin">admin</option>
                        <option value="super_admin">super_admin</option>
                      </select>
                    )}
                    <button
                      disabled={acting === a.id}
                      onClick={() => toggleActive(a)}
                      className="w-9 h-9 rounded-lg bg-slate-50 flex items-center justify-center"
                    >
                      {acting === a.id
                        ? <Loader2 size={14} className="animate-spin" />
                        : (a.is_active ?? true)
                          ? <ToggleRight size={18} className="text-emerald-600" />
                          : <ToggleLeft size={18} className="text-slate-400" />}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {roles.length > 0 && (
            <section>
              <h3 className="text-sm font-bold text-slate-900 mb-2 flex items-center gap-2">
                <Shield size={16} className="text-emerald-600" /> Wòl
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {roles.map((r) => (
                  <div key={r.id} className="bg-white border border-slate-200 rounded-xl p-3">
                    <p className="text-sm font-semibold text-slate-900">{r.label ?? r.name ?? r.id}</p>
                    {r.description && <p className="text-xs text-slate-500 mt-1">{r.description}</p>}
                  </div>
                ))}
              </div>
            </section>
          )}

          <section>
            <h3 className="text-sm font-bold text-slate-900 mb-2 flex items-center gap-2">
              <Shield size={16} className="text-emerald-600" /> Pèmisyon
            </h3>
            {permissions.length === 0 ? (
              <Empty text="Pa gen lis pèmisyon detaye. Aksè admin baze sou admin_profiles." />
            ) : (
              <div className="space-y-1.5">
                {permissions.map((p) => {
                  const on = p.allowed ?? p.enabled ?? true;
                  return (
                    <div key={p.id} className="bg-white border border-slate-200 rounded-xl px-3 py-3 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-900">{p.label ?? p.name ?? p.key ?? p.id}</p>
                        <p className="text-xs text-slate-500">{p.description ?? p.role ?? ''}</p>
                      </div>
                      <button
                        disabled={acting === p.id}
                        onClick={() => togglePermission(p)}
                        className="w-9 h-9 rounded-lg bg-slate-50 flex items-center justify-center"
                      >
                        {acting === p.id
                          ? <Loader2 size={14} className="animate-spin" />
                          : on
                            ? <ToggleRight size={18} className="text-emerald-600" />
                            : <ToggleLeft size={18} className="text-slate-400" />}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <p className="text-[11px] text-slate-400">
            Kont kounye a: {admin?.full_name ?? admin?.email} ({admin?.role})
            {admin?.id ? ` · ${formatDateTime(new Date().toISOString())}` : ''}
          </p>
        </>
      )}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-sm text-slate-400">
      {text}
    </div>
  );
}
