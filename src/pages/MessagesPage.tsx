import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/lib/toast';
import type { Message, Product, Customer } from '@/lib/types';
import { uploadProductPhoto } from '@/lib/media';
import { formatHTG } from '@/lib/format';
import { isVendorParticipant, vendorMessageOrFilter, vendorMessageRealtimeFilters } from '@/lib/vendorIds';
import {
  ArrowLeft, Send, Camera, Loader2, Image as ImageIcon, MessageCircle, RefreshCw, Phone,
} from 'lucide-react';

type Conversation = {
  customer_id: string;
  customer: Customer | null;
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
  if (diff < 604800) return `${Math.floor(diff / 86400)} jou`;
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

function avatarColor(name: string): string {
  const colors = ['bg-rose-500', 'bg-emerald-500', 'bg-blue-500', 'bg-amber-500', 'bg-purple-500', 'bg-teal-500', 'bg-indigo-500', 'bg-pink-500'];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return colors[Math.abs(h) % colors.length];
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] ?? '?') + (parts[1]?.[0] ?? '');
}

export function MessagesPage({ initialCustomerId, onClearInitial }: { initialCustomerId?: string | null; onClearInitial?: () => void }) {
  const { vendor } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [openCustomerId, setOpenCustomerId] = useState<string | null>(initialCustomerId ?? null);
  const [openProductId, setOpenProductId] = useState<string | null>(null);

  useEffect(() => {
    if (initialCustomerId) {
      setOpenCustomerId(initialCustomerId);
      onClearInitial?.();
    }
  }, [initialCustomerId, onClearInitial]);

  const loadConversations = async () => {
    if (!vendor) return;
    setLoading(true);

    const { data: msgs, error: msgsError } = await supabase
      .from('messages')
      .select('id, sender_id, recipient_id, receiver_id, body, image_url, product_id, order_id, read, created_at')
      .or(vendorMessageOrFilter(vendor))
      .order('created_at', { ascending: false })
      .limit(300);

    if (msgsError && import.meta.env.DEV) {
      console.error('[vendor inbox]', msgsError.message);
    }

    if (!msgs || msgs.length === 0) {
      setConversations([]);
      setLoading(false);
      return;
    }

    const byKey = new Map<string, Message[]>();
    for (const m of msgs as Message[]) {
      const otherId = isVendorParticipant(vendor, m.sender_id)
        ? (m.recipient_id ?? m.receiver_id)
        : m.sender_id;
      const key = `${otherId}::${m.product_id ?? 'null'}`;
      if (!byKey.has(key)) byKey.set(key, []);
      byKey.get(key)!.push(m);
    }

    const customerIds = new Set<string>();
    const productIds = new Set<string>();
    byKey.forEach((list) => {
      const otherId = isVendorParticipant(vendor, list[0].sender_id)
        ? (list[0].recipient_id ?? list[0].receiver_id)
        : list[0].sender_id;
      customerIds.add(otherId);
      if (list[0].product_id) productIds.add(list[0].product_id);
    });

    const { data: customers } = await supabase
      .from('customers')
      .select('*')
      .in('id', Array.from(customerIds));
    const customerMap = new Map<string, Customer>();
    (customers ?? []).forEach((c: Customer) => customerMap.set(c.id, c));

    const { data: products } = await supabase
      .from('products')
      .select('*')
      .in('id', Array.from(productIds));
    const productMap = new Map<string, Product>();
    (products ?? []).forEach((p: Product) => productMap.set(p.id, p));

    const convos: Conversation[] = [];
    byKey.forEach((list, key) => {
      const [cid, pid] = key.split('::');
      const last = list[0];
      const unread = list.filter((m) =>
        (isVendorParticipant(vendor, m.recipient_id) || isVendorParticipant(vendor, m.receiver_id)) && !m.read
      ).length;
      convos.push({
        customer_id: cid,
        customer: customerMap.get(cid) ?? null,
        product_id: pid === 'null' ? null : pid,
        product: (pid !== 'null' ? productMap.get(pid) : null) ?? null,
        last_message: last,
        unread_count: unread,
      });
    });

    convos.sort((a, b) => {
      const at = a.last_message?.created_at ?? '';
      const bt = b.last_message?.created_at ?? '';
      return bt.localeCompare(at);
    });

    setConversations(convos);
    setLoading(false);
  };

  useEffect(() => {
    loadConversations();
    if (!vendor) return;
    let channel = supabase.channel('messages-list');
    for (const filter of vendorMessageRealtimeFilters(vendor)) {
      channel = channel.on('postgres_changes', filter, () => { loadConversations(); });
    }
    channel.subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [vendor]);

  if (loading) {
    return (
      <div className="flex justify-center py-20"><Loader2 className="animate-spin text-slate-400" /></div>
    );
  }

  if (openCustomerId) {
    const convo = conversations.find((c) => c.customer_id === openCustomerId && (c.product_id ?? 'null') === (openProductId ?? 'null'));
    return (
      <ChatView
        customerId={openCustomerId}
        customer={convo?.customer ?? null}
        product={convo?.product ?? null}
        onBack={() => { setOpenCustomerId(null); setOpenProductId(null); loadConversations(); }}
      />
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="px-4 pt-20 flex flex-col items-center text-center">
        <MessageCircle size={40} className="text-slate-300 mb-3" />
        <p className="font-semibold text-slate-700">Pa gen mesaj toujou</p>
        <p className="text-sm text-slate-400 mt-1">Lè kliyan voye w mesaj, yo ap parèt isit.</p>
      </div>
    );
  }

  return (
    <div className="px-4 pt-4 pb-24">
      <div className="flex items-center justify-between mb-3">
        <h1 className="font-bold text-slate-900 text-lg">Mesaj</h1>
        <button
          onClick={() => loadConversations()}
          className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 active:scale-90 transition"
          aria-label="Rafrechi"
        >
          <RefreshCw size={15} />
        </button>
      </div>
      <div className="space-y-1">
        {conversations.map((c, i) => {
          const name = c.customer?.full_name ?? 'Kliyan';
          const last = c.last_message!;
          const preview = last.image_url ? '📷 Foto' : last.body;
          return (
            <button
              key={`${c.customer_id}-${c.product_id ?? 'null'}-${i}`}
              onClick={() => { setOpenCustomerId(c.customer_id); setOpenProductId(c.product_id); }}
              className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 active:scale-95 transition text-left"
            >
              <Avatar name={name} url={c.customer ? null : null} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className={`text-sm truncate ${c.unread_count > 0 ? 'font-bold text-slate-900' : 'font-medium text-slate-700'}`}>{name}</p>
                  <span className="text-[11px] text-slate-400 shrink-0">{timeAgo(last.created_at)}</span>
                </div>
                <div className="flex items-center justify-between gap-2 mt-0.5">
                  <p className={`text-xs truncate ${c.unread_count > 0 ? 'text-slate-700' : 'text-slate-400'}`}>{preview}</p>
                  {c.unread_count > 0 && (
                    <span className="bg-emerald-500 text-white rounded-full min-w-[18px] h-[18px] px-1 text-[10px] font-bold flex items-center justify-center shrink-0">
                      {c.unread_count}
                    </span>
                  )}
                </div>
                {c.product && (
                  <p className="text-[10px] text-emerald-600 truncate mt-0.5">📦 {c.product.name}</p>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Avatar({ name, url }: { name: string; url: string | null }) {
  if (url) {
    return <img src={url} alt={name} className="w-11 h-11 rounded-full object-cover shrink-0" />;
  }
  return (
    <div className={`w-11 h-11 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0 ${avatarColor(name)}`}>
      {initials(name)}
    </div>
  );
}

function ChatView({
  customerId, customer, product, onBack,
}: {
  customerId: string;
  customer: Customer | null;
  product: Product | null;
  onBack: () => void;
}) {
  const { vendor } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const customerName = customer?.full_name ?? 'Kliyan';

  const load = async () => {
    if (!vendor) return;
    const ids = Array.from(new Set([vendor.id, vendor.user_id].filter(Boolean)));
    const parts = ids.flatMap((vid) => [
      `and(sender_id.eq.${vid},recipient_id.eq.${customerId})`,
      `and(sender_id.eq.${customerId},recipient_id.eq.${vid})`,
      `and(sender_id.eq.${vid},receiver_id.eq.${customerId})`,
      `and(sender_id.eq.${customerId},receiver_id.eq.${vid})`,
    ]);
    const { data } = await supabase
      .from('messages')
      .select('*')
      .or(parts.join(','))
      .order('created_at', { ascending: true });
    setMessages((data ?? []) as Message[]);
  };

  useEffect(() => {
    load();
    if (!vendor) return;
    let channel = supabase.channel(`chat-${customerId}`);
    for (const filter of vendorMessageRealtimeFilters(vendor)) {
      channel = channel.on('postgres_changes', filter, () => { load(); });
    }
    channel.subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [vendor, customerId]);

  useEffect(() => {
    if (!vendor) return;
    const ids = Array.from(new Set([vendor.id, vendor.user_id].filter(Boolean)));
    const recipientOr = ids.flatMap((id) => [`recipient_id.eq.${id}`, `receiver_id.eq.${id}`]).join(',');
    supabase.from('messages')
      .update({ read: true })
      .or(recipientOr)
      .eq('sender_id', customerId)
      .eq('read', false)
      .then(() => { load(); });
  }, [vendor, customerId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const send = async () => {
    if (!text.trim() || !vendor) return;
    setSending(true);
    const body = text.trim();
    setText('');
    const { data: rpcResult, error: rpcError } = await supabase.rpc('send_message', {
      p_sender_id: vendor.id,
      p_recipient_id: customerId,
      p_body: body,
      p_product_id: product?.id ?? null,
    });
    if (rpcError || (rpcResult && !rpcResult.success)) {
      toast(rpcResult?.error || rpcError?.message || 'Erè, eseye ankò', 'error');
      setText(body);
    }
    setSending(false);
  };

  const sendPhoto = async (file: File) => {
    if (!vendor) return;
    setUploading(true);
    try {
      const url = await uploadProductPhoto(file, vendor.id, 'chat');
      const { data: rpcResult, error: rpcError } = await supabase.rpc('send_message', {
        p_sender_id: vendor.id,
        p_recipient_id: customerId,
        p_body: '',
        p_image_url: url,
        p_product_id: product?.id ?? null,
      });
      if (rpcError || (rpcResult && !rpcResult.success)) throw new Error(rpcResult?.error || 'Erè voye foto');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Erè telechaje', 'error');
    } finally {
      setUploading(false);
      if (photoInputRef.current) photoInputRef.current.value = '';
    }
  };

  return (
    <div className="flex flex-col h-screen max-h-screen">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 bg-white">
        <button onClick={onBack} className="p-1 -ml-1 active:scale-90 transition">
          <ArrowLeft size={22} className="text-slate-700" />
        </button>
        <Avatar name={customerName} url={null} />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-900 text-sm truncate">{customerName}</p>
          {customer?.phone && (
            <a href={`tel:${customer.phone}`} className="text-[11px] text-emerald-600 hover:underline">{customer.phone}</a>
          )}
        </div>
        {customer?.phone && (
          <a href={`tel:${customer.phone}`} className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 active:scale-90 transition shrink-0" aria-label="Rele kliyan">
            <Phone size={15} />
          </a>
        )}
        <button onClick={() => load()} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 active:scale-90 transition shrink-0" aria-label="Rafrechi">
          <RefreshCw size={15} />
        </button>
      </div>

      {/* Product reminder card */}
      {product && (
        <div className="flex items-center gap-2.5 px-4 py-2 bg-emerald-50/70 border-b border-emerald-100">
          <div className="w-10 h-10 rounded-lg overflow-hidden bg-slate-100 shrink-0">
            {(product.photos?.[product.cover_index] ?? product.photos?.[0] ?? product.image_url) ? (
              <img src={product.photos?.[product.cover_index] ?? product.photos?.[0] ?? product.image_url!} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-300"><ImageIcon size={16} /></div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-slate-800 truncate">{product.name}</p>
            <p className="text-[11px] text-emerald-600">{product.price_on_request ? 'Pri sou Demand' : formatHTG(product.price)}</p>
          </div>
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-2 bg-slate-50">
        {messages.map((m) => {
                const mine = vendor ? isVendorParticipant(vendor, m.sender_id) : false;
          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] rounded-2xl px-3 py-2 ${mine ? 'bg-emerald-600 text-white rounded-br-md' : 'bg-white text-slate-800 border border-slate-100 rounded-bl-md'}`}>
                {m.image_url && (
                  <img src={m.image_url} alt="foto" className="rounded-lg max-h-48 w-full object-cover mb-1" />
                )}
                {m.body && <p className="text-sm whitespace-pre-wrap break-words">{m.body}</p>}
                <p className={`text-[10px] mt-0.5 ${mine ? 'text-emerald-100' : 'text-slate-400'}`}>
                  {new Date(m.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          );
        })}
        {messages.length === 0 && (
          <p className="text-center text-sm text-slate-400 mt-8">Pa gen mesaj toujou. Voye premye mesaj la!</p>
        )}
      </div>

      {/* Input */}
      <div className="px-3 py-3 border-t border-slate-100 bg-white flex items-center gap-2 pb-[env(safe-area-inset-bottom)]">
        <input ref={photoInputRef} type="file" accept="image/*" className="absolute" style={{ position: 'absolute', width: '1px', height: '1px', opacity: 0, overflow: 'hidden' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) sendPhoto(f); }} />
        <button
          onClick={() => photoInputRef.current?.click()}
          disabled={uploading}
          className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 active:scale-90 transition shrink-0"
        >
          {uploading ? <Loader2 size={18} className="animate-spin" /> : <Camera size={20} />}
        </button>
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
          placeholder="Ekri yon mesaj..."
          className="flex-1 px-4 py-2.5 rounded-full bg-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
        <button
          onClick={send}
          disabled={sending || !text.trim()}
          className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center active:scale-90 transition disabled:opacity-50 shrink-0"
        >
          {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
        </button>
      </div>
    </div>
  );
}
