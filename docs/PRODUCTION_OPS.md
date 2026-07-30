# Production operations

## Error monitoring

- Client: `src/lib/monitoring.ts` — `window.error` / `unhandledrejection` → structured `console` logs.
- Optional: set `VITE_SENTRY_DSN` and attach `@sentry/browser` in the production build pipeline.
- Edge: functions log to Supabase Edge logs (`[moncash-*]`, `[payment-webhook]`, OTP). Never log OTP codes or MonCash secrets.

## Production logging

| Source | Where |
|--------|-------|
| Vite app | Browser console + optional Sentry |
| Edge Functions | Supabase → Edge Functions → Logs |
| Payment audit | `payment_audit_log` via `log_payment_audit` |
| Webhooks | `payment_webhooks` via `record_payment_webhook` |

Log levels: prefer `error` for settle failures; avoid PII (full MonCash phone in free-text logs).

## Health checks

| Probe | Expect |
|-------|--------|
| `GET /functions/v1/health` | HTTP 200, `ok: true`, `database: ok` |
| Client `runClientHealthCheck()` | `supabaseReachable: true` |
| Uptime monitor | Hit `/functions/v1/health` every 1–5 min |

MonCash credentials missing → health still 200 if DB ok, but `checks.moncash.credentials=missing` (alert on that in production).

## Production alerts

Configure (UptimeRobot / Better Stack / Supabase webhooks → email/SMS):

1. **Health down** — `/functions/v1/health` ≠ 200 for 2 consecutive checks.
2. **MonCash secrets missing** — health JSON `moncash.credentials=missing` while `VITE_MONCASH_ENABLED=true`.
3. **Payment failure spike** — admin review of `payments` with `status=failed` in last hour.
4. **Edge error rate** — spike in `moncash-create-payment` / `payment-webhook` 5xx.
5. **Auth / OTP** — Resend delivery failures (`resend=missing` on health).

On-call: check Edge logs → `payment_audit_log` → Digicel sandbox/live status page.

## Deploy checklist

1. Migrations applied (`20260730210000_*` and prior).
2. Edge secrets set; `ALLOW_DEV_OTP=false`.
3. Functions deployed: `health`, `moncash-create-payment`, `moncash-verify-payment`, `payment-webhook`, OTP pair.
4. Frontend build with correct `VITE_*`.
5. `npm run typecheck && npm run lint && npm run build && npm run smoke`.
6. Sandbox payment once on staging; then flip `MONCASH_MODE=live`.

## Related docs

- `docs/MONCASH_INTEGRATION.md`
- `docs/BACKUP_AND_RESTORE.md`
- `docs/FINAL_PRODUCTION_READINESS_REPORT.md`
