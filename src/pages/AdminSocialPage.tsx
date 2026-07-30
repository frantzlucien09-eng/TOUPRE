import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/lib/toast';
import { useConfirm } from '@/lib/confirm';
import type { SocialPlatform } from '@/lib/types';
import {
  Loader2, Share2, Plus, Pencil, Trash2, ToggleLeft, ToggleRight, X, Save,
} from 'lucide-react';

const ICON_OPTIONS = ['instagram', 'tiktok', 'facebook', 'whatsapp', 'globe'];

const emptyForm = {
  name: '',
  label: '',
  url: '',
  icon_key: 'globe',
  active: true,
  sort_order: 0,
};

export function AdminSocialPage() {
  const { toast } = useToast();
  const { confirm } = useConfirm();
  const [items, setItems] = useState<SocialPlatform[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<SocialPlatform | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('social_platforms')
      .select('*')
      .order('sort_order', { ascending: true });
    if (error) toast('Erè lè w ap chaje rezo sosyal', 'error');
    setItems((data ?? []) as SocialPlatform[]);
    setLoading(false);
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const channel = supabase
      .channel('admin-social')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'social_platforms' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load]);

  const openCreate = () => {
    setCreating(true);
    setEditing(null);
    setForm({ ...emptyForm, sort_order: (items[items.length - 1]?.sort_order ?? 0) + 1 });
  };

  const openEdit = (p: SocialPlatform) => {
    setEditing(p);
    setCreating(false);
    setForm({
      name: p.name,
      label: p.label,
      url: p.url,
      icon_key: p.icon_key,
      active: p.active,
      sort_order: p.sort_order,
    });
  };

  const closeForm = () => {
    setCreating(false);
    setEditing(null);
    setForm(emptyForm);
  };

  const save = async () => {
    if (!form.name.trim() || !form.label.trim() || !form.url.trim()) {
      toast('Ranpli non, etikèt, ak URL', 'error');
      return;
    }
    setSaving(true);
    const payload = {
      name: form.name.trim().toLowerCase(),
      label: form.label.trim(),
      url: form.url.trim(),
      icon_key: form.icon_key,
      active: form.active,
      sort_order: Number(form.sort_order) || 0,
      updated_at: new Date().toISOString(),
    };

    const { error } = editing
      ? await supabase.from('social_platforms').update(payload).eq('id', editing.id)
      : await supabase.from('social_platforms').insert(payload);

    setSaving(false);
    if (error) {
      toast(error.message || 'Erè, eseye ankò', 'error');
      return;
    }
    toast(editing ? 'Lyen mete ajou' : 'Lyen ajoute');
    closeForm();
    load();
  };

  const toggleActive = async (p: SocialPlatform) => {
    const { error } = await supabase
      .from('social_platforms')
      .update({ active: !p.active, updated_at: new Date().toISOString() })
      .eq('id', p.id);
    if (error) toast(error.message || 'Erè, eseye ankò', 'error');
    else load();
  };

  const remove = async (p: SocialPlatform) => {
    const ok = await confirm({
      title: 'Efase Lyen',
      message: `Ou vle efase « ${p.label} »?`,
      confirmText: 'Efase',
      danger: true,
    });
    if (!ok) return;
    const { error } = await supabase.from('social_platforms').delete().eq('id', p.id);
    if (error) toast(error.message || 'Erè, eseye ankò', 'error');
    else { toast('Lyen efase'); load(); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">Jere lyen ofisyèl TOUPRE yo montre nan apps yo.</p>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold"
        >
          <Plus size={14} /> Ajoute
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-slate-400" /></div>
      ) : items.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
          <Share2 size={28} className="mx-auto text-slate-300 mb-2" />
          <p className="text-sm text-slate-400">Pa gen rezo sosyal anrejistre.</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {items.map((p) => (
            <div key={p.id} className="bg-white border border-slate-200 rounded-xl px-3 py-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-slate-900">{p.label}</p>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${p.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                    {p.active ? 'Aktif' : 'Inaktif'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 truncate mt-0.5">{p.url}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">{p.name} · ikòn {p.icon_key} · lòd {p.sort_order}</p>
              </div>
              <button onClick={() => toggleActive(p)} className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-600" title="Aktive/Dezaktive">
                {p.active ? <ToggleRight size={18} className="text-emerald-600" /> : <ToggleLeft size={18} />}
              </button>
              <button onClick={() => openEdit(p)} className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-600">
                <Pencil size={14} />
              </button>
              <button onClick={() => remove(p)} className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center text-rose-600">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {(creating || editing) && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40">
          <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl shadow-xl">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-sm">{editing ? 'Modifye Lyen' : 'Nouvo Lyen'}</h3>
              <button onClick={closeForm} className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center"><X size={16} /></button>
            </div>
            <div className="p-4 space-y-3">
              <Field label="Non teknik" value={form.name} onChange={(v) => setForm({ ...form, name: v })} placeholder="instagram" disabled={!!editing} />
              <Field label="Etikèt" value={form.label} onChange={(v) => setForm({ ...form, label: v })} placeholder="Instagram" />
              <Field label="URL" value={form.url} onChange={(v) => setForm({ ...form, url: v })} placeholder="https://..." />
              <div>
                <label className="text-xs font-semibold text-slate-600">Ikòn</label>
                <select
                  value={form.icon_key}
                  onChange={(e) => setForm({ ...form, icon_key: e.target.value })}
                  className="mt-1 w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm bg-white"
                >
                  {ICON_OPTIONS.map((k) => <option key={k} value={k}>{k}</option>)}
                </select>
              </div>
              <Field
                label="Lòd"
                value={String(form.sort_order)}
                onChange={(v) => setForm({ ...form, sort_order: Number(v) || 0 })}
                placeholder="0"
                type="number"
              />
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
                Aktif
              </label>
              <button
                disabled={saving}
                onClick={save}
                className="w-full py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                Anrejistre
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({
  label, value, onChange, placeholder, type = 'text', disabled,
}: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; disabled?: boolean;
}) {
  return (
    <div>
      <label className="text-xs font-semibold text-slate-600">{label}</label>
      <input
        type={type}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm disabled:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
      />
    </div>
  );
}
