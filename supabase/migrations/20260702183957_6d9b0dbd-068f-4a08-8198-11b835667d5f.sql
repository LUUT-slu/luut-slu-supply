
-- Track the Shopify-side discount that backs each loyalty reward
ALTER TABLE public.customer_discounts
  ADD COLUMN IF NOT EXISTS shopify_code text,
  ADD COLUMN IF NOT EXISTS shopify_price_rule_id bigint;

-- Idempotency: one welcome/regular/vip per customer
DROP INDEX IF EXISTS public.idx_customer_discounts_welcome;
CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_discounts_type_unique
  ON public.customer_discounts (user_id, discount_type)
  WHERE discount_type IN ('welcome','regular','vip','referral_referrer','referral_referred');

-- RPC: authenticated customer applies a referral code once
CREATE OR REPLACE FUNCTION public.rpc_apply_referral_code(p_code text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_ref record;
BEGIN
  IF v_uid IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  IF p_code IS NULL OR length(trim(p_code)) = 0 THEN
    RETURN json_build_object('success', false, 'error', 'Missing code');
  END IF;

  SELECT * INTO v_ref FROM public.customer_referrals
    WHERE referral_code = upper(trim(p_code));
  IF v_ref IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Invalid referral code');
  END IF;
  IF v_ref.referrer_user_id = v_uid THEN
    RETURN json_build_object('success', false, 'error', 'Cannot use your own code');
  END IF;
  -- Do nothing if this user already redeemed any referral
  IF EXISTS (SELECT 1 FROM public.customer_referrals WHERE referred_user_id = v_uid) THEN
    RETURN json_build_object('success', false, 'error', 'Referral already applied');
  END IF;
  IF v_ref.referred_user_id IS NOT NULL AND v_ref.referred_user_id <> v_uid THEN
    RETURN json_build_object('success', false, 'error', 'Code already claimed');
  END IF;

  UPDATE public.customer_referrals
    SET referred_user_id = v_uid,
        status = 'applied'
    WHERE id = v_ref.id;

  RETURN json_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_apply_referral_code(text) TO authenticated;
