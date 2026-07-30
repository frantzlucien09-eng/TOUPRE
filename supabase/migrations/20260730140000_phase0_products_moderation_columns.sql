/*
  Phase 0 baseline: align products moderation columns with AdminProductsPage.

  Admin approve/reject writes `products.status`. Ranking/analytics already use
  sold_count / view_count / search_count / first_sold_at / last_sold_at.
  Add missing moderation status safely (IF NOT EXISTS).
*/

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS search_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS view_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sold_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS first_sold_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_sold_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_products_status ON public.products (status);
CREATE INDEX IF NOT EXISTS idx_products_search_count ON public.products (search_count DESC);
CREATE INDEX IF NOT EXISTS idx_products_sold_count ON public.products (sold_count DESC);

-- Keep active flag in sync for rows that only had boolean active historically
UPDATE public.products
SET status = CASE
  WHEN active IS TRUE THEN 'active'
  ELSE 'draft'
END
WHERE status IS NULL OR status = '';
