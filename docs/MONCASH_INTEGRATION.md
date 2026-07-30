# MonCash production integration

TOUPRE reuses the existing payment architecture (`payments`, `create_payment`, `transition_payment_status`, ledger, retries, webhooks).

## Architecture

| Layer | Role |
|-------|------|
| Client `MonCashPaymentProvider` | Calls Edge only; gated by `VITE_MONCASH_ENABLED` |
| `moncash-create-payment` | OAuth + CreatePayment; stores checkout URL |
| `moncash-verify-payment` | RetrieveOrder/Transaction + settle as `service_role` |
| `payment-webhook` | GET return + POST notification; signature via `MONCASH_WEBHOOK_SECRET` |
| DB RPCs | Settlement, order/`ad_payments` projection, retries, audit |

Secrets never ship in `VITE_*`.

## Secrets (Edge)

```
MONCASH_CLIENT_ID=
MONCASH_CLIENT_SECRET=
MONCASH_MODE=sandbox   # or live
MONCASH_WEBHOOK_SECRET=
MONCASH_ALLOW_UNSIGNED_CAPTURE=false
PAYMENT_RETURN_URL=https://YOUR_APP
APP_URL=https://YOUR_APP
```

Client gate after secrets are live:

```
VITE_MONCASH_ENABLED=true
```

## Deploy

```bash
supabase functions deploy moncash-create-payment
supabase functions deploy moncash-verify-payment
supabase functions deploy payment-webhook
supabase functions deploy health
supabase db push   # includes 20260730210000_moncash_enable_and_legal_acceptance.sql
```

Webhook / return URL:

```
https://YOUR_PROJECT.supabase.co/functions/v1/payment-webhook?provider=moncash
```

App return hash route: `#/payment/return`

## Flows

1. **Ad listing fee** — `AdPaymentModal` → `ad_payments` → `initiatePaymentWithProvider(moncash)` → redirect → verify/settle → `ad_payments.status=paid`.
2. **Order checkout** — `place_order` (unpaid) → `initiatePaymentWithProvider` with `order_id` → redirect → settle → `orders.payment_status=paid`.
3. **Retry** — failed initiate schedules `schedule_payment_retry`; verify schedules retry when capture not yet successful.

## Sandbox testing

1. Set `MONCASH_MODE=sandbox` + Digicel sandbox credentials.
2. Keep `VITE_MONCASH_ENABLED=true` on staging only until verified.
3. Pay a small ad fee and a small order; confirm `payments.status=paid`, linked order/ad row, and audit log.
4. Hit `GET /functions/v1/health` — `moncash.credentials=configured`.

Full matrix (initiation, confirmation, webhooks, signature 401, retry, production secrets): **`docs/MONCASH_FULL_TEST_PLAN.md`**.

## Signature verification

POST `/functions/v1/payment-webhook?provider=moncash` requires `MONCASH_WEBHOOK_SECRET` via `x-moncash-signature` (or `x-webhook-secret` / `x-signature`). Comparison is timing-safe. Invalid signature → **401**. Settlement always re-checks Digicel capture APIs.

## Production readiness checklist

- [ ] Live Digicel credentials in Edge secrets
- [ ] `MONCASH_MODE=live`
- [ ] `MONCASH_WEBHOOK_SECRET` set; unsigned capture **off**
- [ ] `ALLOWED_ORIGINS` locked to production hosts
- [ ] `ALLOW_DEV_OTP=false`
- [ ] `VITE_MONCASH_ENABLED=true` on production build
- [ ] Smoke + typecheck + lint + build green
- [ ] Manual sandbox end-to-end signed off before go-live (`MONCASH_FULL_TEST_PLAN.md`)
- [ ] Private beta checklist signed (`BETA_TESTING_CHECKLIST.md`)
