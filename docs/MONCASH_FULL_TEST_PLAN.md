# MonCash — full testing & production secrets

Companion to `MONCASH_INTEGRATION.md`. Use this for sandbox sign-off before Production V1.

## Environments

| Mode | Edge `MONCASH_MODE` | Client `VITE_MONCASH_ENABLED` | Digicel credentials |
|------|---------------------|-------------------------------|---------------------|
| Sandbox | `sandbox` | `true` on staging | Sandbox client id/secret |
| Production | `live` | `true` on prod build | Live client id/secret |

Never put `MONCASH_CLIENT_*` or `MONCASH_WEBHOOK_SECRET` in `VITE_*`.

## Production secrets checklist

```
# Edge (required for live)
MONCASH_CLIENT_ID=…
MONCASH_CLIENT_SECRET=…
MONCASH_MODE=live
MONCASH_WEBHOOK_SECRET=<long random>
MONCASH_ALLOW_UNSIGNED_CAPTURE=false
PAYMENT_RETURN_URL=https://YOUR_PROD_HOST
APP_URL=https://YOUR_PROD_HOST
ALLOWED_ORIGINS=https://YOUR_PROD_HOST
ALLOW_DEV_OTP=false

# Client build
VITE_MONCASH_ENABLED=true
VITE_SUPABASE_URL=…
VITE_SUPABASE_ANON_KEY=…
```

## Signature verification

POST webhooks must send one of:

- `x-moncash-signature`
- `x-webhook-secret`
- `x-signature`

Value must equal `MONCASH_WEBHOOK_SECRET` (timing-safe compare).  
Invalid / missing → **401** (unless `MONCASH_ALLOW_UNSIGNED_CAPTURE=true`, staging only).  
Settlement still requires a successful MonCash RetrieveOrder/Transaction API response.

## Test matrix

### A. Sandbox — payment initiation

- [ ] Health: `GET /functions/v1/health` → `moncash.credentials=configured`, `mode=sandbox`
- [ ] Vendor pays Kay/Machin listing fee → redirects to MonCash sandbox
- [ ] Customer checkout with cart → redirects to MonCash sandbox
- [ ] `payments` row: `provider=moncash`, `status=requires_action`, checkout URL set

### B. Payment confirmation & settlement

- [ ] Complete sandbox payment
- [ ] Return to `#/payment/return` → verify edge settles
- [ ] `payments.status=paid`
- [ ] Linked `orders.payment_status=paid` **or** `ad_payments.status=paid`
- [ ] Ledger / audit entries present (`payment_audit_log`)

### C. Secure webhooks

- [ ] POST webhook **without** signature → 401
- [ ] POST webhook **with** correct secret + valid transaction → 200, `settled=true`
- [ ] Duplicate event idempotent via `record_payment_webhook`
- [ ] GET return URL with `transactionId` redirects to app return route

### D. Retry & errors

- [ ] Failed initiate → payment `failed` + `schedule_payment_retry`
- [ ] Verify before Digicel confirms → 202 pending + retry scheduled
- [ ] Wrong credentials → create-payment 503 `provider_not_connected`
- [ ] User cannot forge `paid` via client RPC (settlement = service_role/admin only)

### E. Production cutover

- [ ] Sandbox matrix 100% green
- [ ] Rotate to live Digicel credentials
- [ ] `MONCASH_MODE=live`, unsigned capture **off**
- [ ] One real low-amount live smoke (ad fee or order)
- [ ] Alerts on `/functions/v1/health` + Edge 5xx

## Automated gates (no Digicel required)

```bash
npm run typecheck
npm run lint
npm run build
npm run smoke
```

Smoke asserts MonCash modules, webhook secret helper, legal routes, and health exist.
