import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAdminAuth } from '@/lib/adminAuth';
import { useToast } from '@/lib/toast';
import { useConfirm } from '@/lib/confirm';
import { formatDateTime, relativeTime } from '@/lib/format';
import { Loader2, Send, Users, ShoppingBag, Megaphone } from 'lucide-react';

type Audience = 'vendors' | 'customers' | 'all';

type BroadcastRow = {
  id: string;
  title?: string | null;
  body?: string | null;
  message?: string | null;
  audience?: string | null;
  target_audience?: string | null;
  status?: string | null;
  created_at?: string | null;
  sent_at?: string | null;
};

export function AdminBroadcastPage() {
  const { admin } = useAdminAuth();
  const { toast } = useToast();
  const { confirm } = useConfirm();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState<Audience>('vendors');
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState<BroadcastRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState({ vendors: 0, customers: 0 });

  const loadHistory = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('broadcast_messages')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    if (!error && data) {
      setHistory(data as BroadcastRow[]);
    } else {
      setHistory([]);
    }
    setLoading(false);
  }, []);

  const loadCounts = useCallback(async () => {
    const [{ count: vendors }, { count: customers }] = await Promise.all([
      supabase.from('vendors').select('id', { count: 'exact', head: true }),
      supabase.from('customers').select('id', { count: 'exact', head: true }),
    ]);
    setCounts({ vendors: vendors ?? 0, customers: customers ?? 0 });
  }, []);

  useEffect(() => {
    loadHistory();
    loadCounts();
  }, [loadHistory, loadCounts]);

  const recipientIds = async (): Promise<string[]> => {
    const ids = new Set<string>();
    if (audience === 'vendors' || audience === 'all') {
      const { data } = await supabase.from('vendors').select('id, user_id').limit(2000);
      for (const v of data ?? []) {
        const row = v as { id: string; user_id?: string | null };
        ids.add(row.user_id || row.id);
      }
    }
    if (audience === 'customers' || audience === 'all') {
      const { data } = await supabase.from('customers').select('id, user_id').limit(2000);
      for (const c of data ?? []) {
        const row = c as { id: string; user_id?: string | null };
        ids.add(row.user_id || row.id);
      }
    }
    return Array.from(ids);
  };

  const send = async () => {
    if (!title.trim() || !body.trim()) {
      toast('Antre yon tit ak yon mesaj', 'error');
      return;
    }
    const ok = await confirm({
      title: 'Voye Mesaj Mas',
      message: `Voye mesaj sa a bay ${audience === 'all' ? 'tout itilizatè' : audience === 'vendors' ? 'tout vandè' : 'tout kliyan'}?`,
      confirmText: 'Voye',
    });
    if (!ok) return;

    setSending(true);
    try {
      const ids = await recipientIds();
      if (ids.length === 0) {
        toast('Pa gen destinatè', 'error');
        setSending(false);
        return;
      }

      const now = new Date().toISOString();
      const broadcastPayload = {
        title: title.trim(),
        body: body.trim(),
        message: body.trim(),
        audience,
        target_audience: audience,
        status: 'sent',
        sent_at: now,
        created_at: now,
        created_by: admin?.id ?? null,
      };

      const { data: broadcastRow, error: bErr } = await supabase
        .from('broadcast_messages')
        .insert(broadcastPayload)
        .select('id')
        .maybeSingle();

      // Fan-out notifications in batches
      const chunkSize = 100;
      let sent = 0;
      for (let i = 0; i < ids.length; i += chunkSize) {
        const chunk = ids.slice(i, i + chunkSize).map((userId) => ({
          user_id: userId,
          type: 'system',
          title: title.trim(),
          body: body.trim(),
          read: false,
        }));
        const { error } = await supabase.from('notifications').insert(chunk);
        if (!error) sent += chunk.length;
      }

      if (bErr && sent === 0) {
        toast(bErr.message || 'Erè, eseye ankò', 'error');
      } else {
        toast(`Mesaj voye bay ${sent} moun${broadcastRow ? '' : ' (istorik lokal)'}`);
        setTitle('');
        setBody('');
        loadHistory();
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Erè, eseye ankò', 'error');
    } finally {
      setSending(false);
    }
  };

  const audienceCount =
    audience === 'vendors' ? counts.vendors
      : audience === 'customers' ? counts.customers
        : counts.vendors + counts.customers;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2.5">
        <Stat icon={<Users size={14} />} label="Vandè" value={String(counts.vendors)} />
        <Stat icon={<ShoppingBag size={14} />} label="Kliyan" value={String(counts.customers)} />
        <Stat icon={<Megaphone size={14} />} label="Destinatè" value={String(audienceCount)} />
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
        <h3 className="text-sm font-bold text-slate-900">Nouvo Mesaj Mas</h3>
        <div className="flex flex-wrap gap-1.5">
          {([
            { key: 'vendors' as Audience, label: 'Vandè' },
            { key: 'customers' as Audience, label: 'Kliyan' },
            { key: 'all' as Audience, label: 'Tout' },
          ]).map((a) => (
            <button
              key={a.key}
              onClick={() => setAudience(a.key)}
              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold ${
                audience === a.key ? 'bg-emerald-500 text-black' : 'bg-slate-50 border border-slate-200 text-slate-600'
              }`}
            >
              {a.label}
            </button>
          ))}
        </div>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Tit mesaj..."
          className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={4}
          placeholder="Ekri mesaj la..."
          className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
        />
        <button
          disabled={sending}
          onClick={send}
          className="w-full py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          Voye bay {audienceCount} moun
        </button>
      </div>

      <div>
        <h3 className="text-sm font-bold text-slate-900 mb-2">Istorik</h3>
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="animate-spin text-slate-400" /></div>
        ) : history.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-sm text-slate-400">
            Pa gen mesaj mas anrejistre toujou.
          </div>
        ) : (
          <div className="space-y-1.5">
            {history.map((h) => (
              <div key={h.id} className="bg-white border border-slate-200 rounded-xl px-3 py-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900 truncate">{h.title ?? 'Mesaj'}</p>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold shrink-0">
                    {h.audience ?? h.target_audience ?? '—'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1 line-clamp-2">{h.body ?? h.message ?? ''}</p>
                <p className="text-[11px] text-slate-400 mt-1">
                  {relativeTime(h.sent_at ?? h.created_at)} · {formatDateTime(h.sent_at ?? h.created_at)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3">
      <div className="flex items-center gap-1.5 text-slate-500 text-[11px] mb-1">{icon}{label}</div>
      <p className="text-lg font-bold text-slate-900">{value}</p>
    </div>
  );
}
