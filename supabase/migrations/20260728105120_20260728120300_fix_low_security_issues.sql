/*
# Fix Low Security Issues — Phase 4

## Summary
Resolves Low-severity issues from the security audit:

1. **Missing indexes on foreign key columns (12 issues)**: 12 foreign key
   columns had no index, causing slow joins and sequential scans on admin
   review queries, conversation lookups, and trust history queries.

2. **Duplicate function grants (2 issues)**: Already resolved in Phase 2.

## Security Changes
- CREATE INDEX on 12 FK columns

## Important Notes
1. Indexing FK columns is a performance best practice — it speeds up joins
   and WHERE clause filters on those columns. It does not change query results.
2. These indexes use CONCURRENTLY-compatible naming (idx_ prefix) and are
   created with IF NOT EXISTS for idempotency.
*/

CREATE INDEX IF NOT EXISTS idx_ambassador_applications_reviewed_by ON public.ambassador_applications (reviewed_by);
CREATE INDEX IF NOT EXISTS idx_avatar_review_requests_vendor_id ON public.avatar_review_requests (vendor_id);
CREATE INDEX IF NOT EXISTS idx_client_disputes_client_id ON public.client_disputes (client_id);
CREATE INDEX IF NOT EXISTS idx_conversations_customer_id ON public.conversations (customer_id);
CREATE INDEX IF NOT EXISTS idx_conversations_vendor_id ON public.conversations (vendor_id);
CREATE INDEX IF NOT EXISTS idx_name_change_requests_vendor_id ON public.name_change_requests (vendor_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred_id ON public.referrals (referred_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer_id ON public.referrals (referrer_id);
CREATE INDEX IF NOT EXISTS idx_trust_events_admin_id ON public.trust_events (admin_id);
CREATE INDEX IF NOT EXISTS idx_trust_history_vendor_id ON public.trust_history (vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_actions_vendor_id ON public.vendor_actions (vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_applications_reviewed_by ON public.vendor_applications (reviewed_by);
