# TOUPRE Go-Live Audit Report

**Date:** 2026-07-30  
**Branch / commit:** `cursor/production-release-0b16` @ `69a8017`  
**Scope:** Read-only verification of repo + automated gates. No feature changes.  
**Live project state:** Deployed migrations / Edge functions / Digicel credentials **cannot be confirmed from the repository alone**.

---

## Verdict

# GO WITH MINOR RISKS

**Meaning:** Production V1 / private-beta go-live is acceptable **only as a controlled launch** after the Critical checklist below is executed in the live project.  
**Not** a blank check for unrestricted public open until Critical items are cleared.

Automated gates on this commit: **typecheck PASS · lint 0 errors · smoke PASS**.

---

## Audit matrix

| Area | Code / docs status | Live status | Rating |
|------|--------------------|-------------|--------|
| Production env vars | Documented in `.env.example` + MonCash/ops docs | **UNVERIFIED** | Pass with risk |
| Database migrations (64) | Complete chain through `20260730210000_*` | **UNVERIFIED applied** | Pass with risk |
| Edge Functions (7) | Present in repo | **UNVERIFIED deployed** | Pass with risk |
| MonCash endpoints | OAuth, CreatePayment, RetrieveOrder/Transaction, Redirect | **UNVERIFIED sandbox E2E** | Pass with risk |
| Webhooks | POST signature + timing-safe; GET return re-captures via API | **UNVERIFIED** | Pass with risk |
| RLS | Core tables ENABLE RLS; payment settle hardened | Residual **anon** policies in history | **Risk** |
| Legal pages (6) | Routes + signup acceptance | Ready in code | Pass |
| Monitoring | Client console + optional DSN flag; **no Sentry SDK** | Ops-dependent | Risk |
| Backup / restore | `docs/BACKUP_AND_RESTORE.md` complete | Ops must enable PITR/backups | Pass with risk |
| Health endpoint | Edge `health` + client probe | Must wire uptime | Pass with risk |
| Customer / Vendor / Admin workflows | Code paths present | Need beta checklist sign-off | Pass with risk |

---

## 1. Production environment variables

### Client (`VITE_*`) — required

| Variable | Purpose |
|----------|---------|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Public anon key |

### Client — optional gates

| Variable | Purpose |
|----------|---------|
| `VITE_MONCASH_ENABLED=true` | Enables MonCash redirect UI |
| `VITE_SENTRY_DSN` | Flag only (SDK **not** packaged) |
| `VITE_APP_VERSION` | Log/health version label |

### Edge secrets — required for production payments / auth email

