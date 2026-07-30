import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/lib/toast';
import type { Message, Product, Vendor } from '@/lib/types';
import { formatHTG } from '@/lib/format';
import {
  ArrowLeft, Send, Loader2, MessageCircle, RefreshCw, Store,
} from 'lucide-react';

type Conversation = {
  vendor_id: string;
  vendor: Pick<Vendor, 'id' | 'business_name' | 'avatar_url'> | null;
  product_id: string | null;
  product: Product | null;
  last_message: Message | null;
  unread_count: number;
};

function timeAgo(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = (now.getTime() - d.getTime()) / 1000;
  if (diff < 60) return 'kounye a';
  if (diff < 3600) return `${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} èdtan`;
  if (diff < 172800) return 'Yè';
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

function isMine(msg: Message, customerId: string) {
  return msg.sender_id === customerId;
}

function customerMessageOrFilter(customerId: string): string {
  return [
    `sender_id.eq.${customerId}`,
    `recipient_id.eq.${customerId}`,
    `receiver_id.eq.${customerId}`,
  ].join(',');
}

type Props = {
  initialVendorId?: string | null;
  initialProductId?: string | null;
  onClearInitial?: () => void;
};

export function CustomerMessagesPage({ initialVendorId, initialProductId, onClearInitial }: Props) {
  const { user, customer } = useAuth();
  const customerId = customer?.id ?? user?.id ?? null;
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [openVendorId, setOpenVendorId] = useState<string | null>(initialVendorId ?? null);
  const [openProductId, setOpenProductId] = useState<string | null>(initialProductId ?? null);

  useEffect(() => {
    if (initialVendorId) {
      setOpenVendorId(initialVendorId);
      setOpenProductId(initialProductId ?? null);
      onClearInitial?.();
    }
  }, [initialVendorId, initialProductId, onClearInitial]);

  const loadConversations = async () => {
    if (!customerId) return;
    setLoading(true);
    const { data: msgs } = await supabase
      .from('messages')
      .select('*')
      .or(customerMessageOrFilter(customerId))
      .order('created_at', { ascending: false });

    if (!msgs || msgs.length === 0) {
      setConversations([]);
      setLoading(false);
      return;
    }

    const byKey = new Map<string, Message[]>();
    for (const m of msgs as Message[]) {
      const other =
        m.sender_id === customerId
          ? (m.recipient_id ?? m.receiver_id)
          : m.sender_id;
      if (!other) continue;
      const key = `${other}::${m.product_id ?? 'null'}`;
      const list = byKey.get(key) ?? [];
      list.push(m);
      byKey.set(key, list);
    }

    const vendorIds = Array.from(new Set([...byKey.keys()].map((k) => k.split('::')[0])));
    const productIds = Array.from(
      new Set([...byKey.keys()].map((k) => k.split('::')[1]).filter((id) => id && id !== 'null'))
    );

    const [{ data: vendors }, { data: products }] = await Promise.all([
      supabase.from('vendors').select('id, business_name, avatar_url').in('id', vendorIds),
      productIds.length
        ? supabase.from('products').select('*').in('id', productIds)
        : Promise.resolve({ data: [] as Product[] }),
    ]);

    const vendorMap = new Map((vendors ?? []).map((v) => [v.id, v]));
    const productMap = new Map(((products ?? []) as Product[]).map((p) => [p.id, p]));

    const convos: Conversation[] = [];
    for (const [key, list] of byKey) {
      const [vendorId, productKey] = key.split('::');
      const productId = productKey === 'null' ? null : productKey;
      const last = list[0];
      const unread = list.filter(
        (m) => !isMine(m, customerId) && !m.read
      ).length;
      convos.push({
        vendor_id: vendorId,
        vendor: (vendorMap.get(vendorId) as Conversation['vendor']) ?? null,
        product_id: productId,
        product: productId ? productMap.get(productId) ?? null : null,
        last_message: last,
        unread_count: unread,
      });
    }

    convos.sort((a, b) => (b.last_message?.created_at ?? '').localeCompare(a.last_message?.created_at ?? ''));
    setConversations(convos);
    setLoading(false);
  };

  useEffect(() => {
    loadConversations();
    if (!customerId) return;
    const channel = supabase
      .channel('customer-messages-list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `recipient_id=eq.${customerId}` }, () => { loadConversations(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `receiver_id=eq.${customerId}` }, () => { loadConversations(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `sender_id=eq.${customerId}` }, () => { loadConversations(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId]);

  if (!customerId) return null;

  if (openVendorId) {
    const convo = conversations.find(
      (c) => c.vendor_id === openVendorId && (c.product_id ?? null) === (openProductId ?? null)
    );
    return (
      <CustomerChatView
        customerId={customerId}
        vendorId={openVendorId}
        vendor={convo?.vendor ?? null}
        product={convo?.product ?? null}
        onBack={() => { setOpenVendorId(null); setOpenProductId(null); loadConversations(); }}
      />
    );
  }

  return (
    <div className="px-4 py-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-slate-900 text-lg">Mesaj</h2>
        <button onClick={loadConversations} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
          <RefreshCw size={14} />
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-slate-400" /></div>
      ) : conversations.length === 0 ? (
        <div className="text-center py-16 text-sm text-slate-400">
          <MessageCircle size={32} className="mx-auto mb-2 text-slate-300" />
          Pa gen mesaj ankò. Kontakte yon vandè depi yon pwodwi oswa kòmand.
        </div>
      ) : (
        conversations.map((c) => (
          <button
            key={`${c.vendor_id}-${c.product_id ?? 'null'}`}
            onClick={() => { setOpenVendorId(c.vendor_id); setOpenProductId(c.product_id); }}
            className="w-full flex items-center gap-3 bg-white rounded-xl p-3 border border-slate-100 text-left active:scale-95 transition"
          >
            <div className="w-11 h-11 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0 overflow-hidden">
              {c.vendor?.avatar_url ? (
                <img src={c.vendor.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <Store size={18} />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold text-slate-900 text-sm truncate">{c.vendor?.business_name ?? 'Vandè'}</p>
                {c.last_message && (
                  <span className="text-[10px] text-slate-400 shrink-0">{timeAgo(c.last_message.created_at)}</span>
                )}
              </div>
              {c.product && <p className="text-[11px] text-emerald-600 truncate">{c.product.name}</p>}
              <p className="text-xs text-slate-500 truncate mt-0.5">{c.last_message?.body || (c.last_message?.image_url ? '📷 Foto' : '')}</p>
            </div>
            {c.unread_count > 0 && (
              <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-emerald-600 text-white text-[10px] font-bold flex items-center justify-center">
                {c.unread_count}
              </span>
            )}
          </button>
        ))
      )}
    </div>
  );
}

function CustomerChatView({
  customerId, vendorId, vendor, product, onBack,
}: {
  customerId: string;
  vendorId: string;
  vendor: Conversation['vendor'];
  product: Product | null;
  onBack: () => void;
}) {
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    const parts = [
      `and(sender_id.eq.${customerId},recipient_id.eq.${vendorId})`,
      `and(sender_id.eq.${vendorId},recipient_id.eq.${customerId})`,
      `and(sender_id.eq.${customerId},receiver_id.eq.${vendorId})`,
      `and(sender_id.eq.${vendorId},receiver_id.eq.${customerId})`,
    ];
    const { data } = await supabase
      .from('messages')
      .select('*')
      .or(parts.join(','))
      .order('created_at', { ascending: true });
    setMessages((data ?? []) as Message[]);
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel(`customer-chat-${vendorId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `recipient_id=eq.${customerId}` }, () => { load(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `receiver_id=eq.${customerId}` }, () => { load(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `sender_id=eq.${customerId}` }, () => { load(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId, vendorId]);

  useEffect(() => {
    supabase.from('messages')
      .update({ read: true })
      .or(`recipient_id.eq.${customerId},receiver_id.eq.${customerId}`)
      .eq('sender_id', vendorId)
      .eq('read', false)
      .then(() => { load(); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId, vendorId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const send = async () => {
    if (!text.trim()) return;
    setSending(true);
    const body = text.trim();
    setText('');
    const { data: rpcResult, error: rpcError } = await supabase.rpc('send_message', {
      p_sender_id: customerId,
      p_recipient_id: vendorId,
      p_body: body,
      p_product_id: product?.id ?? null,
    });
    if (rpcError || (rpcResult && !rpcResult.success)) {
      toast(rpcResult?.error || rpcError?.message || 'Erè, eseye ankò', 'error');
      setText(body);
    } else {
      await load();
    }
    setSending(false);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-5rem)]">
      <div className="sticky top-0 z-10 bg-white border-b border-slate-100 px-4 py-3 flex items-center gap-3">
        <button onClick={onBack} className="p-1 -ml-1 active:scale-90 transition"><ArrowLeft size={20} /></button>
        <div className="w-9 h-9 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center overflow-hidden">
          {vendor?.avatar_url ? <img src={vendor.avatar_url} alt="" className="w-full h-full object-cover" /> : <Store size={16} />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-900 text-sm truncate">{vendor?.business_name ?? 'Vandè'}</p>
          {product && <p className="text-[11px] text-emerald-600 truncate">{product.name} · {product.price_on_request ? 'Pri sou Demand' : formatHTG(product.price)}</p>}
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-2 bg-slate-50">
        {messages.map((m) => {
          const mine = isMine(m, customerId);
          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] rounded-2xl px-3 py-2 ${mine ? 'bg-emerald-600 text-white rounded-br-md' : 'bg-white text-slate-800 border border-slate-100 rounded-bl-md'}`}>
                {m.image_url && <img src={m.image_url} alt="foto" className="rounded-lg max-h-48 w-full object-cover mb-1" />}
                {m.body && <p className="text-sm whitespace-pre-wrap break-words">{m.body}</p>}
                <p className={`text-[10px] mt-0.5 ${mine ? 'text-emerald-100' : 'text-slate-400'}`}>
                  {new Date(m.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-white border-t border-slate-100 px-3 py-2 flex items-center gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="Ekri yon mesaj..."
          className="flex-1 px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
        <button
          onClick={send}
          disabled={sending || !text.trim()}
          className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center disabled:opacity-50 active:scale-95 transition"
        >
          {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        </button>
      </div>
    </div>
  );
}
