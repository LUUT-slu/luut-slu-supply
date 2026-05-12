-- Add draft order tracking columns to orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS shopify_draft_order_id text,
  ADD COLUMN IF NOT EXISTS shopify_draft_order_name text,
  ADD COLUMN IF NOT EXISTS shopify_draft_order_invoice_url text,
  ADD COLUMN IF NOT EXISTS shopify_sync_status text NOT NULL DEFAULT 'not_synced',
  ADD COLUMN IF NOT EXISTS shopify_sync_error text,
  ADD COLUMN IF NOT EXISTS order_source text NOT NULL DEFAULT 'customer_checkout',
  ADD COLUMN IF NOT EXISTS created_by_seller_id uuid;

CREATE INDEX IF NOT EXISTS idx_orders_shopify_draft_order_id ON public.orders(shopify_draft_order_id);
CREATE INDEX IF NOT EXISTS idx_orders_order_source ON public.orders(order_source);
CREATE INDEX IF NOT EXISTS idx_orders_created_by_seller_id ON public.orders(created_by_seller_id);

-- Mark order confirmed (admin or seller-of-order)
CREATE OR REPLACE FUNCTION public.rpc_mark_order_confirmed(p_order_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  IF NOT (has_role(v_uid, 'admin'::app_role) OR is_seller_for_order(p_order_id)
          OR EXISTS (SELECT 1 FROM orders WHERE id = p_order_id AND created_by_seller_id IN
              (SELECT id FROM seller_profiles WHERE user_id = v_uid))) THEN
    RETURN json_build_object('success', false, 'error', 'Not authorized');
  END IF;

  UPDATE orders
  SET communication_status = 'whatsapp_confirmed',
      order_status = COALESCE(NULLIF(order_status,'NEW'), 'CONFIRMED'),
      status = COALESCE(NULLIF(status,'pending'), 'CONFIRMED'),
      updated_at = now()
  WHERE id = p_order_id;

  INSERT INTO order_events (order_id, actor_user_id, event_type, event_payload)
  VALUES (p_order_id, v_uid, 'whatsapp_confirmed', '{}'::jsonb);

  RETURN json_build_object('success', true);
END $$;

-- Mark no response (admin or seller)
CREATE OR REPLACE FUNCTION public.rpc_mark_no_response(p_order_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  IF NOT (has_role(v_uid, 'admin'::app_role) OR is_seller_for_order(p_order_id)
          OR EXISTS (SELECT 1 FROM orders WHERE id = p_order_id AND created_by_seller_id IN
              (SELECT id FROM seller_profiles WHERE user_id = v_uid))) THEN
    RETURN json_build_object('success', false, 'error', 'Not authorized');
  END IF;

  UPDATE orders
  SET communication_status = 'no_response',
      updated_at = now()
  WHERE id = p_order_id;

  INSERT INTO order_events (order_id, actor_user_id, event_type, event_payload)
  VALUES (p_order_id, v_uid, 'no_response', '{}'::jsonb);

  RETURN json_build_object('success', true);
END $$;

-- Cancel order (admin only)
CREATE OR REPLACE FUNCTION public.rpc_cancel_order(p_order_id uuid, p_reason text DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF NOT has_role(v_uid, 'admin'::app_role) THEN
    RETURN json_build_object('success', false, 'error', 'Admin access required');
  END IF;

  UPDATE orders
  SET order_status = 'CANCELLED',
      status = 'CANCELLED',
      cancelled_at = now(),
      updated_at = now()
  WHERE id = p_order_id;

  INSERT INTO order_events (order_id, actor_user_id, event_type, event_payload)
  VALUES (p_order_id, v_uid, 'cancelled', jsonb_build_object('reason', p_reason));

  RETURN json_build_object('success', true);
END $$;