/*
  Production release: enable MonCash provider config + legal acceptance columns
*/

UPDATE public.payment_provider_configs
SET
  enabled = true,
  sandbox = true,
  supports_webhooks = true,
  webhook_path = '/functions/v1/payment-webhook?provider=moncash',
  updated_at = now()
WHERE provider = 'moncash';

-- Track legal acceptance on profiles / customers / vendors where present
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS privacy_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS terms_version text,
  ADD COLUMN IF NOT EXISTS privacy_version text;

ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS privacy_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS vendor_terms_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS terms_version text,
  ADD COLUMN IF NOT EXISTS privacy_version text,
  ADD COLUMN IF NOT EXISTS vendor_terms_version text;

INSERT INTO public.settings (key, value, label, description, updated_at)
VALUES
  ('legal_terms_version', '2026-07-30', 'Terms version', 'Version Tèm ak Kondisyon', now()),
  ('legal_privacy_version', '2026-07-30', 'Privacy version', 'Version Règleman sou Vi Prive', now()),
  ('legal_vendor_terms_version', '2026-07-30', 'Vendor terms version', 'Version Tèm Vandè', now()),
  ('moncash_mode', 'sandbox', 'MonCash mode', 'sandbox | live (Edge MONCASH_MODE wins)', now())
ON CONFLICT (key) DO NOTHING;
