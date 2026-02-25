
-- Fix search_path on grant_welcome_discount (already set, but let's ensure)
-- Tighten INSERT policy: only allow inserting for own user_id
DROP POLICY IF EXISTS "Anyone can insert discounts" ON public.customer_discounts;

CREATE POLICY "Users can insert own discounts"
  ON public.customer_discounts FOR INSERT
  WITH CHECK (auth.uid() = user_id);
