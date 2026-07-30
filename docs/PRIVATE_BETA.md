# Private Beta — setup

TOUPRE Production V1 private beta uses **demo vendors, customers, and products** plus the beta checklist.

## 1. Create Auth users (Supabase Dashboard → Authentication)

| Role | Suggested email | Notes |
|------|-----------------|-------|
| Vendor 1 | `demo.vendor1@toupre.local` | Marketplace + classified |
| Vendor 2 | `demo.vendor2@toupre.local` | Optional second shop |
| Customer 1 | `demo.customer1@toupre.local` | Primary buyer |
| Customer 2 | `demo.customer2@toupre.local` | Optional second buyer |
| Admin | existing admin account | Do not use demo for admin |

Set known passwords in the password manager (not in git).

## 2. Seed demo data

In SQL editor (staging / beta project only):

```sql
SELECT set_config('app.demo_vendor_user_id',   '<vendor1-auth-uuid>', true);
SELECT set_config('app.demo_vendor_user_id_2', '<vendor2-auth-uuid>', true);  -- optional
SELECT set_config('app.demo_customer_user_id',   '<customer1-auth-uuid>', true);
SELECT set_config('app.demo_customer_user_id_2', '<customer2-auth-uuid>', true); -- optional
```

Then run `supabase/seed/demo_production_data.sql`.

### What the seed creates

**Vendors**

- Maché Demo Petyonvil (verified, MonCash phone set, balance)
- Anons Demo Delmas (if vendor 2 UUID set)

**Customers**

- Demo Kliyan 1 / 2 with legal acceptance timestamps

**Products**

- Marketplace: food, clothing, service
- Classified: active Kay, expired Machin, draft pending
- Vendor 2: active Machin + food (if present)

**Orders**

- One unpaid demo order for checkout / MonCash testing

## 3. Edge / env for beta

- Prefer `MONCASH_MODE=sandbox` during private beta
- `VITE_MONCASH_ENABLED=true` only after Edge secrets are set
- `ALLOW_DEV_OTP=false` even in beta if email OTP is production-like

## 4. Run checklist

See **`docs/BETA_TESTING_CHECKLIST.md`**.

## 5. Cleanup (after beta)

Do not leave demo passwords weak on production. Disable or delete demo Auth users before public launch, or rotate passwords and strip demo markers from business names.
