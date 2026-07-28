/*
# Add Performance Indexes for Analytics and Ranking Queries

## Overview
Adds indexes to optimize the analytics system for thousands of vendors and
hundreds of thousands of orders. All indexes use IF NOT EXISTS for idempotency.

## Indexes Added:
1. vendor_stats: composite index on (seller_badge, ranking) for badge+ranking queries
2. vendor_stats: index on ranking for leaderboard queries
3. vendor_stats: index on total_sales DESC for top-sellers queries
4. vendor_stats: index on vendor_revenue DESC for revenue ranking
5. orders: composite index on (vendor_id, status) for per-vendor status filtering
6. orders: composite index on (vendor_id, created_at DESC) for vendor time-series
7. orders: composite index on (status, created_at DESC) for admin status+time filtering
8. orders: composite index on (created_at, status) for daily/weekly/monthly reports
9. reviews: composite index on (vendor_id, deleted_at) for rating aggregation
10. seller_badge_thresholds: index on (is_active, sort_order) for badge evaluation
11. commission_config: index on (is_active, min_order_amount, sort_order) for rate lookup

## Important Notes
- All indexes are CREATE IF NOT EXISTS — safe to re-run.
- Composite indexes are ordered for the most common query patterns.
- DESC ordering on created_at and total_sales matches the sort direction of queries.
*/

CREATE INDEX IF NOT EXISTS idx_vendor_stats_badge_ranking
  ON public.vendor_stats (seller_badge, ranking);

CREATE INDEX IF NOT EXISTS idx_vendor_stats_ranking
  ON public.vendor_stats (ranking)
  WHERE ranking IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_vendor_stats_total_sales_desc
  ON public.vendor_stats (total_sales DESC);

CREATE INDEX IF NOT EXISTS idx_vendor_stats_vendor_revenue_desc
  ON public.vendor_stats (vendor_revenue DESC);

CREATE INDEX IF NOT EXISTS idx_orders_vendor_status
  ON public.orders (vendor_id, status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_orders_vendor_created
  ON public.orders (vendor_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_orders_status_created
  ON public.orders (status, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_orders_created_status
  ON public.orders (created_at, status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_reviews_vendor_deleted
  ON public.reviews (vendor_id, deleted_at);

CREATE INDEX IF NOT EXISTS idx_badge_thresholds_active_sort
  ON public.seller_badge_thresholds (is_active, sort_order);

CREATE INDEX IF NOT EXISTS idx_commission_config_active_lookup
  ON public.commission_config (is_active, min_order_amount, sort_order);
