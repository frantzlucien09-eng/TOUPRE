-- Add all columns the app code expects but don't exist in the normalized schema.
-- We add them as nullable/defaulted columns so existing data is preserved.

-- ============ products: add flat columns the app uses ============
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'manje',
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS photos text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS cover_index integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS video_url text,
  ADD COLUMN IF NOT EXISTS price_on_request boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS details jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS ad_status text,
  ADD COLUMN IF NOT EXISTS ad_paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS ad_expires_at timestamptz;

-- ============ orders: add columns the app uses ============
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_type text NOT NULL DEFAULT 'delivery',
  ADD COLUMN IF NOT EXISTS items jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS reject_reason text,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

-- ============ withdrawals: add columns the app uses ============
ALTER TABLE public.withdrawals
  ADD COLUMN IF NOT EXISTS requested_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS received_at timestamptz,
  ADD COLUMN IF NOT EXISTS note text;

-- Backfill requested_at from created_at for existing rows
UPDATE public.withdrawals SET requested_at = created_at WHERE requested_at IS NULL OR requested_at = created_at;

-- ============ messages: add app-expected columns (recipient_id, read) ============
-- App uses recipient_id and read (boolean); DB has receiver_id and read_at.
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS recipient_id uuid,
  ADD COLUMN IF NOT EXISTS sender_id uuid,
  ADD COLUMN IF NOT EXISTS read boolean NOT NULL DEFAULT false;

-- Backfill recipient_id from receiver_id, sender_id from sender_id
UPDATE public.messages SET recipient_id = receiver_id WHERE recipient_id IS NULL AND receiver_id IS NOT NULL;
UPDATE public.messages SET sender_id = sender_id WHERE sender_id IS NULL AND sender_id IS NOT NULL;
-- read = (read_at IS NOT NULL)
UPDATE public.messages SET read = true WHERE read_at IS NOT NULL;

-- ============ notifications: add read boolean (app uses `read`, DB has is_read) ============
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS read boolean NOT NULL DEFAULT false;
UPDATE public.notifications SET read = is_read WHERE is_read = true;

-- ============ customers: add address columns ============
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS department text,
  ADD COLUMN IF NOT EXISTS city text;
