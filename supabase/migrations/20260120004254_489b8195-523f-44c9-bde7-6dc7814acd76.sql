-- ============================================
-- STOCK VALIDATION + SELLER->PARTNER ALLOCATION
-- ============================================

-- Create new RPC for direct seller product allocation (no admin_inventory required)
CREATE OR REPLACE FUNCTION rpc_admin_allocate_seller_product_to_partner(
  p_partner_id uuid,
  p_product_id uuid,
  p_qty integer DEFAULT 1
) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_product_name text;
BEGIN
  -- Admin check
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN json_build_object('success', false, 'error', 'Admin access required');
  END IF;

  IF p_qty <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'Quantity must be positive');
  END IF;

  -- Verify product exists
  SELECT name INTO v_product_name FROM seller_products WHERE id = p_product_id;
  IF v_product_name IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Product not found');
  END IF;

  -- Upsert partner stock (direct allocation, no admin_inventory needed)
  INSERT INTO partner_stock (partner_id, product_id, qty_on_hand, last_updated_at)
  VALUES (p_partner_id, p_product_id, p_qty, now())
  ON CONFLICT (partner_id, product_id) 
  DO UPDATE SET qty_on_hand = partner_stock.qty_on_hand + p_qty, last_updated_at = now();

  -- Log movement
  INSERT INTO partner_stock_movements (partner_id, product_id, movement_type, qty_change, note)
  VALUES (p_partner_id, p_product_id, 'stock_added', p_qty, 'Allocated by admin from seller inventory');

  RETURN json_build_object('success', true, 'allocated', p_qty, 'product_name', v_product_name);
END;
$$;

-- Update rpc_mark_completed with stock validation and deduction
CREATE OR REPLACE FUNCTION rpc_mark_completed(
  p_order_id uuid,
  p_gross_collected numeric DEFAULT NULL
) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_partner_id uuid;
  v_order record;
  v_assignment record;
  v_commission_amount numeric;
  v_gross numeric;
  v_item record;
  v_stock_qty integer;
  v_missing_items text[];
  v_order_item record;
BEGIN
  v_partner_id := auth.uid();
  
  SELECT * INTO v_order FROM orders WHERE id = p_order_id;
  
  IF v_order IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Order not found');
  END IF;

  IF v_order.assigned_partner_id != v_partner_id THEN
    RETURN json_build_object('success', false, 'error', 'Order not assigned to you');
  END IF;

  IF v_order.order_status NOT IN ('ASSIGNED', 'ACCEPTED', 'ON_THE_WAY') AND 
     v_order.status NOT IN ('ASSIGNED', 'ACCEPTED', 'ON_THE_WAY', 'pending') THEN
    RETURN json_build_object('success', false, 'error', 'Order cannot be completed in current state');
  END IF;

  -- ========== STOCK VALIDATION ==========
  -- Check each order item against partner_stock via order_items table
  FOR v_order_item IN 
    SELECT oi.product_id, oi.product_name, oi.quantity
    FROM order_items oi
    WHERE oi.order_id = p_order_id AND oi.product_id IS NOT NULL
  LOOP
    SELECT COALESCE(ps.qty_on_hand, 0) INTO v_stock_qty
    FROM partner_stock ps
    WHERE ps.partner_id = v_partner_id AND ps.product_id = v_order_item.product_id;

    IF COALESCE(v_stock_qty, 0) < v_order_item.quantity THEN
      v_missing_items := array_append(v_missing_items, v_order_item.product_name);
    END IF;
  END LOOP;

  -- If order_items is empty, try to validate from line_items JSON (fallback)
  IF NOT EXISTS (SELECT 1 FROM order_items WHERE order_id = p_order_id AND product_id IS NOT NULL) THEN
    -- Skip stock validation for orders without product_id linkage
    -- These are likely legacy orders or orders created without product_id
    NULL;
  ELSIF array_length(v_missing_items, 1) > 0 THEN
    RETURN json_build_object(
      'success', false, 
      'error', 'No stock allocated for: ' || array_to_string(v_missing_items, ', ') || '. Ask admin to allocate stock first.'
    );
  END IF;

  -- ========== STOCK DEDUCTION ==========
  FOR v_order_item IN 
    SELECT oi.product_id, oi.product_name, oi.quantity
    FROM order_items oi
    WHERE oi.order_id = p_order_id AND oi.product_id IS NOT NULL
  LOOP
    -- Deduct from partner_stock
    UPDATE partner_stock 
    SET qty_on_hand = qty_on_hand - v_order_item.quantity, last_updated_at = now()
    WHERE partner_id = v_partner_id AND product_id = v_order_item.product_id;

    -- Log movement
    INSERT INTO partner_stock_movements 
      (partner_id, product_id, movement_type, qty_change, related_order_id, note)
    VALUES 
      (v_partner_id, v_order_item.product_id, 'sold_deducted', -v_order_item.quantity, p_order_id, 'Deducted on order completion');
  END LOOP;

  -- ========== COMMISSION CALCULATION ==========
  v_gross := COALESCE(p_gross_collected, v_order.total_price);

  SELECT * INTO v_assignment 
  FROM order_assignments 
  WHERE order_id = p_order_id 
    AND partner_id = v_partner_id 
    AND assignment_status IN ('pending', 'accepted')
  ORDER BY assigned_at DESC 
  LIMIT 1;

  IF v_assignment IS NOT NULL THEN
    IF v_assignment.commission_type = 'fixed' THEN
      v_commission_amount := v_assignment.commission_value;
    ELSE
      v_commission_amount := v_gross * (v_assignment.commission_value / 100);
    END IF;

    UPDATE order_assignments 
    SET commission_amount_calculated = v_commission_amount, assignment_status = 'accepted'
    WHERE id = v_assignment.id;
  ELSE
    v_commission_amount := COALESCE(v_order.partner_commission, 0);
  END IF;

  -- ========== UPDATE ORDER STATUS ==========
  UPDATE orders 
  SET 
    order_status = 'COMPLETED',
    status = 'COMPLETED',
    settlement_status = 'unsettled',
    completed_at = now(),
    partner_commission = v_commission_amount,
    partner_commission_status = 'locked',
    updated_at = now()
  WHERE id = p_order_id;

  -- ========== CREATE CASH LEDGER ==========
  INSERT INTO partner_cash_ledger (partner_id, order_id, gross_collected, commission_amount, net_owed_to_admin, ledger_status)
  VALUES (v_partner_id, p_order_id, v_gross, v_commission_amount, v_gross - v_commission_amount, 'unsettled')
  ON CONFLICT (order_id) DO UPDATE SET
    gross_collected = EXCLUDED.gross_collected,
    commission_amount = EXCLUDED.commission_amount,
    net_owed_to_admin = EXCLUDED.net_owed_to_admin;

  -- ========== LOG EVENT ==========
  INSERT INTO order_events (order_id, actor_user_id, event_type, event_payload)
  VALUES (
    p_order_id, 
    v_partner_id, 
    'completed', 
    json_build_object(
      'gross_collected', v_gross,
      'commission_amount', v_commission_amount,
      'stock_deducted', true
    )::jsonb
  );

  RETURN json_build_object(
    'success', true, 
    'gross_collected', v_gross,
    'commission_earned', v_commission_amount
  );
END;
$$;