# Database backup and restore

TOUPRE data lives in Supabase Postgres. Use managed backups plus an export cadence for operational safety.

## Backup strategy

### 1. Supabase managed (primary)

- **Pro+**: daily automatic backups with point-in-time recovery (PITR) per plan.
- Confirm project plan supports PITR before production traffic.
- Keep at least one manual backup before schema-heavy deploys.

Dashboard: Project → Database → Backups.

### 2. Logical export (secondary)

Weekly (or before releases):

```bash
# Requires database password from Project Settings → Database
pg_dump "postgresql://postgres.[REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres" \
  --format=custom --no-owner --file="toupre-$(date -u +%Y%m%dT%H%MZ).dump"
```

Store dumps in encrypted object storage (S3/GCS) with retention ≥ 30 days.

### 3. What to back up

| Asset | Method |
|-------|--------|
| Postgres (orders, payments, vendors, RLS) | Supabase backup + `pg_dump` |
| Storage buckets (KYC, proofs) | Supabase Storage replication / periodic `supabase storage` sync |
| Edge secrets | Documented in ops vault (never in git) |
| Migrations | Git (`supabase/migrations/`) |

## Restore procedure

### A. Managed restore (preferred)

1. Put the app in maintenance (disable writes / freeze deploys).
2. Supabase Dashboard → Database → Backups → Restore to target timestamp.
3. Re-deploy matching app + Edge function versions from git tag.
4. Run `GET /functions/v1/health` and admin smoke (login, payments list, one product).
5. Re-enable traffic.

### B. Logical restore (`pg_restore`)

**Only on an empty or dedicated restore project** — never restore blindly over live without a snapshot.

```bash
pg_restore --clean --if-exists --no-owner \
  -d "postgresql://postgres.[REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres" \
  toupre-YYYYMMDD.dump
```

Then:

1. `supabase db push` / re-apply any migrations newer than the dump.
2. Verify RLS still enabled on public tables.
3. Re-set Edge secrets; redeploy functions.
4. Health check + payment reconciliation RPC if needed:

```sql
SELECT public.run_payment_reconciliation('moncash');
```

## Verification after restore

- [ ] `settings` readable
- [ ] Auth login works (customer + vendor + admin)
- [ ] Recent `payments` / `orders` counts look sane
- [ ] Storage signed URL for a KYC sample works
- [ ] MonCash create/verify still authorized (secrets intact)

## RPO / RTO targets (ops)

- **RPO**: ≤ 24h with daily backups; minutes with PITR if enabled
- **RTO**: restore + verify within one maintenance window; document owner on-call
