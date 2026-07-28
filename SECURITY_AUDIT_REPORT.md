# TOUPRE VANDE — Supabase Security Audit Report

**Date:** 2026-07-28
**Tables audited:** 73 public tables, 9 views, 40+ functions, 4 storage buckets
**Total issues identified:** 79

---

## Category 1: RLS Policies — FOR ALL Anti-Pattern (56 issues)

| Issue ID | Severity | Object Name | Why It Exists | Risk | Recommended Fix | Auto-Fix Safe? |
|----------|----------|-------------|---------------|------|-----------------|----------------|
| RLS-001 | Medium | activity_logs.admin_manage_activity_logs | Single policy covers all CRUD verbs | Overly broad; cannot distinguish read vs write permissions | Split into 4 separate SELECT/INSERT/UPDATE/DELETE policies | Yes |
| RLS-002 | Medium | addresses.admin_manage_addresses | Same pattern | Same risk | Split into 4 policies | Yes |
| RLS-003 | Medium | addresses.customer_manage_own_addresses | Same pattern | Same risk | Split into 4 policies | Yes |
| RLS-004 | Medium | admin_logs.admin_manage_admin_logs | Same pattern | Same risk | Split into 4 policies | Yes |
| RLS-005 | Medium | admin_permissions.admin_manage_admin_permissions | Same pattern | Same risk | Split into 4 policies | Yes |
| RLS-006 | Medium | admin_roles.admin_manage_admin_roles | Same pattern | Same risk | Split into 4 policies | Yes |
| RLS-007 | Medium | ambassador_applications.admin_manage_ambassador_applications | Same pattern | Same risk | Split into 4 policies | Yes |
| RLS-008 | Medium | analytics_events.admin_manage_analytics_events | Same pattern | Same risk | Split into 4 policies | Yes |
| RLS-009 | Medium | audit_logs.admin_manage_audit_logs | Same pattern | Same risk | Split into 4 policies | Yes |
| RLS-010 | Medium | automation_error_log.admin_manage_error_log | Same pattern | Same risk | Split into 4 policies | Yes |
| RLS-011 | Medium | brands.admin_manage_brands | Same pattern | Same risk | Split into 4 policies | Yes |
| RLS-012 | Medium | broadcast_messages.admin_manage_broadcast_messages | Same pattern | Same risk | Split into 4 policies | Yes |
| RLS-013 | Medium | cart_items.admin_manage_cart_items | Same pattern | Same risk | Split into 4 policies | Yes |
| RLS-014 | Medium | cart_items.customer_manage_own_cart_items | Same pattern | Same risk | Split into 4 policies | Yes |
| RLS-015 | Medium | carts.admin_manage_carts | Same pattern | Same risk | Split into 4 policies | Yes |
| RLS-016 | Medium | carts.customer_manage_own_carts | Same pattern | Same risk | Split into 4 policies | Yes |
| RLS-017 | Medium | categories.admin_manage_categories | Same pattern | Same risk | Split into 4 policies | Yes |
| RLS-018 | Medium | conversations.conv_admin_manage | Same pattern | Same risk | Split into 4 policies | Yes |
| RLS-019 | Medium | coupons.admin_manage_coupons | Same pattern | Same risk | Split into 4 policies | Yes |
| RLS-020 | Medium | customers.admin_manage_customers | Same pattern | Same risk | Split into 4 policies | Yes |
| RLS-021 | Medium | deliveries.admin_manage_deliveries | Same pattern | Same risk | Split into 4 policies | Yes |
| RLS-022 | Medium | delivery_drivers.admin_manage_delivery_drivers | Same pattern | Same risk | Split into 4 policies | Yes |
| RLS-023 | Medium | device_sessions.user_manage_own_device_sessions | Same pattern | Same risk | Split into 4 policies | Yes |
| RLS-024 | Medium | device_sessions.admin_manage_device_sessions | Same pattern | Same risk | Split into 4 policies | Yes |
| RLS-025 | Medium | favorites.customer_manage_own_favorites | Same pattern | Same risk | Split into 4 policies | Yes |
| RLS-026 | Medium | inventory.admin_manage_inventory | Same pattern | Same risk | Split into 4 policies | Yes |
| RLS-027 | Medium | inventory.vendor_manage_own_inventory | Same pattern | Same risk | Split into 4 policies | Yes |
| RLS-028 | Medium | messages.msg_admin_manage | Same pattern | Same risk | Split into 4 policies | Yes |
| RLS-029 | Medium | notifications.notif_admin_manage | Same pattern | Same risk | Split into 4 policies | Yes |
| RLS-030 | Medium | notifications.user_manage_own_notifications | Same pattern | Same risk | Split into 4 policies | Yes |
| RLS-031 | Medium | order_items.admin_manage_order_items | Same pattern | Same risk | Split into 4 policies | Yes |
| RLS-032 | Medium | orders.admin_manage_orders | Same pattern | Same risk | Split into 4 policies | Yes |
| RLS-033 | Medium | payment_methods.admin_manage_payment_methods | Same pattern | Same risk | Split into 4 policies | Yes |
| RLS-034 | Medium | payment_methods.customer_manage_own_payment_methods | Same pattern | Same risk | Split into 4 policies | Yes |
| RLS-035 | Medium | payments.admin_manage_payments | Same pattern | Same risk | Split into 4 policies | Yes |
| RLS-036 | Medium | product_images.vendor_manage_own_product_images | Same pattern | Same risk | Split into 4 policies | Yes |
| RLS-037 | Medium | product_images.admin_manage_product_images | Same pattern | Same risk | Split into 4 policies | Yes |
| RLS-038 | Medium | promotions.admin_manage_promotions | Same pattern | Same risk | Split into 4 policies | Yes |
| RLS-039 | Medium | recent_views.admin_manage_recent_views | Same pattern | Same risk | Split into 4 policies | Yes |
| RLS-040 | Medium | recent_views.user_manage_own_recent_views | Same pattern | Same risk | Split into 4 policies | Yes |
| RLS-041 | Medium | reviews.admin_manage_reviews | Same pattern | Same risk | Split into 4 policies | Yes |
| RLS-042 | Medium | search_history.admin_manage_search_history | Same pattern | Same risk | Split into 4 policies | Yes |
| RLS-043 | Medium | search_history.user_manage_own_search_history | Same pattern | Same risk | Split into 4 policies | Yes |
| RLS-044 | Medium | settings.admin_manage_settings | Same pattern | Same risk | Split into 4 policies | Yes |
| RLS-045 | Medium | settings.settings_write_admin | Same pattern | Same risk | Split into 4 policies | Yes |
| RLS-046 | Medium | social_media_links.admin_manage_social_media_links | Same pattern | Same risk | Split into 4 policies | Yes |
| RLS-047 | Medium | stores.admin_manage_stores | Same pattern | Same risk | Split into 4 policies | Yes |
| RLS-048 | Medium | subcategories.admin_manage_subcategories | Same pattern | Same risk | Split into 4 policies | Yes |
| RLS-049 | Medium | support_tickets.admin_manage_tickets | Same pattern | Same risk | Split into 4 policies | Yes |
| RLS-050 | Medium | transactions.admin_manage_transactions | Same pattern | Same risk | Split into 4 policies | Yes |
| RLS-051 | Medium | trust_events.admin_manage_trust_events | Same pattern | Same risk | Split into 4 policies | Yes |
| RLS-052 | Medium | trust_scores.admin_manage_trust_scores | Same pattern | Same risk | Split into 4 policies | Yes |
| RLS-053 | Medium | vendor_applications.admin_manage_vendor_applications | Same pattern | Same risk | Split into 4 policies | Yes |
| RLS-054 | Medium | vendor_rankings.admin_manage_rankings | Same pattern | Same risk | Split into 4 policies | Yes |
| RLS-055 | Medium | wallets.admin_manage_wallets | Same pattern | Same risk | Split into 4 policies | Yes |
| RLS-056 | Medium | withdrawals.admin_manage_withdrawals | Same pattern | Same risk | Split into 4 policies | Yes |

