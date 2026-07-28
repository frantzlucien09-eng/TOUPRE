/*
# Phase 5: Performance Indexes

## Context
Add indexes for:
1. New wallet columns on vendor_stats
2. Product favorite_count for top products queries
3. Product_stats revenue for revenue ranking
4. Withdrawals status/vendor lookups
5. Favorites product_id lookup
6. Notifications user_id + created_at (for unread queries)
7. Order items JSON lookup (expression index not needed — items are in jsonb array)
8. Composite indexes for common dashboard query patterns
*/

-- vendor_stats wallet indexes
CREATE INDEX IF NOT EXISTS idx_vendor_stats_withdrawn_balance
  ON public.vendor_stats (withdrawn_balance DESC)
  WHERE withdrawn_balance > 0;

CREATE INDEX IF NOT EXISTS idx_vendor_stats_total_earnings
  ON public.vendor_stats (total_earnings DESC);

CREATE INDEX IF NOT EXISTS idx_vendor_stats_available_balance
  ON public.vendor_stats (available_balance DESC)
  WHERE available_balance > 0;

-- Products favorite_count for top products
CREATE INDEX IF NOT EXISTS idx_products_favorite_count
  ON public.products (favorite_count DESC)
  WHERE favorite_count > 0;

-- Product_stats revenue for revenue ranking
CREATE INDEX IF NOT EXISTS idx_product_stats_revenue
  ON public.product_stats (revenue DESC)
  WHERE revenue > 0;

CREATE INDEX IF NOT EXISTS idx_product_stats_sales_count
  ON public.product_stats (sales_count DESC)
  WHERE sales_count > 0;

-- Withdrawals: status + vendor lookups
CREATE INDEX IF NOT EXISTS idx_withdrawals_status
  ON public.withdrawals (status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_withdrawals_vendor_status
  ON public.withdrawals (vendor_id, status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_withdrawals_created
  ON public.withdrawals (created_at DESC)
  WHERE deleted_at IS NULL;

-- Favorites: product_id lookup
CREATE INDEX IF NOT EXISTS idx_favorites_product
  ON public.favorites (product_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_favorites_user
  ON public.favorites (user_id)
  WHERE deleted_at IS NULL;

-- Notifications: user_id + unread + created_at for fast unread queries
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON public.notifications (user_id, created_at DESC)
  WHERE is_read = false AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_user_type
  ON public.notifications (user_id, type)
  WHERE deleted_at IS NULL;

-- Orders: composite for vendor dashboard period queries
CREATE INDEX IF NOT EXISTS idx_orders_vendor_created_status_payment
  ON public.orders (vendor_id, created_at DESC, status, payment_status)
  WHERE deleted_at IS NULL;

-- Orders: customer_id + created_at for customer order history
CREATE INDEX IF NOT EXISTS idx_orders_customer_created
  ON public.orders (customer_id, created_at DESC)
  WHERE deleted_at IS NULL;

-- Order_status_history: order_id + created_at for timeline queries
CREATE INDEX IF NOT EXISTS idx_order_status_history_order_created
  ON public.order_status_history (order_id, created_at DESC);

-- Reviews: vendor_id + rating for fast rating aggregation
CREATE INDEX IF NOT EXISTS idx_reviews_vendor_rating
  ON public.reviews (vendor_id, rating)
  WHERE deleted_at IS NULL;

-- Automation error log: created_at for recent errors query
CREATE INDEX IF NOT EXISTS idx_automation_error_log_created_desc
  ON public.automation_error_log (created_at DESC);
