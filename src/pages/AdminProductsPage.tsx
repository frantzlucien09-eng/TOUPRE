import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/lib/toast';
import { formatHTG, formatDateTime, relativeTime } from '@/lib/format';
import { CATEGORY_LABEL } from '@/lib/categories';
import type { Product, Vendor } from '@/lib/types';
import {
  Search, Loader2, Package, ChevronRight, X, Store, CheckCircle2,
  XCircle, Clock, Eye, EyeOff, Ban, FileSpreadsheet, FileText, Tag, ShoppingBag,
} from 'lucide-react';

type ProductWithVendor = Product & {
  vendor?: Pick<Vendor, 'id' | 'business_name' | 'department' | 'city' | 'phone'> | null;
};

type StatusFilter = 'all' | 'pending' | 'active' | 'rejected' | 'draft';

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'Tout' },
  { key: 'pending', label: 'An Atant' },
  { key: 'active', label: 'Aktif' },
  { key: 'rejected', label: 'Rejte' },
  { key: 'draft', label: 'Brouyon' },
];

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  active: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-rose-100 text-rose-700',
  draft: 'bg-slate-100 text-slate-600',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'An Atant',
  active: 'Aktif',
  rejected: 'Rejte',
  draft: 'Brouyon',
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  pending: <Clock size={12} />,
  active: <CheckCircle2 size={12} />,
  rejected: <XCircle size={12} />,
  draft: <Package size={12} />,
};