| Variable | Purpose |
|----------|---------|
| `SUPABASE_URL` | Injected by platform (missing from `.env.example`) |
| `SUPABASE_ANON_KEY` | JWT user client in MonCash functions (missing from `.env.example`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Settlement, webhooks, OTP |
| `MONCASH_CLIENT_ID` / `MONCASH_CLIENT_SECRET` | Digicel API |
| `MONCASH_MODE` | `sandbox` \| `live` (default sandbox) |
| `MONCASH_WEBHOOK_SECRET` | POST webhook auth |
| `MONCASH_ALLOW_UNSIGNED_CAPTURE` | Must be `false` in production |
| `RESEND_API_KEY` | OTP email |
| `ALLOWED_ORIGINS` | CORS allowlist |
| `ALLOW_DEV_OTP` | Must be `false` in production |
| `PAYMENT_RETURN_URL` / `APP_URL` | Return redirect base |

**Secrets incorrectly in `VITE_*`:** None found.

---

## 2. Database migrations

**64 migrations** from `20260726223813_*` through `20260730210000_moncash_enable_and_legal_acceptance.sql`.

Critical late-chain migrations:

| Migration | Role |
|-----------|------|
| `…170000_payment_architecture.sql` | Payments, ledger, webhooks, providers |
| `…200000_harden_payment_rpc_security.sql` | Settlement = admin / `service_role` only |
| `…210000_moncash_enable_and_legal_acceptance.sql` | MonCash enabled + legal columns |

**Ops action:** Confirm `supabase migration list` / Dashboard shows all applied on the production project.

---

## 3. Edge Functions (deploy required)

| Function | Role |
|----------|------|
| `health` | Uptime / DB / MonCash credential probe |
| `moncash-create-payment` | Initiate checkout |
| `moncash-verify-payment` | Confirm + settle |
| `payment-webhook` | GET return + POST notify |
| `send-email-otp` | Email OTP |
| `verify-email-otp` | OTP verify |
| `reset-password` | Password reset via OTP |

**Deploy status from this audit: UNKNOWN.**

---

## 4. MonCash endpoints

| Digicel API | Path |
|-------------|------|
| OAuth | `POST {host}/oauth/token` |
| Create | `POST {host}/v1/CreatePayment` |
| Capture by order | `POST {host}/v1/RetrieveOrderPayment` |
| Capture by txn | `POST {host}/v1/RetrieveTransactionPayment` |
| Redirect | `{gateway}/Payment/Redirect?token=` |

Hosts: sandbox `sandbox.moncashbutton.digicelgroup.com` · live `moncashbutton.digicelgroup.com`.

App invokes: `moncash-create-payment`, `moncash-verify-payment`; return `#/payment/return`.

---

## 5. Webhooks

| Method | Behavior |
|--------|----------|
| **POST** `?provider=moncash` | Requires shared secret (timing-safe); **401** if invalid; Digicel re-capture before settle |
| **GET** `?provider=moncash` | Browser return; **no shared-secret**; settles only after Digicel Retrieve* succeeds |

NatCash/card webhook paths are seeded but **not implemented** in Edge (expected — architecture stubs).

---

## 6. RLS

- Core marketplace tables created in-repo have `ENABLE ROW LEVEL SECURITY`.
- Payment settlement RPCs hardened (`20260730200000_*`).
- Storage KYC / delivery proofs: private buckets + signed URLs in app.

### Residual policy risk (must verify on live DB)

```sql
-- Historically created; never DROP'd in later migrations:
-- anon_insert_orders  FOR INSERT TO anon, authenticated WITH CHECK (true)
-- anon_insert_messages / anon_select_messages (messaging migrations)
```

**Before public open:** confirm these policies are absent or replaced with owner-scoped checks. If present, drop/replace immediately.

Also confirm `order_items` has RLS enabled on the live DB (policies exist in medium security migration; ENABLE not proven in greenfield CREATE chain).

---

## 7. Legal pages

| Doc | Route |
|-----|-------|
| Privacy Policy | `#/legal/privacy` |
| Terms of Service | `#/legal/terms` |
| Vendor Agreement | `#/legal/vendor-terms` |
| Classified Listing Policy | `#/legal/classified-policy` |
| Payment Policy | `#/legal/payment-policy` |
| Refund / Dispute | `#/legal/refund-policy` |

Signup records acceptance timestamps/versions. **PASS (code).**

---

## 8. Monitoring

- `initClientMonitoring()` → structured `console` + window error handlers.
- `VITE_SENTRY_DSN` does **not** load `@sentry/browser` (not in dependencies).
- Edge logs + `audit_logs` / `payment_webhook_events` for payments.
- Alerts: documented in `docs/PRODUCTION_OPS.md` (external uptime tools) — **not auto-provisioned**.

---

## 9. Backup and restore

- Strategy + restore steps: `docs/BACKUP_AND_RESTORE.md` — **PASS (docs)**.
- Live PITR / schedule / last successful backup: **UNVERIFIED**.

---

## 10. Health endpoint

- `GET /functions/v1/health` → DB probe; reports MonCash/Resend config presence.
- Client: `src/lib/health.ts`.
- Must be registered in an uptime monitor before launch.

---

## 11. Workflows (code-path audit)

| Role | Covered in code |
|------|-----------------|
| **Customer** | Auth, browse, cart, checkout, MonCash return, messages, legal routes |
| **Vendor** | Products, orders, KYC, withdrawals, ad fee / MonCash, settings → legal |
| **Admin** | Vendors, KYC, products, orders, payments, withdrawals, integrations, analytics |

MonCash UI requires `VITE_MONCASH_ENABLED=true` + Edge secrets; otherwise unpaid / manual admin path remains.

Full human checklist: `docs/BETA_TESTING_CHECKLIST.md`.

---

## Remaining risks before public launch

### Critical (clear before open public traffic)

1. **Confirm or remove `anon_insert_orders` (and loose anon message policies)** on the live database.
2. **Confirm all 64 migrations applied** on production (especially payment harden + legal/MonCash enable).
3. **Deploy all 7 Edge functions** with production secrets; `ALLOW_DEV_OTP=false`; `MONCASH_ALLOW_UNSIGNED_CAPTURE=false`.
4. **Sandbox MonCash E2E signed off** (order + ad fee + webhook 401/200 + return confirm) per `docs/MONCASH_FULL_TEST_PLAN.md`.
5. **Verify `order_items` RLS enabled** on live DB.

### High

6. Live Digicel **production** credentials + `MONCASH_MODE=live` only after sandbox sign-off.
7. `ALLOWED_ORIGINS` / `PAYMENT_RETURN_URL` locked to production hosts.
8. Uptime alert on `/functions/v1/health` (and MonCash credentials missing while UI enabled).
9. Supabase backup / PITR confirmed enabled; restore drill owner assigned.

### Medium

10. Client monitoring is console-only unless Sentry SDK is wired later.
11. GET MonCash return settles without shared-secret (mitigated by Digicel capture APIs — still monitor for abuse).
12. NatCash / card rails intentionally disconnected — do not market as available.
13. Private-beta demo accounts must be rotated/disabled before wide public launch (`docs/PRIVATE_BETA.md`).
14. `.env.example` omits `SUPABASE_URL` / `SUPABASE_ANON_KEY` Edge names (ops confusion risk only).

### Low

15. Dual `.sql.sql` / nested-timestamp migration filenames (historical; apply-order OK if run in filename order).
16. Ops docs occasionally name audit/webhook tables differently than schema (`audit_logs` / `payment_webhook_events`).
17. ESLint pre-existing hook dependency warnings (non-blocking).

---

## Go criteria (when to upgrade verdict)

| To reach… | Required |
|-----------|----------|
| **GO** | Critical #1–5 cleared on live + High #6–9 cleared + beta checklist signed with no open P0/P1 |
| Stay **GO WITH MINOR RISKS** | Controlled/private beta with sandbox MonCash, secrets set, health monitored, Critical #1 verified or mitigated |
| **NO GO** | Any Critical item fails verification, or payments forgeable, or migrations/functions missing on prod |

---

## Summary statement

The application is **feature-complete for Production V1** in code, with payment architecture, legal surfaces, health, and ops documentation in place. Automated static gates pass.  

**Public launch is not unconditionally approved:** live security verification (especially residual anon RLS), migration/function deployment, and MonCash sandbox sign-off remain.  

**Verdict: GO WITH MINOR RISKS** for a controlled Production V1 / private-beta launch, contingent on clearing the Critical list above before opening to the public.