---

## Category 2: Views Without RLS (9 issues)

| Issue ID | Severity | Object Name | Why It Exists | Risk | Recommended Fix | Auto-Fix Safe? |
|----------|----------|-------------|---------------|------|-----------------|----------------|
| VW-001 | **Critical** | admin_analytics_summary | View created without RLS; exposes platform revenue, commission, order counts | Any authenticated user can see all financial data | Enable RLS + add admin-only SELECT policy | Yes |
| VW-002 | **Critical** | admin_daily_revenue | View exposes daily revenue/commission breakdown | Any authenticated user can see all revenue data | Enable RLS + add admin-only SELECT policy | Yes |
| VW-003 | **Critical** | clients | View exposes customer PII (name, email, phone, location, spending) | Any authenticated user can see all customer data | Enable RLS + add admin-only SELECT policy | Yes |
| VW-004 | High | profile_changes | View exposes pending name/avatar change requests | Vendors can see other vendors' change requests | Enable RLS + add admin-only SELECT policy | Yes |
| VW-005 | High | trust_score_events | View exposes trust events with user IDs and admin actions | Any authenticated user can see all trust events | Enable RLS + add admin-only SELECT policy | Yes |
| VW-006 | Medium | top_products_view | View exposes product revenue estimates | Minor data exposure | Enable RLS + add authenticated SELECT policy | Yes |
| VW-007 | Medium | top_sellers_view | View exposes vendor revenue/rankings | Vendor revenue visible to all | Enable RLS + add authenticated SELECT policy | Yes |
| VW-008 | Medium | v_top_products | Duplicate of top_products_view | Same risk | Enable RLS + add authenticated SELECT policy | Yes |
| VW-009 | Medium | v_top_sellers | Duplicate of top_sellers_view | Same risk | Enable RLS + add authenticated SELECT policy | Yes |

