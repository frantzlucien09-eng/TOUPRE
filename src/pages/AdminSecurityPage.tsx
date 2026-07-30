import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/lib/toast';
import { useConfirm } from '@/lib/confirm';
import { formatDateTime, relativeTime } from '@/lib/format';
import type { NameChangeRequest, AvatarReviewRequest, Vendor } from '@/lib/types';
import {
  Loader2, Lock, Smartphone, ShieldAlert, CheckCircle2, XCircle, Image as ImageIcon,
} from 'lucide-react';

type DeviceSession = {
  id: string;
  user_id?: string | null;
  device_name?: string | null;
  device_type?: string | null;
  platform?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
  last_active_at?: string | null;
  created_at?: string | null;
  revoked_at?: string | null;
};

type ActivityEntry = {
  id: string;
  action: string;
  actor_name: string | null;
  actor_type?: string | null;
  entity_type?: string | null;
  created_at: string;
};

type Tab = 'reviews' | 'sessions' | 'activity';

export function AdminSecurityPage() {
  const { toast } = useToast();
  const { confirm } = useConfirm();
  const [tab, setTab] = useState<Tab>('reviews');
  const [loading, setLoading] = useState(true);
  const [names, setNames] = useState<(NameChangeRequest & { vendor?: Pick<Vendor, 'business_name'> | null })[]>([]);
  const [avatars, setAvatars] = useState<(AvatarReviewRequest & { vendor?: Pick<Vendor, 'business_name'> | null })[]>([]);
  const [sessions, setSessions] = useState<DeviceSession[]>([]);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [acting, setActing] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const loadReviews = useCallback(async () => {
    setLoading(true);
    const [nRes, aRes] = await Promise.all([
      supabase.from('name_change_requests').select('*, vendor:vendors(business_name)').eq('status', 'pending').order('created_at', { ascending: false }).limit(50),
      supabase.from('avatar_review_requests').select('*, vendor:vendors(business_name)').eq('status', 'pending').order('created_at', { ascending: false }).limit(50),
    ]);
    setNames((nRes.data ?? []) as typeof names);
    setAvatars((aRes.data ?? []) as typeof avatars);
    setLoading(false);
  }, []);

  const loadSessions = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('device_sessions')
      .select('*')
      .order('last_active_at', { ascending: false })
      .limit(100);
    if (error) {
      // fallback order by created_at
      const { data: d2 } = await supabase.from('device_sessions').select('*').order('created_at', { ascending: false }).limit(100);
      setSessions((d2 ?? []) as DeviceSession[]);
    } else {
      setSessions((data ?? []) as DeviceSession[]);
    }
    setLoading(false);
  }, []);

  const loadActivity = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('activity_log')
      .select('id, action, actor_name, actor_type, entity_type, created_at')
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) {
      const { data: d2 } = await supabase
        .from('activity_logs')
        .select('id, action, actor_name, actor_type, entity_type, created_at')
        .order('created_at', { ascending: false })
        .limit(100);
      setActivity((d2 ?? []) as ActivityEntry[]);
    } else {
      setActivity((data ?? []) as ActivityEntry[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (tab === 'reviews') loadReviews();
    else if (tab === 'sessions') loadSessions();
    else loadActivity();
  }, [tab, loadReviews, loadSessions, loadActivity]);

  const handleName = async (req: NameChangeRequest, approve: boolean) => {
    setActing(true);
    const { error } = approve
      ? await supabase.rpc('approve_name_change', { p_request_id: req.id, p_note: null })
      : await supabase.rpc('reject_name_change', { p_request_id: req.id, p_reason: rejectReason.trim() || null });
    setActing(false);
    if (error) toast(error.message || 'Erè, eseye ankò', 'error');
    else { toast(approve ? 'Non apwouve' : 'Non rejte'); setRejectReason(''); loadReviews(); }
  };

  const handleAvatar = async (req: AvatarReviewRequest, approve: boolean) => {
    setActing(true);
    const { error } = approve
      ? await supabase.rpc('approve_avatar', { p_request_id: req.id })
      : await supabase.rpc('reject_avatar', { p_request_id: req.id, p_reason: rejectReason.trim() || null });
    setActing(false);
    if (error) toast(error.message || 'Erè, eseye ankò', 'error');
    else { toast(approve ? 'Avatar apwouve' : 'Avatar rejte'); setRejectReason(''); loadReviews(); }
  };

  const revokeSession = async (s: DeviceSession) => {
    const ok = await confirm({
      title: 'Revoke Sesyon',
      message: 'Ou vle revoke sesyon aparèy sa a?',
      confirmText: 'Revoke',
      danger: true,
    });
    if (!ok) return;
    setActing(true);
    const { error } = await supabase
      .from('device_sessions')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', s.id);
    setActing(false);
    if (error) {
      const { error: err2 } = await supabase.from('device_sessions').delete().eq('id', s.id);
      if (err2) toast(err2.message || 'Erè, eseye ankò', 'error');
      else { toast('Sesyon revoke'); loadSessions(); }
    } else {
      toast('Sesyon revoke');
      loadSessions();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-1.5 bg-white border border-slate-200 rounded-xl p-1">
        {([
          { key: 'reviews' as Tab, label: 'Revizyon' },
          { key: 'sessions' as Tab, label: 'Sesyon' },
          { key: 'activity' as Tab, label: 'Aktivite' },
        ]).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition ${
              tab === t.key ? 'bg-emerald-500 text-black' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-slate-400" /></div>
      ) : tab === 'reviews' ? (
        <div className="space-y-4">
          <section>
            <h3 className="text-sm font-bold text-slate-900 mb-2 flex items-center gap-2">
              <ShieldAlert size={15} className="text-amber-600" /> Chanjman Non ({names.length})
            </h3>
            {names.length === 0 ? <Empty text="Pa gen demann non an atant." /> : names.map((n) => (
              <div key={n.id} className="bg-white border border-slate-200 rounded-xl p-4 mb-2 space-y-2">
                <p className="text-sm font-semibold text-slate-900">{n.vendor?.business_name ?? 'Vandè'}</p>
                <p className="text-xs text-slate-600">
                  <span className="line-through">{n.old_name}</span> → <span className="text-emerald-700 font-semibold">{n.requested_name}</span>
                </p>
                <p className="text-[11px] text-slate-400">OTP {n.otp_verified ? 'verifye' : 'pa verifye'} · {relativeTime(n.created_at)}</p>
                <div className="flex gap-2">
                  <button disabled={acting || !n.otp_verified} onClick={() => handleName(n, true)} className="flex-1 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold disabled:opacity-50 flex items-center justify-center gap-1">
                    <CheckCircle2 size={14} /> Apwouve
                  </button>
                  <button disabled={acting} onClick={() => handleName(n, false)} className="flex-1 py-2 rounded-xl bg-rose-600 text-white text-xs font-semibold disabled:opacity-50 flex items-center justify-center gap-1">
                    <XCircle size={14} /> Rejte
                  </button>
                </div>
              </div>
            ))}
          </section>

          <section>
            <h3 className="text-sm font-bold text-slate-900 mb-2 flex items-center gap-2">
              <ImageIcon size={15} className="text-amber-600" /> Avatar ({avatars.length})
            </h3>
            {avatars.length === 0 ? <Empty text="Pa gen demann avatar an atant." /> : avatars.map((a) => (
              <div key={a.id} className="bg-white border border-slate-200 rounded-xl p-4 mb-2 space-y-2">
                <div className="flex items-center gap-3">
                  <img src={a.new_avatar_url} alt="" className="w-14 h-14 rounded-xl object-cover border border-slate-200" />
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{a.vendor?.business_name ?? 'Vandè'}</p>
                    <p className="text-[11px] text-slate-400">{relativeTime(a.created_at)}</p>
                  </div>
                </div>
                <input
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Rezon rejè..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
                />
                <div className="flex gap-2">
                  <button disabled={acting} onClick={() => handleAvatar(a, true)} className="flex-1 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold disabled:opacity-50 flex items-center justify-center gap-1">
                    <CheckCircle2 size={14} /> Apwouve
                  </button>
                  <button disabled={acting} onClick={() => handleAvatar(a, false)} className="flex-1 py-2 rounded-xl bg-rose-600 text-white text-xs font-semibold disabled:opacity-50 flex items-center justify-center gap-1">
                    <XCircle size={14} /> Rejte
                  </button>
                </div>
              </div>
            ))}
          </section>
        </div>
      ) : tab === 'sessions' ? (
        sessions.length === 0 ? (
          <Empty text="Pa gen sesyon aparèy anrejistre." />
        ) : (
          <div className="space-y-1.5">
            {sessions.map((s) => (
              <div key={s.id} className="bg-white border border-slate-200 rounded-xl px-3 py-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500">
                  <Smartphone size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">
                    {s.device_name ?? s.platform ?? s.device_type ?? 'Aparèy'}
                  </p>
                  <p className="text-xs text-slate-500 truncate">
                    {s.ip_address ?? '—'} · {s.user_agent ? s.user_agent.slice(0, 40) : '—'}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {relativeTime(s.last_active_at ?? s.created_at)}
                    {s.revoked_at ? ' · revoke' : ''}
                  </p>
                </div>
                {!s.revoked_at && (
                  <button
                    disabled={acting}
                    onClick={() => revokeSession(s)}
                    className="px-2.5 py-1.5 rounded-lg bg-rose-50 text-rose-700 text-[11px] font-semibold"
                  >
                    Revoke
                  </button>
                )}
              </div>
            ))}
          </div>
        )
      ) : (
        activity.length === 0 ? (
          <Empty text="Pa gen aktivite sekirite." />
        ) : (
          <div className="space-y-1.5">
            {activity.map((a) => (
              <div key={a.id} className="bg-white border border-slate-200 rounded-xl px-3 py-3 flex items-center gap-3">
                <Lock size={14} className="text-slate-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-900 font-medium truncate">{a.action}</p>
                  <p className="text-xs text-slate-400">
                    {a.actor_name ?? a.actor_type ?? 'Sistèm'}
                    {a.entity_type ? ` · ${a.entity_type}` : ''}
                  </p>
                </div>
                <span className="text-[11px] text-slate-400 shrink-0">{formatDateTime(a.created_at)}</span>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-sm text-slate-400 mb-2">
      {text}
    </div>
  );
}
