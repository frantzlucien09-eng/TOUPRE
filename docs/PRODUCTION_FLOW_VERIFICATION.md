# TOUPRE Production Hardening — Flow Verification

Manual checklist after deploying migrations + this branch.

## Preflight
- [ ] `npm run typecheck && npm run lint && npm run build && npm run smoke`
- [ ] Apply migrations through `20260730200000_harden_payment_rpc_security.sql`
- [ ] Set Edge secrets: `ALLOWED_ORIGINS`, `RESEND_*`; ensure `ALLOW_DEV_OTP` unset/false
- [ ] Optional: run `supabase/seed/demo_production_data.sql` on staging with auth UUIDs

## Vendor flows
1. Register / login → KYC submit (docs upload succeeds; admin can open signed images)
2. Create marketplace product (manje) → appears active after approve if required
3. Create Kay/Machin ad → submit listing fee request (copy says manual verify) → status Pending Payment
4. After admin verify + approve → ad public for duration days
5. Expire / wait → soft-expire → still visible to vendor with Renew; gone from customer feed
6. Accept order → prepare → deliver with proof photo → complete
7. Request withdrawal → admin can change status; labels consistent

## Customer flows (this branch)
1. Customer session → catalog shows only active non-expired products/ads
2. Classified card → Mesaj / Rele only (no cart)
3. Orders tab lists existing orders (placement may require Phase 1 merge)

## Admin flows
1. `#/admin` login → dashboard loads without hanging
2. KYC approve/reject with document preview
3. Products → Anons Kay/Machin → verify payment / waive / approve / reject / renew
4. Payments → expire stale (admin only; non-admin RPC forbidden)
5. Integrations → listing fee settings editable

## Security spot-checks
- [ ] Non-admin authenticated user cannot `transition_payment_status` to `paid`
- [ ] OTP function logs never include 6-digit codes
- [ ] Avatar upload path = `{auth.uid()}/...`
- [ ] KYC/delivery proofs load via signed URLs