---

## Category 3: SECURITY DEFINER Functions with Public Execute (22 issues)

| Issue ID | Severity | Object Name | Why It Exists | Risk | Recommended Fix | Auto-Fix Safe? |
|----------|----------|-------------|---------------|------|-----------------|----------------|
| FN-001 | **Critical** | assign_seller_badges | Trigger function granted EXECUTE to anon/PUBLIC | Any client can call this function directly, bypassing triggers | Revoke EXECUTE from anon/PUBLIC; keep only postgres/service_role | Yes |
| FN-002 | **Critical** | calculate_order_commission | Trigger function granted EXECUTE to anon/PUBLIC | Any client can call this, potentially affecting order commission | Revoke from anon/PUBLIC | Yes |
| FN-003 | **Critical** | compute_seller_badge | Helper function granted to anon/PUBLIC | Information disclosure of badge computation | Revoke from anon/PUBLIC | Yes |
| FN-004 | **Critical** | get_effective_commission_rate | Exposes commission rate logic to anon/PUBLIC | Rate manipulation risk if logic changes | Revoke from anon/PUBLIC | Yes |
| FN-005 | **Critical** | get_platform_commission_rate | Exposes platform commission to anon/PUBLIC | Information disclosure | Revoke from anon/PUBLIC | Yes |
| FN-006 | High | get_top_products | RPC granted to anon/PUBLIC | Unauthenticated access to product data | Revoke from anon; keep authenticated | Yes |
| FN-007 | High | get_top_sellers | RPC granted to anon/PUBLIC | Unauthenticated access to seller rankings | Revoke from anon; keep authenticated | Yes |
| FN-008 | **Critical** | get_vendor_dashboard | RPC granted to anon/PUBLIC (duplicate grants) | Any client can call vendor dashboard RPC | Revoke from anon/PUBLIC; keep authenticated | Yes |
| FN-009 | High | get_vendor_dashboard_stats | RPC granted to anon/PUBLIC | Unauthenticated vendor stats access | Revoke from anon; keep authenticated | Yes |
| FN-010 | High | get_vendor_seller_badge | RPC granted to anon/PUBLIC | Unauthenticated badge lookup | Revoke from anon; keep authenticated | Yes |
| FN-011 | **Critical** | log_automation_error | Trigger function granted to anon/PUBLIC (duplicate grants) | Any client can inject error log entries | Revoke from anon/PUBLIC | Yes |
| FN-012 | High | notify_admins | Notification function granted to anon/PUBLIC | Any client can trigger admin notifications | Revoke from anon/PUBLIC | Yes |
| FN-013 | High | notify_order_parties | Notification function granted to anon/PUBLIC | Any client can trigger order notifications | Revoke from anon/PUBLIC | Yes |
| FN-014 | High | notify_user | Notification function granted to anon/PUBLIC | Any client can send notifications to any user | Revoke from anon/PUBLIC | Yes |
| FN-015 | High | notify_withdrawal_payout | Notification function granted to anon/PUBLIC | Any client can trigger withdrawal notifications | Revoke from anon/PUBLIC | Yes |
| FN-016 | High | recalculate_vendor_stats | Stats function granted to anon/PUBLIC | Any client can trigger stats recalculation | Revoke from anon/PUBLIC | Yes |
| FN-017 | High | sync_product_favorite_count | Trigger function granted to anon/PUBLIC | Any client can manipulate favorite counts | Revoke from anon/PUBLIC | Yes |
| FN-018 | High | trigger_recalc_on_order | Trigger function granted to anon/PUBLIC | Any client can trigger recalculation | Revoke from anon/PUBLIC | Yes |
| FN-019 | High | update_product_stats_on_order_item | Trigger function granted to anon/PUBLIC | Any client can update product stats | Revoke from anon/PUBLIC | Yes |
| FN-020 | High | update_vendor_stats | Stats function granted to anon/PUBLIC | Any client can update vendor stats | Revoke from anon/PUBLIC | Yes |
| FN-021 | High | update_vendor_stats_on_order | Trigger function granted to anon/PUBLIC | Any client can trigger vendor stats update | Revoke from anon/PUBLIC | Yes |
| FN-022 | High | update_vendor_stats_on_withdrawal | Trigger function granted to anon/PUBLIC | Any client can trigger stats update on withdrawal | Revoke from anon/PUBLIC | Yes |

