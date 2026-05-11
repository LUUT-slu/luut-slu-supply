-- Add Shopify sync fields to orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'website',
  ADD COLUMN IF NOT EXISTS shopify_order_id text,
  ADD COLUMN IF NOT EXISTS shopify_order_name text,
  ADD COLUMN IF NOT EXISTS shopify_channel text,
  ADD COLUMN IF NOT EXISTS shopify_pos_location_id text,
  ADD COLUMN IF NOT EXISTS shopify_pos_location_name text,
  ADD COLUMN IF NOT EXISTS shopify_financial_status text,
  ADD COLUMN IF NOT EXISTS shopify_fulfillment_status text,
  ADD COLUMN IF NOT EXISTS shopify_total_discounts numeric,
  ADD COLUMN IF NOT EXISTS shopify_synced_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS orders_shopify_order_id_uniq
  ON public.orders (shopify_order_id) WHERE shopify_order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS orders_source_idx ON public.orders (source);

-- Backfill existing rows so source is always meaningful
UPDATE public.orders SET source = 'website' WHERE source IS NULL;

-- Per-line Shopify reference
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS shopify_line_id text,
  ADD COLUMN IF NOT EXISTS shopify_variant_id text,
  ADD COLUMN IF NOT EXISTS shopify_product_id text;
CREATE UNIQUE INDEX IF NOT EXISTS order_items_shopify_line_uniq
  ON public.order_items (order_id, shopify_line_id) WHERE shopify_line_id IS NOT NULL;

-- Sync state singleton
CREATE TABLE IF NOT EXISTS public.shopify_sync_state (
  id text PRIMARY KEY,
  last_synced_at timestamptz,
  last_cursor text,
  last_status text,
  last_error text,
  last_run_count integer DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.shopify_sync_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage shopify_sync_state" ON public.shopify_sync_state;
CREATE POLICY "Admins manage shopify_sync_state"
  ON public.shopify_sync_state
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.shopify_sync_state (id) VALUES ('orders')
  ON CONFLICT (id) DO NOTHING;