export function AdminProductsPage() {
  const { toast } = useToast();
  const [products, setProducts] = useState<ProductWithVendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<ProductWithVendor | null>(null);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('products')
      .select(`
        id, vendor_id, name, description, price, image_url, stock, active,
        category, details, photos, cover_index, video_url, price_on_request,
        ad_status, ad_paid_at, ad_expires_at, status,
        search_count, sold_count, view_count, first_sold_at, last_sold_at,
        created_at, updated_at, deleted_at,
        vendor:vendors!inner(id, business_name, department, city, phone)
      `)
      .order('created_at', { ascending: false });

    if (filter === 'draft') {
      query = query.eq('active', false).neq('status', 'rejected');
    } else if (filter !== 'all') {
      query = query.eq('status', filter);
    }

    const { data, error } = await query.limit(200);
    if (error) {
      toast('Erè lè w ap chaje pwodwi yo', 'error');
      setLoading(false);
      return;
    }

    let list = (data ?? []) as unknown as ProductWithVendor[];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((p) =>
        p.name.toLowerCase().includes(q) ||
        (p.vendor?.business_name ?? '').toLowerCase().includes(q) ||
        (p.category ?? '').toLowerCase().includes(q)
      );
    }
    setProducts(list);
    setLoading(false);
  }, [filter, search, toast]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  useEffect(() => {
    const channel = supabase
      .channel('admin-products')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => loadProducts())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadProducts]);

  const summary = useMemo(() => {
    const counts = { pending: 0, active: 0, rejected: 0, draft: 0 };
    for (const p of products) {
      if (p.status in counts) counts[p.status as keyof typeof counts]++;
      else if (!p.active) counts.draft++;
    }
    return counts;
  }, [products]);

  const handleApprove = async (id: string) => {
    const { error } = await supabase
      .from('products')
      .update({ status: 'active', updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) { toast('Erè, eseye ankò', 'error'); return; }
    toast('Pwodwi apwouve e li parèt pou kliyan yo');
    loadProducts();
  };

  const handleReject = async (id: string) => {
    const { error } = await supabase
      .from('products')
      .update({ status: 'rejected', updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) { toast('Erè, eseye ankò', 'error'); return; }
    toast('Pwodwi rejte');
    loadProducts();
  };

  const handleToggleActive = async (p: ProductWithVendor) => {
    const { error } = await supabase
      .from('products')
      .update({ active: !p.active, updated_at: new Date().toISOString() })
      .eq('id', p.id);
    if (error) { toast('Erè, eseye ankò', 'error'); return; }
    toast(!p.active ? 'Pwodwi aktive' : 'Pwodwi dezaktive');
    loadProducts();
  };

  const handleExportExcel = () => {
    const rows = products.map((p) => ({
      ID: p.id.slice(0, 8),
      Non: p.name,
      Vandè: p.vendor?.business_name ?? '—',
      Kategori: p.category ? CATEGORY_LABEL[p.category] ?? p.category : '—',
      Pri: Number(p.price),
      Estati: STATUS_LABELS[p.status] ?? p.status,
      Aktif: p.active ? 'Wi' : 'Non',
      Dat: formatDateTime(p.created_at),
    }));
    const headers = Object.keys(rows[0] ?? { ID: '' });
    const csv = [
      headers.join(','),
      ...rows.map((r) => headers.map((h) => `"${String((r as any)[h] ?? '').replace(/"/g, '""')}"`).join(',')),
    ].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pwodwi_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast('Ekspòtasyon CSV telechaje');
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-2.5">
        {(['pending', 'active', 'rejected', 'draft'] as const).map((k) => (
          <div key={k} className="bg-white border border-slate-200 rounded-xl p-3">
            <p className="text-[11px] text-slate-500 mb-1">{STATUS_LABELS[k]}</p>
            <p className="text-lg font-bold text-slate-900">{summary[k]}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex gap-1 p-1 bg-white rounded-xl border border-slate-200 overflow-x-auto no-scrollbar">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                filter === f.key ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Chache pa non pwodwi, vandè, oswa kategori..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 bg-white text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
      </div>

      <button
        onClick={handleExportExcel}
        className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition active:scale-95"
      >
        <FileSpreadsheet size={16} />
        Ekspòte CSV
      </button>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="animate-spin text-slate-400" size={24} />
        </div>
      ) : products.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center">
          <Package size={28} className="mx-auto text-slate-300 mb-3" />
          <p className="text-sm text-slate-400">Pa gen pwodwi nan filt sa a.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {products.map((p) => {
            const cover = p.photos?.[p.cover_index] ?? p.photos?.[0] ?? p.image_url;
            return (
              <button
                key={p.id}
                onClick={() => setSelected(p)}
                className="w-full bg-white rounded-2xl border border-slate-200 p-4 shadow-sm hover:shadow-md hover:border-slate-300 transition text-left active:scale-[0.99]"
              >
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-xl bg-slate-100 overflow-hidden flex items-center justify-center text-slate-400 shrink-0">
                    {cover ? (
                      <img src={cover} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Package size={20} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-slate-900 text-sm truncate">{p.name}</p>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold flex items-center gap-1 ${STATUS_STYLES[p.status]}`}>
                        {STATUS_ICONS[p.status]}
                        {STATUS_LABELS[p.status] ?? p.status}
                      </span>
                      {!p.active && p.status !== 'rejected' && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-500">Pa vizib</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 truncate mt-0.5">
                      {p.vendor?.business_name ?? 'Vandè'} · {p.category ? CATEGORY_LABEL[p.category] ?? p.category : '—'}
                    </p>
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-xs text-slate-400">{relativeTime(p.created_at)}</p>
                      <p className="text-sm font-bold text-slate-900">
                        {p.price_on_request ? 'Sou demann' : formatHTG(p.price)}
                      </p>
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-slate-300 shrink-0 mt-1" />
                </div>
              </button>
            );
          })}
        </div>
      )}

      {selected && (
        <ProductDetailModal
          product={selected}
          onClose={() => setSelected(null)}
          onApprove={() => handleApprove(selected.id)}
          onReject={() => handleReject(selected.id)}
          onToggleActive={() => handleToggleActive(selected)}
        />
      )}
    </div>
  );
}

function ProductDetailModal({
  product, onClose, onApprove, onReject, onToggleActive,
}: {
  product: ProductWithVendor;
  onClose: () => void;
  onApprove: () => void;
  onReject: () => void;
  onToggleActive: () => void;
}) {
  const photos = product.photos ?? [];
  const cover = photos[product.cover_index] ?? photos[0] ?? product.image_url;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4" onClick={onClose}>
      <div
        className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-slate-100 px-5 py-4 flex items-center justify-between z-10">
          <h2 className="font-bold text-slate-900 text-base">Detay Pwodwi</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {cover && (
            <div className="w-full h-48 rounded-2xl overflow-hidden bg-slate-100">
              <img src={cover} alt={product.name} className="w-full h-full object-cover" />
            </div>
          )}

          {photos.length > 1 && (
            <div className="flex gap-2 overflow-x-auto no-scrollbar">
              {photos.map((url, i) => (
                <img key={i} src={url} alt="" className="w-16 h-16 rounded-lg object-cover border border-slate-200 shrink-0" />
              ))}
            </div>
          )}

          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h3 className="font-bold text-slate-900 text-lg">{product.name}</h3>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold flex items-center gap-1 ${STATUS_STYLES[product.status]}`}>
                {STATUS_ICONS[product.status]}
                {STATUS_LABELS[product.status] ?? product.status}
              </span>
            </div>
            <p className="text-xl font-bold text-emerald-600">
              {product.price_on_request ? 'Pri sou demann' : formatHTG(product.price)}
            </p>
          </div>

          {product.description && (
            <p className="text-sm text-slate-600 leading-relaxed">{product.description}</p>
          )}

          <div className="grid grid-cols-2 gap-3 text-sm">
            <DetailRow label="Kategori" value={product.category ? CATEGORY_LABEL[product.category] ?? product.category : '—'} />
            <DetailRow label="Stok" value={String(product.stock)} />
            <DetailRow label="Vizib" value={product.active ? 'Wi' : 'Non'} />
            <DetailRow label="Pri sou demann" value={product.price_on_request ? 'Wi' : 'Non'} />
            {product.ad_status && <DetailRow label="Estati Anons" value={product.ad_status} />}
            {product.ad_expires_at && <DetailRow label="Anons Ekspire" value={formatDateTime(product.ad_expires_at)} />}
          </div>

          {/* Product stats */}
          <div className="grid grid-cols-3 gap-2">
            <StatCard icon={<Search size={14} />} label="Chache" value={product.search_count ?? 0} />
            <StatCard icon={<ShoppingBag size={14} />} label="Vann" value={product.sold_count ?? 0} />
            <StatCard icon={<Eye size={14} />} label="Gade" value={product.view_count ?? 0} />
          </div>

          {(product.sold_count ?? 0) > 0 && product.first_sold_at && product.last_sold_at && (
            <div className="bg-slate-50 rounded-xl p-3 text-xs text-slate-600 space-y-1">
              <p>Premye vant: {formatDateTime(product.first_sold_at)}</p>
              <p>Dènye vant: {formatDateTime(product.last_sold_at)}</p>
              <p>Vitès vant: {product.sold_count} vant</p>
            </div>
          )}

          <div className="bg-slate-50 rounded-2xl p-4 space-y-2">
            <div className="flex items-center gap-2 mb-1">
              <Store size={16} className="text-slate-500" />
              <p className="font-semibold text-slate-900 text-sm">Enfòmasyon Vandè</p>
            </div>
            <DetailRow label="Biznis" value={product.vendor?.business_name ?? '—'} />
            <DetailRow label="Depatman" value={product.vendor?.department ?? '—'} />
            <DetailRow label="Vil" value={product.vendor?.city ?? '—'} />
            <DetailRow label="Telefòn" value={product.vendor?.phone ?? '—'} />
          </div>

          <div className="text-xs text-slate-400 space-y-1">
            <p>Kreye: {formatDateTime(product.created_at)}</p>
            <p>Modife: {formatDateTime(product.updated_at)}</p>
          </div>

          {product.details && Object.keys(product.details).length > 0 && (
            <div className="bg-slate-50 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Tag size={16} className="text-slate-500" />
                <p className="font-semibold text-slate-900 text-sm">Detay</p>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {Object.entries(product.details).map(([k, v]) => (
                  <DetailRow key={k} label={k} value={String(v ?? '—')} />
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            {product.status !== 'active' && (
              <button
                onClick={onApprove}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition active:scale-95"
              >
                <CheckCircle2 size={16} />
                Apwouve
              </button>
            )}
            {product.status !== 'rejected' && (
              <button
                onClick={onReject}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold transition active:scale-95"
              >
                <XCircle size={16} />
                Rejte
              </button>
            )}
            <button
              onClick={onToggleActive}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold transition active:scale-95"
            >
              {product.active ? <EyeOff size={16} /> : <Eye size={16} />}
              {product.active ? 'Kache' : 'Montre'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-slate-500">{label}</span>
      <span className="font-semibold text-slate-900 text-right truncate ml-2 max-w-[60%]">{value}</span>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="bg-slate-50 rounded-xl p-3 text-center">
      <div className="flex items-center justify-center text-slate-400 mb-1">{icon}</div>
      <p className="text-lg font-bold text-slate-900">{value}</p>
      <p className="text-[10px] text-slate-500">{label}</p>
    </div>
  );
}
