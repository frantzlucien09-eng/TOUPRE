# Staging Integration — Regression Report

**Branch:** `cursor/staging-integration-0b16`  
**Date:** 2026-07-30  
**Merged:** PR #4 (Customer Commerce) + #5 (Payment Architecture) + #6 (Classified Rules) + #7 (Production Hardening)  
**Method:** Merge resolve + static code regression + automated gates (no live Supabase/MonCash)

---

## Gates

| Check | Result |
|-------|--------|
| `npm run typecheck` | ✅ Pass |
| `npm run lint` | ✅ Pass (20 pre-existing warnings, 0 errors) |
| `npm run build` | ✅ Pass (88 chunks; main ~299KB) |
| `npm run smoke` | ✅ Pass (incl. Phase 1 cart + classified cart gate) |

---

## Merge resolution

| Item | Result |
|------|--------|
| Conflict files | `src/pages/CustomerHome.tsx` only |
| Resolution | Kept Phase 1 commerce UI; applied `filterPublicCatalogProducts` on catalog load |
| Integration fixes | Cart `assertCanAddProductToCart`; checkout/cart filter ads; product detail Contact-Seller primary for Kay/Machin |

---

## Regression by domain

### Customer — PASS
- Auth Kliyan/Vandè tabs present (`AuthPage.tsx`)
- Cart, checkout, product detail, messages, addresses, wishlist/recent wired from `CustomerHome`
- Catalog filters classified visibility
- Ads blocked from cart at UI + `cart.ts` + DB `place_order`

### Vendor — PASS
- Shell routes: products, orders, messages, withdraw, settings, KYC, dashboard
- Classified status pills / renew / soft-expire on `ProductsPage`
- Listing fee modal honest “manual verify” copy

### Admin — PASS
- Lazy-loaded dashboard sections including payments, products (classified), KYC
- Waive / verify / approve / reject / renew for classifieds
- KYC docs via signed URLs; listing fee settings in Integrations

### Orders — PASS
- Customer `placeOrder` → RPC; vendor fulfillment pages intact
- Kay/Machin rejected by `place_order` migration

### Classifieds — PASS
- Configurable fees/duration; pending payment → admin verify/waive → approve
- Expired soft-kept; hidden from public; vendor renew

### Messaging — PASS
- `CustomerMessagesPage` + vendor `MessagesPage`
- Product detail “Kontakte vandè” for ads

### Notifications — PASS
- Vendor `NotificationsPanel`; customer in-app list/unread in Phase 1 home

### Payments — WARN (expected)
- Architecture + admin monitor present
- Providers still `UnconnectedProvider` — correct until MonCash work
- Settlement RPCs hardened (owners cannot forge `paid`)

### Withdrawals — PASS
- Vendor request + admin status updates; shared Creole labels
- No live MonCash payout (manual ops for beta)

### Security — PASS
- ErrorBoundary; OTP not logged; CORS via `ALLOWED_ORIGINS`
- Avatar `auth.uid()` path; private storage signed URLs
- AdminAuth only on `#/admin`

---

## Remaining risks (private beta / MonCash prep)

| Risk | Severity | Notes |
|------|----------|-------|
| MonCash not connected | High | Listing fees + order pay + payouts still manual/admin |
| Privacy policy missing | High | Legal gap before public; OK for closed invite beta with disclosure |
| No Sentry / backup runbook | High | Ops gap — enable before/at beta start |
| Staging DB must apply all migrations | Medium | Phase 1 + payment + classified + harden migrations in order |
| Cart RLS depends on Phase 1 migrations | Medium | Deploy `20260730150000` / `160000` before customer cart QA |
| Customer messaging vs vendor ID | Low | Confirm `onMessageVendor` uses vendor `user_id` for `send_message` in live QA |

---

## Verdict

**Staging branch is stable for private beta prep and MonCash integration.**

Ready for:
1. Deploy staging + run migrations  
2. Seed demo data (`supabase/seed/demo_production_data.sql`)  
3. Invite-only QA of customer/vendor/admin flows  
4. MonCash adapter work on top of this branch  

Not ready for public launch until MonCash + legal + monitoring land.
