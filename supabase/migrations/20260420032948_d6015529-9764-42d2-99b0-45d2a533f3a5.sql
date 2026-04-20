-- Promotion campaigns table
CREATE TABLE public.promotion_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  promo_label text NOT NULL DEFAULT 'Sale',
  description text,
  start_date timestamptz,
  end_date timestamptz,
  is_active boolean NOT NULL DEFAULT false,
  discount_type text NOT NULL DEFAULT 'none' CHECK (discount_type IN ('percent','fixed','override','none')),
  discount_value numeric NOT NULL DEFAULT 0,
  product_refs jsonb NOT NULL DEFAULT '[]'::jsonb,
  visibility jsonb NOT NULL DEFAULT '{"posters":true,"productPages":false,"homepage":false,"collections":false}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_promo_campaigns_active ON public.promotion_campaigns (is_active, start_date, end_date);

ALTER TABLE public.promotion_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage promotion campaigns"
ON public.promotion_campaigns FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Public can view active visible promotions"
ON public.promotion_campaigns FOR SELECT
USING (
  is_active = true
  AND (start_date IS NULL OR start_date <= now())
  AND (end_date IS NULL OR end_date >= now())
);

CREATE TRIGGER trg_promotion_campaigns_updated_at
BEFORE UPDATE ON public.promotion_campaigns
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();