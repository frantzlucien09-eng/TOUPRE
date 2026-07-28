import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { relativeTime } from '@/lib/format';
import type { Notification } from '@/lib/types';
import { Modal } from './Modal';
import { EmptyState } from './EmptyState';
import { Bell, MessageSquare, Wallet, Shield, Info } from 'lucide-react';

export function NotificationsPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { vendor } = useAuth();
  const [items, setItems] = useState<Notification[]>([]);

  const load = async () => {
    if (!vendor) return;
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', vendor.id)
      .order('created_at', { ascending: false })
      .limit(50);
    setItems((data ?? []) as Notification[]);
    await supabase.from('notifications').update({ read: true }).eq('user_id', vendor.id).eq('read', false);
  };

  useEffect(() => {
    if (open) load();
  }, [open, vendor]);

  const iconFor = (type: string) => {
    switch (type) {
      case 'order': return <img src="/toupre_vande_logo.png" alt="" className="w-[18px] h-[18px] object-contain" />;
      case 'message': return <MessageSquare size={18} className="text-blue-600" />;
      case 'withdrawal': return <Wallet size={18} className="text-amber-600" />;
      case 'trust': return <Shield size={18} className="text-red-600" />;
      default: return <Info size={18} className="text-slate-600" />;
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Notifikasyon">
      {items.length === 0 ? (
        <EmptyState icon={<Bell size={22} />} title="Pa gen notifikasyon" message="Nouvo kòmand, mesaj, ak chanjman ap parèt isit la." />
      ) : (
        <div className="space-y-2">
          {items.map((n) => (
            <div key={n.id} className={`flex items-start gap-3 p-3 rounded-xl ${n.read ? 'bg-white' : 'bg-emerald-50'}`}>
              <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                {iconFor(n.type)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-900 text-sm">{n.title}</p>
                {n.body && <p className="text-xs text-slate-600 mt-0.5">{n.body}</p>}
                <p className="text-[11px] text-slate-400 mt-1">{relativeTime(n.created_at)}</p>
              </div>
              {!n.read && <span className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5 shrink-0" />}
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
