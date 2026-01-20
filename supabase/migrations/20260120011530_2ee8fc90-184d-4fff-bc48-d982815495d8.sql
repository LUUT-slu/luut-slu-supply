-- Fix rpc_mark_completed: Remove net_owed_to_admin from INSERT (it's a GENERATED ALWAYS column)
CREATE OR REPLACE FUNCTION public.rpc_mark_completed(p_order_id uuid, p_gross_collected numeric DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order orders%ROWTYPE;
  v_partner_id uuid;
  v_commission_amount numeric;
  v_gross numeric;
  v_item record;
  v_stock_check record;
  v_insufficient_items text[] := '{}';
BEGIN
  -- Get the order
  SELECT * INTO v_order FROM orders WHERE id = p_order_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Order not found');
  END IF;
  
  -- Check order is in valid state for completion
  IF v_order.order_status NOT IN ('ASSIGNED', 'ON_THE_WAY', 'ACCEPTED') THEN
    RETURN json_build_object('success', false, 'error', 'Order must be assigned or on the way to mark as completed');
  END IF;
  
  -- Get the partner ID from assignment
  SELECT oa.partner_id, oa.commission_amount_calculated
  INTO v_partner_id, v_commission_amount
  FROM order_assignments oa
  WHERE oa.order_id = p_order_id
  ORDER BY oa.assigned_at DESC
  LIMIT 1;
  
  IF v_partner_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'No partner assignment found for this order');
  END IF;
  
  -- Use provided gross or fall back to order total
  v_gross := COALESCE(p_gross_collected, v_order.total_price);
  
  -- Default commission if not calculated
  v_commission_amount := COALESCE(v_commission_amount, 0);
  
  -- ========== STOCK VALIDATION ==========
  -- Check partner has sufficient stock for all items
  FOR v_item IN 
    SELECT oi.product_id, oi.quantity, oi.product_name
    FROM order_items oi
    WHERE oi.order_id = p_order_id AND oi.product_id IS NOT NULL
  LOOP
    SELECT ps.qty_on_hand INTO v_stock_check
    FROM partner_stock ps
    WHERE ps.partner_id = v_partner_id AND ps.product_id = v_item.product_id;
    
    IF NOT FOUND OR v_stock_check.qty_on_hand < v_item.quantity THEN
      v_insufficient_items := array_append(v_insufficient_items, v_item.product_name);
    END IF;
  END LOOP;
  
  IF array_length(v_insufficient_items, 1) > 0 THEN
    RETURN json_build_object(
      'success', false, 
      'error', 'NO STOCK ALLOCATED: ' || array_to_string(v_insufficient_items, ', ') || '. Contact admin to allocate stock before completing.',
      'insufficient_items', v_insufficient_items
    );
  END IF;
  
  -- ========== STOCK DEDUCTION ==========
  FOR v_item IN 
    SELECT oi.product_id, oi.quantity
    FROM order_items oi
    WHERE oi.order_id = p_order_id AND oi.product_id IS NOT NULL
  LOOP
    -- Deduct from partner_stock
    UPDATE partner_stock
    SET qty_on_hand = qty_on_hand - v_item.quantity,
        last_updated_at = now()
    WHERE partner_id = v_partner_id AND product_id = v_item.product_id;
    
    -- Log the movement
    INSERT INTO partner_stock_movements (partner_id, product_id, qty_change, movement_type, related_order_id, note)
    VALUES (v_partner_id, v_item.product_id, -v_item.quantity, 'sale', p_order_id, 'Auto-deducted on order completion');
  END LOOP;
  
  -- ========== UPDATE ORDER STATUS ==========
  UPDATE orders
  SET order_status = 'COMPLETED',
      status = 'completed',
      completed_at = now(),
      updated_at = now()
  WHERE id = p_order_id;
  
  -- ========== UPDATE ASSIGNMENT ==========
  UPDATE order_assignments
  SET assignment_status = 'completed'
  WHERE order_id = p_order_id AND partner_id = v_partner_id;
  
  -- ========== CREATE CASH LEDGER (FIXED: removed net_owed_to_admin - it's GENERATED ALWAYS) ==========
  INSERT INTO partner_cash_ledger (partner_id, order_id, gross_collected, commission_amount, ledger_status)
  VALUES (v_partner_id, p_order_id, v_gross, v_commission_amount, 'unsettled')
  ON CONFLICT (order_id) DO UPDATE SET
    gross_collected = EXCLUDED.gross_collected,
    commission_amount = EXCLUDED.commission_amount;
  
  -- ========== LOG EVENT ==========
  INSERT INTO order_events (order_id, event_type, actor_user_id, event_payload)
  VALUES (p_order_id, 'COMPLETED', auth.uid(), json_build_object(
    'gross_collected', v_gross,
    'commission_earned', v_commission_amount,
    'partner_id', v_partner_id
  ));
  
  RETURN json_build_object(
    'success', true,
    'message', 'Order marked as completed',
    'gross_collected', v_gross,
    'commission_earned', v_commission_amount
  );
END;
$$;