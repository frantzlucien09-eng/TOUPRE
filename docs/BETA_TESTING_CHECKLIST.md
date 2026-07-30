# TOUPRE Private Beta — Testing Checklist

**Goal:** Production V1 readiness via private beta.  
**Rule:** No new marketplace features; validate existing flows only.  
**Date:** _______________  **Build / commit:** _______________  **Tester:** _______________

---

## 0. Environment prep

- [ ] Staging / beta project (not empty local-only)
- [ ] Auth demo users created (`docs/PRIVATE_BETA.md`)
- [ ] Demo seed applied (`supabase/seed/demo_production_data.sql`)
- [ ] Edge functions deployed: OTP, MonCash create/verify, payment-webhook, health
- [ ] `npm run typecheck && npm run lint && npm run build && npm run smoke` green
- [ ] `GET /functions/v1/health` → `ok: true`

---

## 1. Auth & roles

- [ ] Customer login / logout
- [ ] Vendor login / logout
- [ ] Admin login / logout
- [ ] New signup requires legal acceptance; links open `#/legal/*`
- [ ] OTP email works; no OTP code in Edge logs
- [ ] Google OAuth (if enabled) does not break role bootstrap

---

## 2. Legal pages (public)

- [ ] `#/legal/privacy` — Privacy Policy
- [ ] `#/legal/terms` — Terms of Service
- [ ] `#/legal/vendor-terms` — Vendor Agreement
- [ ] `#/legal/classified-policy` — Classified Listing Policy
- [ ] `#/legal/payment-policy` — Payment Policy
- [ ] `#/legal/refund-policy` — Refund / Dispute (if published)
- [ ] Vendor Settings → Kondisyon links to legal routes

---

## 3. Customer commerce (demo products)

- [ ] Browse marketplace products (Diri, Chemiz, etc.)
- [ ] Add to cart / update qty / remove
- [ ] Classified Kay/Machin **cannot** add to cart; Contact Seller works
- [ ] Expired classified **hidden** from public search
- [ ] Checkout creates unpaid order(s)
- [ ] With MonCash enabled: redirect to sandbox checkout
- [ ] After pay: `#/payment/return` confirms; order `payment_status=paid`
- [ ] Messages: customer ↔ vendor thread
- [ ] Cancel eligible order

---

## 4. Vendor flows

- [ ] Dashboard stats load
- [ ] Create / edit marketplace product
- [ ] Stock / active toggle
- [ ] Accept / prepare / deliver order (proof photo when required)
- [ ] Create Kay or Machin listing → pay fee (sandbox) or pending admin path
- [ ] Renew expired listing
- [ ] Withdrawals request with MonCash info
- [ ] KYC documents use signed URLs (not public bucket links)

---

## 5. Admin

- [ ] Vendors list / verify / suspend
- [ ] Products / classified review / waive listing fee
- [ ] Orders manage
- [ ] Payments surveillance (MonCash rows visible)
- [ ] Withdrawals approve / reject
- [ ] Integrations toggles + listing fee settings
- [ ] Analytics date range

---

## 6. MonCash (sandbox → live)

Use `docs/MONCASH_FULL_TEST_PLAN.md`.

- [ ] Sandbox initiate (order + ad fee)
- [ ] Settlement / confirmation
- [ ] Webhook signature reject (401) then accept
- [ ] Retry on pending capture
- [ ] Production secrets documented; unsigned capture off for live
- [ ] Optional: one live low-amount smoke after sandbox sign-off

---

## 7. Security & ops

- [ ] RLS: customer cannot read other customers’ orders
- [ ] Settlement RPC cannot be forged by non-admin user
- [ ] CORS / `ALLOWED_ORIGINS` correct
- [ ] Client error monitoring initialized (`initClientMonitoring`)
- [ ] Health probe in uptime tool
- [ ] Backup strategy reviewed (`docs/BACKUP_AND_RESTORE.md`)
- [ ] Alerts configured (`docs/PRODUCTION_OPS.md`)

---

## 8. Private beta acceptance

- [ ] ≥ 2 demo vendors usable
- [ ] ≥ 2 demo customers usable (or 1 if only primary seeded)
- [ ] ≥ 5 demo products covering marketplace + classified states
- [ ] Critical bugs filed with severity
- [ ] No P0/P1 open for payment, auth, or data loss
- [ ] Sign-off for Production V1 go / no-go

**Sign-off**

| Role | Name | Date | Go / No-go |
|------|------|------|------------|
| Product | | | |
| Engineering | | | |
| Ops | | | |

---

## Related docs

- `docs/PRIVATE_BETA.md`
- `docs/MONCASH_INTEGRATION.md`
- `docs/MONCASH_FULL_TEST_PLAN.md`
- `docs/PRODUCTION_OPS.md`
- `docs/BACKUP_AND_RESTORE.md`
- `docs/FINAL_PRODUCTION_READINESS_REPORT.md`