---

## Category 4: Missing RLS

No issues — all 73 tables have RLS enabled.

---

## Category 5: Exposed Tables

No issues — all tables have RLS enabled with policies. The exposure risk is through FOR ALL policies (see Category 1) and views (see Category 2).

---

## Category 6: Exposed Views

Covered in Category 2 (9 views without RLS).

---

## Category 7: Public Schema Permissions

| Issue ID | Severity | Object Name | Why It Exists | Risk | Recommended Fix | Auto-Fix Safe? |
|----------|----------|-------------|---------------|------|-----------------|----------------|
| PERM-001 | Medium | All 73 tables | authenticated role has TRUNCATE, REFERENCES, TRIGGER privileges | TRUNCATE can wipe tables; REFERENCES allows creating FKs to these tables; TRIGGER allows creating triggers | Revoke TRUNCATE, REFERENCES, TRIGGER from authenticated; keep only SELECT, INSERT, UPDATE, DELETE | Yes |

---

## Category 8: Authentication

| Issue ID | Severity | Object Name | Why It Exists | Risk | Recommended Fix | Auto-Fix Safe? |
|----------|----------|-------------|---------------|------|-----------------|----------------|
| AUTH-001 | Low | email_otp_codes | OTP codes stored in DB | If RLS fails, OTP codes visible | Verify RLS is properly scoped | No action needed |

No critical authentication issues found. Email confirmation is OFF (correct per project requirements).

---

## Category 9: Storage Policies

| Issue ID | Severity | Object Name | Why It Exists | Risk | Recommended Fix | Auto-Fix Safe? |
|----------|----------|-------------|---------------|------|-----------------|----------------|
| STO-001 | **Critical** | kyc-documents bucket (public=true) | Bucket marked as public | Sensitive KYC documents (ID cards, business docs) accessible to anyone | Set public=false; restrict to authenticated with vendor ownership check | Yes |
| STO-002 | **Critical** | delivery-proofs bucket (public=true) | Bucket marked as public | Delivery proof photos accessible to anyone | Set public=false; restrict to authenticated with ownership check | Yes |
| STO-003 | High | avatars INSERT policy | No ownership check — any authenticated user can upload to avatars bucket | User could upload files with arbitrary names, potentially overwriting others | Add ownership check using auth.uid() in file path | Partial |
| STO-004 | High | avatars UPDATE/DELETE policy | No ownership check | Any authenticated user can delete/update anyone's avatar | Add ownership check | Partial |
| STO-005 | High | delivery-proofs INSERT policy | No ownership check | Any authenticated user can upload delivery proof files | Add vendor/driver ownership check | Partial |
| STO-006 | High | kyc-docs INSERT/UPDATE/DELETE policy | No ownership check | Any authenticated user can modify KYC documents | Add vendor ownership check | Partial |
| STO-007 | Medium | product-media INSERT policy | No ownership check | Any authenticated user can upload product images for any vendor | Add vendor ownership check | Partial |
| STO-008 | Medium | product-media UPDATE/DELETE policy | No ownership check | Any authenticated user can delete/update any product image | Add vendor ownership check | Partial |

---

## Category 10: SQL Injection Risks

| Issue ID | Severity | Object Name | Why It Exists | Risk | Recommended Fix | Auto-Fix Safe? |
|----------|----------|-------------|---------------|------|-----------------|----------------|
| SQLI-001 | Low | rls_auto_enable | Uses `format()` with `cmd.object_identity` in EXECUTE | Low risk — `object_identity` is system-generated, not user input | No action needed; `format()` properly escapes | N/A |

No SQL injection vulnerabilities found. All dynamic SQL uses `format()` with proper escaping.

---

## Category 11: Privilege Escalation Risks

