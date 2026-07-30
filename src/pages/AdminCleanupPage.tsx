import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/lib/toast';
import { useConfirm } from '@/lib/confirm';
import { Loader2, Trash2, Bell, Package, ShoppingCart, Users, AlertTriangle } from 'lucide-react';

type CleanupAction = {
  key: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  danger?: boolean;
  run: () => Promise<number>;
};

export function AdminCleanupPage() {
  const { toast } = useToast();
  const { confirm } = useConfirm();
  const [running, setRunning] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, number>>({});

  const actions: CleanupAction[] = [
    {
      key: 'old_notifications',
      title: 'Efase Notifikasyon Li',
      description: 'Efase notifikasyon ki deja li epi ki gen plis pase 30 jou.',
      icon: <Bell size={16} />,
      run: async () => {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 30);
        const { data, error } = await supabase
          .from('notifications')
          .delete()
          .eq('read', true)
          .lt('created_at', cutoff.toISOString())
          .select('id');
        if (error) throw error;
        return data?.length ?? 0;
      },
    },
    {
      key: 'cancelled_orders',
      title: 'Soft-delete Kòmand Anile',
      description: 'Make deleted_at sou kòmand ki anile epi ki gen plis pase 90 jou.',
      icon: <ShoppingCart size={16} />,
      run: async () => {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 90);
        const now = new Date().toISOString();
        const { data, error } = await supabase
          .from('orders')
          .update({ deleted_at: now })
          .eq('status', 'cancelled')
          .is('deleted_at', null)
          .lt('created_at', cutoff.toISOString())
          .select('id');
        if (error) {
          // Fallback: hard-count only if column missing — don't delete without soft-delete
          throw error;
        }
        return data?.length ?? 0;
      },
    },
    {
      key: 'rejected_products',
      title: 'Soft-delete Pwodwi Rejte',
      description: 'Make deleted_at sou pwodwi rejte oswa inaktif dempi 60 jou.',
      icon: <Package size={16} />,
      run: async () => {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 60);
        const now = new Date().toISOString();
        const { data, error } = await supabase
          .from('products')
          .update({ deleted_at: now, active: false })
          .eq('active', false)
          .is('deleted_at', null)
          .lt('updated_at', cutoff.toISOString())
          .select('id');
        if (error) throw error;
        return data?.length ?? 0;
      },
    },
    {
      key: 'suspended_vendors',
      title: 'Soft-delete Vandè Sispann',
      description: 'Make deleted_at sou vandè sispann dempi 180 jou (pa efase done yo nèt).',
      icon: <Users size={16} />,
      danger: true,
      run: async () => {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 180);
        const now = new Date().toISOString();
        const { data, error } = await supabase
          .from('vendors')
          .update({ deleted_at: now, updated_at: now })
          .eq('status', 'suspended')
          .is('deleted_at', null)
          .lt('updated_at', cutoff.toISOString())
          .select('id');
        if (error) throw error;
        return data?.length ?? 0;
      },
    },
    {
      key: 'rejected_withdrawals',
      title: 'Nòt Demann Retire Rejte',
      description: 'Make processed_at sou demann retire rejte ki pa gen dat tretman.',
      icon: <Trash2 size={16} />,
      run: async () => {
        const now = new Date().toISOString();
        const { data, error } = await supabase
          .from('withdrawals')
          .update({ processed_at: now })
          .eq('status', 'rejected')
          .is('processed_at', null)
          .select('id');
        if (error) throw error;
        return data?.length ?? 0;
      },
    },
  ];

  const runAction = async (action: CleanupAction) => {
    const ok = await confirm({
      title: action.title,
      message: `${action.description}\n\nAksyon sa a pa ka defèt fasilman. Ou sèten?`,
      confirmText: 'Egzekite',
      danger: action.danger,
    });
    if (!ok) return;

    setRunning(action.key);
    try {
      const count = await action.run();
      setResults((prev) => ({ ...prev, [action.key]: count }));
      toast(`${action.title}: ${count} done trete`);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Erè, eseye ankò', 'error');
    } finally {
      setRunning(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex gap-2.5">
        <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
        <p className="text-xs text-amber-800 leading-relaxed">
          Netwayaj done sèvi pou retire oswa make done ansyen. Preferé soft-delete (`deleted_at`)
          lè kolòn lan disponib. Toujou verifye anvan w egzekite.
        </p>
      </div>

      <div className="space-y-2">
        {actions.map((a) => (
          <div key={a.key} className="bg-white border border-slate-200 rounded-xl p-4 flex items-start gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${a.danger ? 'bg-rose-50 text-rose-600' : 'bg-slate-100 text-slate-600'}`}>
              {a.icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-900">{a.title}</p>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">{a.description}</p>
              {results[a.key] !== undefined && (
                <p className="text-[11px] text-emerald-600 font-semibold mt-1.5">
                  Dènye rezilta: {results[a.key]} done
                </p>
              )}
            </div>
            <button
              disabled={running === a.key}
              onClick={() => runAction(a)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold text-white shrink-0 disabled:opacity-60 ${
                a.danger ? 'bg-rose-600' : 'bg-slate-800'
              }`}
            >
              {running === a.key ? <Loader2 size={14} className="animate-spin" /> : 'Egzekite'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
