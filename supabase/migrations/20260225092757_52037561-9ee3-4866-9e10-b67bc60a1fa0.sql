
-- Table to track customer discounts
CREATE TABLE public.customer_discounts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  discount_type text NOT NULL DEFAULT 'welcome',
  discount_amount numeric NOT NULL DEFAULT 5.00,
  currency_code text NOT NULL DEFAULT 'XCD',
  is_used boolean NOT NULL DEFAULT false,
  used_at timestamp with time zone,
  used_on_order_id uuid REFERENCES public.orders(id),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Unique constraint: one welcome discount per user
CREATE UNIQUE INDEX idx_customer_discounts_welcome ON public.customer_discounts (user_id, discount_type) WHERE discount_type = 'welcome';

-- Enable RLS
ALTER TABLE public.customer_discounts ENABLE ROW LEVEL SECURITY;

-- Users can view their own discounts
CREATE POLICY "Users can view own discounts"
  ON public.customer_discounts FOR SELECT
  USING (auth.uid() = user_id);

-- Service role / edge functions can insert
CREATE POLICY "Anyone can insert discounts"
  ON public.customer_discounts FOR INSERT
  WITH CHECK (true);

-- Service role / edge functions can update (mark as used)
CREATE POLICY "Users can update own discounts"
  ON public.customer_discounts FOR UPDATE
  USING (auth.uid() = user_id);

-- Admins full access
CREATE POLICY "Admins can manage all discounts"
  ON public.customer_discounts FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Auto-grant welcome discount on new customer signup
CREATE OR REPLACE FUNCTION public.grant_welcome_discount()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.customer_discounts (user_id, discount_type, discount_amount, currency_code)
  VALUES (NEW.id, 'welcome', 5.00, 'XCD')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

-- Trigger on auth.users creation (fires after handle_new_customer)
CREATE TRIGGER on_auth_user_created_grant_discount
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.grant_welcome_discount();
