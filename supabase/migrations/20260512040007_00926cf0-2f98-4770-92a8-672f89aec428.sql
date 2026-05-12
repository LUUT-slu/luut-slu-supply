
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS communication_status text NOT NULL DEFAULT 'pending_whatsapp';

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_communication_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_communication_status_check 
  CHECK (communication_status IN ('pending_whatsapp','whatsapp_opened','confirmed','no_response'));

CREATE INDEX IF NOT EXISTS idx_orders_communication_status ON public.orders(communication_status);

-- Mark POS-synced existing orders as confirmed
UPDATE public.orders SET communication_status = 'confirmed' 
WHERE shopify_pos_location_id IS NOT NULL OR source = 'pos';

-- Token-gated RPC for anon customers to mark whatsapp opened
CREATE OR REPLACE FUNCTION public.rpc_mark_whatsapp_opened(p_order_id uuid, p_token text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_match boolean;
BEGIN
  IF p_order_id IS NULL OR p_token IS NULL OR length(p_token) < 8 THEN
    RETURN json_build_object('success', false, 'error', 'Invalid input');
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.orders 
    WHERE id = p_order_id AND order_token = p_token
  ) INTO v_match;

  IF NOT v_match THEN
    RETURN json_build_object('success', false, 'error', 'Order not found');
  END IF;

  UPDATE public.orders 
  SET communication_status = 'whatsapp_opened', updated_at = now()
  WHERE id = p_order_id 
    AND communication_status = 'pending_whatsapp';

  RETURN json_build_object('success', true);
END;
$$;

-- RPC for admin/seller to manually update communication status
CREATE OR REPLACE FUNCTION public.rpc_set_communication_status(p_order_id uuid, p_status text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_uid uuid; v_allowed boolean;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  IF p_status NOT IN ('pending_whatsapp','whatsapp_opened','confirmed','no_response') THEN
    RETURN json_build_object('success', false, 'error', 'Invalid status');
  END IF;

  v_allowed := has_role(v_uid, 'admin'::app_role) OR is_seller_for_order(p_order_id);

  IF NOT v_allowed THEN
    RETURN json_build_object('success', false, 'error', 'Not authorized');
  END IF;

  UPDATE public.orders 
  SET communication_status = p_status, updated_at = now()
  WHERE id = p_order_id;

  RETURN json_build_object('success', true);
END;
$$;
