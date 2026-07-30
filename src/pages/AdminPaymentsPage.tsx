import { useCallback, useEffect, useMemo, useState } from 'react';
import { useToast } from '@/lib/toast';
import { formatHTG, formatDateTime } from '@/lib/format';
import {
  listPayments,
  listProviderConfigs,
  listWebhookEvents,
  listLedgerForPayment,
  listPaymentAudit,
  runPaymentReconciliation,
  expireStalePayments,
  setProviderEnabled,
  markPaymentPaid,
  PAYMENT_STATUS_LABELS,
  PAYMENT_STATUS_STYLES,
  type Payment,
  type PaymentProviderConfig,
  type PaymentWebhookEvent,
  type LedgerTransaction,
} from '@/lib/payments';
import {
  Loader2, RefreshCw, ShieldAlert, Webhook, Scale, WalletCards, ToggleLeft, ToggleRight,
} from 'lucide-react';

type Tab = 'payments' | 'providers' | 'webhooks' | 'reconcile';

export function AdminPaymentsPage() {
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>('payments');
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [providers, setProviders] = useState<PaymentProviderConfig[]>([]);
  const [webhooks, setWebhooks] = useState<PaymentWebhookEvent[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [providerFilter, setProviderFilter] = useState('');
  const [selected, setSelected] = useState<Payment | null>(null);
  const [ledger, setLedger] = useState<LedgerTransaction[]>([]);
  const [audit, setAudit] = useState<Record<string, unknown>[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, cfg, wh] = await Promise.all([
        listPayments({
          status: statusFilter || undefined,
          provider: providerFilter || undefined,
          limit: 100,
        }),
        listProviderConfigs(),
        listWebhookEvents(40),
      ]);
      setPayments(p);
      setProviders(cfg);
      setWebhooks(wh);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Erè chaje peman', 'error');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, providerFilter, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const openPayment = async (payment: Payment) => {
    setSelected(payment);
    try {
      const [led, aud] = await Promise.all([
        listLedgerForPayment(payment.id),
        listPaymentAudit(payment.id),
      ]);
      setLedger(led);
      setAudit(aud as Record<string, unknown>[]);
    } catch {
      setLedger([]);
      setAudit([]);
    }
  };

  const stats = useMemo(() => {
    const paid = payments.filter((p) => p.status === 'paid' || p.status === 'captured');
    const failed = payments.filter((p) => p.status === 'failed' || p.status === 'blocked');
    const pending = payments.filter((p) =>
      ['created', 'pending', 'processing', 'requires_action'].includes(p.status)
    );
    return {
      total: payments.length,
      paidAmount: paid.reduce((s, p) => s + Number(p.amount), 0),
      failed: failed.length,
      pending: pending.length,
      highRisk: payments.filter((p) => p.risk_level === 'high' || p.risk_level === 'blocked').length,
    };
  }, [payments]);

  const handleReconcile = async () => {
    setBusy(true);
    const result = await runPaymentReconciliation(providerFilter || null);
    setBusy(false);
    if (!result.success) {
      toast(result.error || 'Rekonsilyasyon echwe', 'error');
      return;
    }
    toast(
      `Rekonsilyasyon OK — match ${result.matched_count ?? 0}, mismatch ${result.mismatch_count ?? 0}`,
      'success'
    );
    await load();
  };

  const handleExpire = async () => {
    setBusy(true);
    const result = await expireStalePayments(100);
    setBusy(false);
    if (!result.success) {
      toast(result.error || 'Timeout sweep echwe', 'error');
      return;
    }
    toast(`${result.expired_count ?? 0} peman ekspire`, 'success');
    await load();
  };

  const toggleProvider = async (provider: string, enabled: boolean) => {
    try {
      await setProviderEnabled(provider, enabled);
      toast(`${provider} ${enabled ? 'aktive' : 'dezaktive'}`);
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Erè', 'error');
    }
  };

  const markPaidManual = async (payment: Payment) => {
    if (!window.confirm('Make peman sa a kòm peye (manual)?')) return;
    setBusy(true);
    const result = await markPaymentPaid({
      paymentId: payment.id,
      amount: Number(payment.amount),
      metadata: { marked_by: 'admin_manual' },
    });
    setBusy(false);
    if (!result.success) {
      toast(result.error || 'Pa t kapab make peye', 'error');
      return;
    }
    toast('Peman make kòm peye');
    await load();
    if (selected?.id === payment.id) {
      const refreshed = (await listPayments({ limit: 100 })).find((p) => p.id === payment.id);
      if (refreshed) void openPayment(refreshed);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <WalletCards size={18} className="text-emerald-600" /> Siveyans Peman
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Achitekti provider-agnostic — MonCash / NatCash / Visa / Mastercard poko konekte.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600"
          aria-label="Refresh"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {[
          { label: 'Total', value: String(stats.total) },
          { label: 'Peye', value: formatHTG(stats.paidAmount) },
          { label: 'An Atant', value: String(stats.pending) },
          { label: 'Echwe', value: String(stats.failed) },
          { label: 'Risk Wo', value: String(stats.highRisk) },
        ].map((c) => (
          <div key={c.label} className="rounded-xl bg-white border border-slate-100 p-3">
            <p className="text-[11px] text-slate-400">{c.label}</p>
            <p className="text-sm font-bold text-slate-900 mt-0.5">{c.value}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2 flex-wrap">
        {([
          { key: 'payments' as const, label: 'Peman', icon: WalletCards },
          { key: 'providers' as const, label: 'Founisè', icon: ToggleRight },
          { key: 'webhooks' as const, label: 'Webhooks', icon: Webhook },
          { key: 'reconcile' as const, label: 'Rekonsilyasyon', icon: Scale },
        ]).map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border flex items-center gap-1 ${
              tab === t.key ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-600 border-slate-100'
            }`}
          >
            <t.icon size={12} /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'payments' && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white"
            >
              <option value="">Tout estati</option>
              {Object.keys(PAYMENT_STATUS_LABELS).map((s) => (
                <option key={s} value={s}>{PAYMENT_STATUS_LABELS[s]}</option>
              ))}
            </select>
            <select
              value={providerFilter}
              onChange={(e) => setProviderFilter(e.target.value)}
              className="px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white"
            >
              <option value="">Tout founisè</option>
              {providers.map((p) => (
                <option key={p.provider} value={p.provider}>{p.display_name}</option>
              ))}
            </select>
          </div>

          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="animate-spin text-emerald-500" /></div>
          ) : payments.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-10">Pa gen peman ankò.</p>
          ) : (
            <div className="space-y-2">
              {payments.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => void openPayment(p)}
                  className="w-full text-left rounded-xl bg-white border border-slate-100 p-3 hover:border-emerald-200 transition"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">
                        {formatHTG(p.amount)} · {p.provider}
                      </p>
                      <p className="text-[11px] text-slate-400 truncate">
                        {p.purpose} · {p.id.slice(0, 8)} · {formatDateTime(p.created_at)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {(p.risk_level === 'high' || p.risk_level === 'blocked') && (
                        <ShieldAlert size={14} className="text-rose-500" />
                      )}
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${PAYMENT_STATUS_STYLES[p.status] ?? 'bg-slate-100 text-slate-600'}`}>
                        {PAYMENT_STATUS_LABELS[p.status] ?? p.status}
                      </span>
                    </div>
                  </div>
                  {p.error_message && (
                    <p className="text-[11px] text-rose-600 mt-1 truncate">{p.error_code}: {p.error_message}</p>
                  )}
                </button>
              ))}
            </div>
          )}

          {selected && (
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-bold text-slate-900 text-sm">Detay peman</p>
                  <p className="text-[11px] text-slate-500 font-mono">{selected.id}</p>
                </div>
                <button type="button" onClick={() => setSelected(null)} className="text-xs text-slate-500">Fèmen</button>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><span className="text-slate-400">Montan</span><p className="font-semibold">{formatHTG(selected.amount)}</p></div>
                <div><span className="text-slate-400">Risk</span><p className="font-semibold">{selected.risk_level} ({selected.fraud_score})</p></div>
                <div><span className="text-slate-400">Idempotency</span><p className="font-mono truncate">{selected.idempotency_key ?? '—'}</p></div>
                <div><span className="text-slate-400">Retries</span><p className="font-semibold">{selected.attempt_count}/{selected.max_attempts}</p></div>
              </div>
              {selected.status !== 'paid' && selected.status !== 'refunded' && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void markPaidManual(selected)}
                  className="w-full py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold disabled:opacity-50"
                >
                  Make peye (manual)
                </button>
              )}
              <div>
                <p className="text-xs font-semibold text-slate-500 mb-1">Ledger</p>
                {ledger.length === 0 ? (
                  <p className="text-[11px] text-slate-400">Pa gen antre ledger.</p>
                ) : (
                  <div className="space-y-1">
                    {ledger.map((t) => (
                      <div key={t.id} className="text-[11px] flex justify-between bg-white rounded-lg px-2 py-1.5 border border-slate-100">
                        <span>{t.entry_type} · {t.account} · {t.description}</span>
                        <span className="font-semibold">{formatHTG(t.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 mb-1">Audit</p>
                {audit.length === 0 ? (
                  <p className="text-[11px] text-slate-400">Pa gen audit.</p>
                ) : (
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {audit.map((a) => (
                      <div key={String(a.id)} className="text-[11px] bg-white rounded-lg px-2 py-1.5 border border-slate-100">
                        <p className="font-semibold text-slate-800">{String(a.action)}</p>
                        {a.message ? <p className="text-slate-500">{String(a.message)}</p> : null}
                        {a.error_message ? <p className="text-rose-600">{String(a.error_code)}: {String(a.error_message)}</p> : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'providers' && (
        <div className="space-y-2">
          {providers.map((p) => (
            <div key={p.id} className="rounded-xl bg-white border border-slate-100 p-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-slate-900 text-sm">{p.display_name}</p>
                <p className="text-[11px] text-slate-400">
                  {p.provider} · timeout {p.timeout_seconds}s · retries {p.max_retries}
                  {p.sandbox ? ' · sandbox' : ''}
                </p>
                {p.webhook_path && <p className="text-[10px] text-slate-400 font-mono truncate mt-0.5">{p.webhook_path}</p>}
              </div>
              <button
                type="button"
                onClick={() => void toggleProvider(p.provider, !p.enabled)}
                className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg border ${
                  p.enabled ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-slate-50 border-slate-200 text-slate-500'
                }`}
              >
                {p.enabled ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                {p.enabled ? 'Aktif' : 'Off'}
              </button>
            </div>
          ))}
          <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-xl p-3">
            Aktive yon founisè isit la pa konekte API live. Kreye / sekrè yo ap vini nan etap MonCash.
          </p>
        </div>
      )}

      {tab === 'webhooks' && (
        <div className="space-y-2">
          {webhooks.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-10">Pa gen webhook event.</p>
          ) : (
            webhooks.map((w) => (
              <div key={w.id} className="rounded-xl bg-white border border-slate-100 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900">{w.provider} · {w.event_type ?? 'event'}</p>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${w.verified ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                    {w.verified ? 'Verifye' : 'Pa verifye'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {w.event_id ?? w.id.slice(0, 8)} · {formatDateTime(w.received_at)}
                  {w.processed ? ' · trete' : ' · an atant'}
                </p>
                {w.processing_error && <p className="text-[11px] text-rose-600 mt-1">{w.processing_error}</p>}
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'reconcile' && (
        <div className="space-y-3">
          <div className="rounded-xl bg-white border border-slate-100 p-4 space-y-3">
            <p className="text-sm text-slate-600">
              Rekonsilyasyon konpare ledger / estati peman ak `orders.payment_status`, epi ekspire peman ki depase timeout.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleReconcile()}
                className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold disabled:opacity-50"
              >
                {busy ? <Loader2 size={14} className="animate-spin inline" /> : null} Lance rekonsilyasyon
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleExpire()}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 text-sm font-semibold disabled:opacity-50"
              >
                Ekspire peman timeout
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