| Issue ID | Severity | Object Name | Why It Exists | Risk | Recommended Fix | Auto-Fix Safe? |
|----------|----------|-------------|---------------|------|-----------------|----------------|
| PRIV-001 | **Critical** | rls_auto_enable function | search_path set to 'pg_catalog' instead of 'public' | If a malicious function with the same name exists in pg_catalog, it could be hijacked | Change search_path to 'public' | Yes |
| PRIV-002 | High | has_role function | SECURITY DEFINER granted to authenticated | Runs with elevated privileges; if logic is flawed, privilege escalation | Verify function is safe (currently looks correct) | No action needed |

---

## Category 12: Missing Indexes (12 issues)

| Issue ID | Severity | Object Name | Why It Exists | Risk | Recommended Fix | Auto-Fix Safe? |
|----------|----------|-------------|---------------|------|-----------------|----------------|
| IDX-001 | Low | ambassador_applications.reviewed_by | FK column without index | Slow joins on admin review queries | CREATE INDEX | Yes |
| IDX-002 | Low | avatar_review_requests.vendor_id | FK column without index | Slow joins | CREATE INDEX | Yes |
| IDX-003 | Low | client_disputes.client_id | FK column without index | Slow joins | CREATE INDEX | Yes |
| IDX-004 | Low | conversations.customer_id | FK column without index | Slow message queries | CREATE INDEX | Yes |
| IDX-005 | Low | conversations.vendor_id | FK column without index | Slow message queries | CREATE INDEX | Yes |
| IDX-006 | Low | name_change_requests.vendor_id | FK column without index | Slow admin queries | CREATE INDEX | Yes |
| IDX-007 | Low | referrals.referred_id | FK column without index | Slow referral queries | CREATE INDEX | Yes |
| IDX-008 | Low | referrals.referrer_id | FK column without index | Slow referral queries | CREATE INDEX | Yes |
| IDX-009 | Low | trust_events.admin_id | FK column without index | Slow admin queries | CREATE INDEX | Yes |
| IDX-010 | Low | trust_history.vendor_id | FK column without index | Slow trust queries | CREATE INDEX | Yes |
| IDX-011 | Low | vendor_actions.vendor_id | FK column without index | Slow vendor queries | CREATE INDEX | Yes |
| IDX-012 | Low | vendor_applications.reviewed_by | FK column without index | Slow admin queries | CREATE INDEX | Yes |

---

## Category 13: Unsafe Grants

Covered in Category 3 (function execute grants) and Category 7 (table privileges).

---

## Category 14: Anonymous Access

No anon RLS policies found on tables (good — app requires authentication).
However, 22 SECURITY DEFINER functions are executable by anon (see Category 3).

---

## Category 15: Performance Warnings

| Issue ID | Severity | Object Name | Why It Exists | Risk | Recommended Fix | Auto-Fix Safe? |
|----------|----------|-------------|---------------|------|-----------------|----------------|
| PERF-001 | Low | get_vendor_dashboard | Duplicate EXECUTE grants (4x to each role) | Grant bloat, potential permission confusion | Revoke all and re-grant once | Yes |
| PERF-002 | Low | log_automation_error | Duplicate EXECUTE grants (9x to each role) | Grant bloat | Revoke all and re-grant once | Yes |

---

## Summary by Severity

| Severity | Count | Categories |
|----------|-------|------------|
| **Critical** | 16 | Views without RLS (3), Function execute grants (10), Storage buckets public (2), rls_auto_enable search_path (1) |
| **High** | 30 | Views without RLS (2), Function execute grants (12), Storage ownership checks (4), Privilege escalation (1), Function grants (11) |
| **Medium** | 31 | FOR ALL policies (56→grouped), Table permissions (1), Views (4), Storage (2) |
| **Low** | 14 | Missing indexes (12), SQL injection (1), Performance (2) |

---

## Fix Order

### Phase 1: Critical Issues
1. Enable RLS on all 9 views with admin-only or authenticated policies
2. Revoke EXECUTE from anon/PUBLIC on all 22 SECURITY DEFINER functions
3. Set kyc-documents and delivery-proofs buckets to private (public=false)
4. Fix rls_auto_enable search_path to 'public'

### Phase 2: High Issues
1. Add ownership checks to storage policies
2. Clean up duplicate function grants

### Phase 3: Medium Issues
1. Split FOR ALL policies into 4 separate CRUD policies
2. Revoke TRUNCATE/REFERENCES/TRIGGER from authenticated role

### Phase 4: Low Issues
1. Add missing FK indexes
2. Clean up duplicate grants
