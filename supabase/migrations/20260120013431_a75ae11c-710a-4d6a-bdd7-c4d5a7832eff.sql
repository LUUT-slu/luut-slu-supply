-- Fix: Change event_type from 'COMPLETED' (uppercase) to 'completed' (lowercase)
-- to match the order_events_type_check constraint

CREATE OR REPLACE FUNCTION public.rpc_mark_completed(p_order_id uuid, p_gross_collected numeric DEFAULT NULL::numeric)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_order orders%ROWTYPE;
  v_partner_id uuid;
  v_calling_user uuid;
  v_commission_amount numeric;
  v_gross numeric;
  v_item record;
  v_stock_check record;
  v_insufficient_items text[] := '{}';
  v_has_order_items boolean := false;
BEGIN
  v_calling_user := auth.uid();
  
  -- Get the order
  SELECT * INTO v_order FROM orders WHERE id = p_order_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Order not found');
  END IF;
  
  -- Check order is in valid state for completion
  IF v_order.order_status IS NULL OR v_order.order_status NOT IN ('ASSIGNED', 'ON_THE_WAY', 'ACCEPTED') THEN
    -- Also check legacy status field
    IF v_order.status IS NULL OR v_order.status NOT IN ('ASSIGNED', 'ON_THE_WAY', 'ACCEPTED', 'pending') THEN
      RETURN json_build_object('success', false, 'error', 'Order must be assigned or on the way to mark as completed. Current status: ' || COALESCE(v_order.order_status, v_order.status, 'unknown'));
    END IF;
  END IF;
  
  -- Try to get partner ID from assignment first
  SELECT oa.partner_id, oa.commission_amount_calculated
  INTO v_partner_id, v_commission_amount
  FROM order_assignments oa
  WHERE oa.order_id = p_order_id
  ORDER BY oa.assigned_at DESC
  LIMIT 1;
  
  -- Fallback: if no assignment found, use orders.assigned_partner_id
  IF v_partner_id IS NULL THEN
    v_partner_id := v_order.assigned_partner_id;
    v_commission_amount := COALESCE(v_order.partner_commission, 0);
    
    -- Still no partner? Error out
    IF v_partner_id IS NULL THEN
      RETURN json_build_object('success', false, 'error', 'No partner assignment found for this order. Please ask admin to reassign.');
    END IF;
    
    -- Create the missing assignment record for data integrity
    INSERT INTO order_assignments (order_id, partner_id, assigned_by_admin_id, commission_type, commission_value, commission_amount_calculated, assignment_status)
    VALUES (p_order_id, v_partner_id, v_calling_user, 'fixed', v_commission_amount, v_commission_amount, 'pending')
    ON CONFLICT (order_id) DO NOTHING;
  END IF;
  
  -- Verify calling user is the assigned partner (or admin)
  IF v_calling_user != v_partner_id AND NOT has_role(v_calling_user, 'admin'::app_role) THEN
    RETURN json_build_object('success', false, 'error', 'You are not assigned to this order');
  END IF;
  
  -- Use provided gross or fall back to order total
  v_gross := COALESCE(p_gross_collected, v_order.total_price);
  
  -- Default commission if not calculated
  v_commission_amount := COALESCE(v_commission_amount, 0);
  
  -- ========== CHECK IF ORDER HAS ORDER_ITEMS ==========
  SELECT EXISTS(SELECT 1 FROM order_items WHERE order_id = p_order_id AND product_id IS NOT NULL)
  INTO v_has_order_items;
  
  -- ========== STOCK VALIDATION (only if order_items exist) ==========
  IF v_has_order_items THEN
    FOR v_item IN 
      SELECT oi.product_id, oi.quantity, oi.product_name
      FROM order_items oi
      WHERE oi.order_id = p_order_id AND oi.product_id IS NOT NULL
    LOOP
      SELECT ps.qty_on_hand INTO v_stock_check
      FROM partner_stock ps
      WHERE ps.partner_id = v_partner_id AND ps.product_id = v_item.product_id;
      
      IF NOT FOUND OR v_stock_check.qty_on_hand < v_item.quantity THEN
        v_insufficient_items := array_append(v_insufficient_items, v_item.product_name || ' (need ' || v_item.quantity || ')');
      END IF;
    END LOOP;
    
    IF array_length(v_insufficient_items, 1) > 0 THEN
      RETURN json_build_object(
        'success', false, 
        'error', 'NO STOCK ALLOCATED: ' || array_to_string(v_insufficient_items, ', ') || '. Contact admin to allocate stock.',
        'insufficient_items', v_insufficient_items,
        'need_stock', true
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
      VALUES (v_partner_id, v_item.product_id, -v_item.quantity, 'sold_deducted', p_order_id, 'Auto-deducted on order completion');
    END LOOP;
  END IF;
  
  -- ========== UPDATE ORDER STATUS ==========
  UPDATE orders
  SET order_status = 'COMPLETED',
      status = 'completed',
      completed_at = now(),
      settlement_status = 'unsettled',
      updated_at = now()
  WHERE id = p_order_id;
  
  -- ========== UPDATE ASSIGNMENT ==========
  UPDATE order_assignments
  SET assignment_status = 'completed',
      responded_at = now()
  WHERE order_id = p_order_id AND partner_id = v_partner_id;
  
  -- ========== CREATE CASH LEDGER (net_owed_to_admin is GENERATED ALWAYS) ==========
  INSERT INTO partner_cash_ledger (partner_id, order_id, gross_collected, commission_amount, ledger_status)
  VALUES (v_partner_id, p_order_id, v_gross, v_commission_amount, 'unsettled')
  ON CONFLICT (order_id) DO UPDATE SET
    gross_collected = EXCLUDED.gross_collected,
    commission_amount = EXCLUDED.commission_amount;
  
  -- ========== LOG EVENT (FIXED: use lowercase 'completed') ==========
  INSERT INTO order_events (order_id, event_type, actor_user_id, event_payload)
  VALUES (p_order_id, 'completed', v_calling_user, json_build_object(
    'gross_collected', v_gross,
    'commission_earned', v_commission_amount,
    'partner_id', v_partner_id,
    'stock_deducted', v_has_order_items
  ));
  
  RETURN json_build_object(
    'success', true,
    'message', 'Order marked as completed',
    'gross_collected', v_gross,
    'commission_earned', v_commission_amount
  );
END;
$function$;