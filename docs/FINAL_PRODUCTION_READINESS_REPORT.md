# Final Production Readiness Report

**Product:** TOUPRE (Haitian Creole marketplace)  
**Branch:** `cursor/production-release-0b16`  
**Date:** 2026-07-30  
**Goal:** Stable production release — no new product features

---

## Phase 1 — Merge & stabilize

| Item | Status |
|------|--------|
| PR #4 Customer commerce | Merged via staging |
| PR #5 Payment architecture | Merged via staging |
| PR #6 Classified listing rules | Merged via staging |
| PR #7 Production hardening | Merged via staging |
| Conflict resolution | `CustomerHome.tsx` — commerce UI + public catalog filter |
| Integration-only fixes | Cart classified gate; checkout filters ads |

**Gates (this release branch):**

```
npm run typecheck
npm run lint
npm run build
npm run smoke
```

All required green before go-live (re-run after this commit).

---

## Phase 2 — MonCash production integration

| Capability | Implementation |
|------------|----------------|
| Payment initiation | Edge `moncash-create-payment` + client `MonCashPaymentProvider` |
| Verification | Edge `moncash-verify-payment` (orderId / transactionId) |
| Secure webhooks | Edge `payment-webhook` + `MONCASH_WEBHOOK_SECRET` |
| Settlement | `transition_payment_status` as `service_role` only |
| Retry handling | `schedule_payment_retry` on failed initiate / pending capture |
| Error handling | Provider errors → `failed` + audit; client toast / return page |
| Production secrets | Edge-only `MONCASH_*`; UI gate `VITE_MONCASH_ENABLED` |
| Sandbox testing | `MONCASH_MODE=sandbox` documented in `docs/MONCASH_INTEGRATION.md` |
| Order checkout | `CustomerCheckoutPage` initiates MonCash when enabled |
| Ad listing fee | `AdPaymentModal` live redirect path |
| Return UX | `#/payment/return` |

**Reuse:** Existing `payments` / ledger / fraud / idempotency / admin payments UI. NatCash / cards remain architecture stubs.

---

## Phase 3 — Legal pages

| Document | Route |
|----------|-------|
| Privacy Policy | `#/legal/privacy` |
| Terms of Service | `#/legal/terms` |
| Vendor Terms | `#/legal/vendor-terms` |
| Classified Listing Policy | `#/legal/classified-policy` |
| Payment Policy | `#/legal/payment-policy` |
| Refund / Dispute Policy | `#/legal/refund-policy` |

- Content: `src/lib/legal.ts` (Creole)
- Signup: required acceptance + `terms_accepted_at` / `privacy_accepted_at` (+ vendor terms)
- Settings: links to legal routes
- Migration: legal acceptance columns + version settings

---

## Phase 4 — Production operations

| Area | Artifact |
|------|----------|
| Error monitoring | `src/lib/monitoring.ts` + `initClientMonitoring()` |
| Production logging | Structured client logs; Edge console; `payment_audit_log` |
| Database backup | `docs/BACKUP_AND_RESTORE.md` (managed + `pg_dump`) |
| Restore documentation | Same doc — Dashboard PITR + `pg_restore` |
| Production alerts | `docs/PRODUCTION_OPS.md` |
| Health checks | Edge `health` + `src/lib/health.ts` |
| MonCash runbook | `docs/MONCASH_INTEGRATION.md` |

---

## Go-live blockers (ops, not code)

1. Set Edge secrets (`MONCASH_*`, `ALLOWED_ORIGINS`, `ALLOW_DEV_OTP=false`, `PAYMENT_RETURN_URL`).
2. Deploy Edge functions + apply migrations including `20260730210000_*`.
3. Complete one **sandbox** ad fee + one order payment end-to-end.
4. Flip `MONCASH_MODE=live` and rebuild with `VITE_MONCASH_ENABLED=true`.
5. Confirm Supabase backup/PITR plan and uptime probe on `/functions/v1/health`.

---

## Explicitly out of scope

- New marketplace features, UI redesign, NatCash/card live rails, withdrawals automation beyond existing admin flow.

---

## Verdict

**Code is production-ready** for a controlled launch once Digicel credentials, Edge deploy, and sandbox sign-off are complete. Remaining risk is operational (secrets, live MonCash account, monitoring wiring), not missing application architecture.
