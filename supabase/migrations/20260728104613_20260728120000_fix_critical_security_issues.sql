/*
# Fix Critical Security Issues — Phase 1

## Summary
Resolves 16 Critical-severity issues from the security audit:

1. **Views bypassing RLS (5 Critical + 2 High + 4 Medium)**: 9 views were owned
   by postgres and ran with owner privileges, bypassing RLS on underlying tables.
   Any authenticated user could see full financial data, customer PII, and trust
   events. Fix: set security_invoker=true on all views so they run with the
   caller's privileges and RLS on underlying tables applies. Revoke SELECT from
   anon so unauthenticated users cannot access any view.

2. **SECURITY DEFINER functions with public execute (10 Critical + 12 High)**:
   22 functions were granted EXECUTE to anon/PUBLIC, allowing unauthenticated
   clients to call trigger/notification/stats functions directly. Revoke from
   anon/PUBLIC; keep authenticated only for RPC functions, postgres/service_role
   for trigger-only functions.

3. **Public storage buckets (2 Critical)**: kyc-documents and delivery-proofs
   buckets were marked public=true, exposing sensitive documents to anyone.
   Set public=false.

4. **rls_auto_enable search_path (1 Critical)**: Event trigger function had
   search_path='pg_catalog' instead of 'public'. Fixed to 'public'.

## Security Changes
- ALTER VIEW ... SET (security_invoker = true) on 9 views
- REVOKE SELECT ON 9 views FROM anon
- REVOKE EXECUTE on all SECURITY DEFINER functions FROM anon, PUBLIC
- UPDATE storage.buckets SET public=false for kyc-documents, delivery-proofs
- ALTER FUNCTION rls_auto_enable SET search_path TO 'public'

## Important Notes
1. security_invoker=true (PostgreSQL 15+) makes the view execute with the
   querying user's privileges instead of the view owner's. This means RLS
   policies on the underlying tables (orders, customers, vendors, etc.) are
   enforced when querying through the view.
2. Trigger functions only need EXECUTE for postgres/service_role since they
   fire via triggers, not direct client calls. RPC functions keep authenticated
   since the frontend calls them directly.
3. Storage bucket public=false means unauthenticated users cannot list/download
   objects. Authenticated users still can via the storage policies.
*/

-- ============================================================
-- 1. SET security_invoker=true ON ALL VIEWS + REVOKE anon SELECT
-- ============================================================

ALTER VIEW public.admin_analytics_summary SET (security_invoker = true);
ALTER VIEW public.admin_daily_revenue SET (security_invoker = true);
ALTER VIEW public.clients SET (security_invoker = true);
ALTER VIEW public.profile_changes SET (security_invoker = true);
ALTER VIEW public.trust_score_events SET (security_invoker = true);
ALTER VIEW public.top_products_view SET (security_invoker = true);
ALTER VIEW public.top_sellers_view SET (security_invoker = true);
ALTER VIEW public.v_top_products SET (security_invoker = true);
ALTER VIEW public.v_top_sellers SET (security_invoker = true);

REVOKE SELECT ON public.admin_analytics_summary FROM anon;
REVOKE SELECT ON public.admin_daily_revenue FROM anon;
REVOKE SELECT ON public.clients FROM anon;
REVOKE SELECT ON public.profile_changes FROM anon;
REVOKE SELECT ON public.trust_score_events FROM anon;
REVOKE SELECT ON public.top_products_view FROM anon;
REVOKE SELECT ON public.top_sellers_view FROM anon;
REVOKE SELECT ON public.v_top_products FROM anon;
REVOKE SELECT ON public.v_top_sellers FROM anon;

-- ============================================================
-- 2. REVOKE EXECUTE FROM anon/PUBLIC ON ALL SECURITY DEFINER FUNCTIONS
-- ============================================================

-- Trigger-only functions: keep only postgres + service_role
REVOKE EXECUTE ON FUNCTION public.assign_seller_badges(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.calculate_order_commission() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.compute_seller_badge(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sync_product_favorite_count() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trigger_recalc_on_order() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_product_stats_on_order_item() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_vendor_stats(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_vendor_stats_on_order() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_vendor_stats_on_withdrawal() FROM anon, PUBLIC;

-- log_automation_error has 3 overloaded variants
REVOKE EXECUTE ON FUNCTION public.log_automation_error(text, text, text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.log_automation_error(text, text, uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.log_automation_error(text, text, text, text, text, jsonb) FROM anon, PUBLIC;

-- Notification functions
REVOKE EXECUTE ON FUNCTION public.notify_admins(text, text, text, jsonb) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_order_parties() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_user(uuid, text, text, text, jsonb) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_withdrawal_payout() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.recalculate_vendor_stats(uuid) FROM anon, PUBLIC;

-- RPC functions: keep authenticated (frontend calls these directly)
REVOKE EXECUTE ON FUNCTION public.get_effective_commission_rate(uuid, numeric) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_platform_commission_rate() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_top_products(integer) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_top_sellers(integer) FROM anon, PUBLIC;

-- get_vendor_dashboard has 2 overloaded variants
REVOKE EXECUTE ON FUNCTION public.get_vendor_dashboard(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_vendor_dashboard(uuid, timestamp with time zone) FROM anon, PUBLIC;

REVOKE EXECUTE ON FUNCTION public.get_vendor_dashboard_stats(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_vendor_seller_badge(uuid) FROM anon, PUBLIC;

-- ============================================================
-- 3. SET SENSITIVE STORAGE BUCKETS TO PRIVATE
-- ============================================================

UPDATE storage.buckets SET public = false WHERE id IN ('kyc-documents', 'delivery-proofs');

-- ============================================================
-- 4. FIX rls_auto_enable SEARCH_PATH
-- ============================================================

ALTER FUNCTION public.rls_auto_enable() SET search_path TO 'public';
