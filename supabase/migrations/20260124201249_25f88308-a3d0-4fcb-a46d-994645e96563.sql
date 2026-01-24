-- Fix rpc_assign_order to properly calculate commission_amount_calculated
CREATE OR REPLACE FUNCTION public.rpc_assign_order(
  p_order_id uuid, 
  p_partner_id uuid, 
  p_commission_type text DEFAULT 'fixed'::text, 
  p_commission_value numeric DEFAULT 0
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_admin_id uuid;
  v_assignment_id uuid;
  v_order_total numeric;
  v_commission_calculated numeric;
BEGIN
  -- Get current user
  v_admin_id := auth.uid();
  
  -- Verify admin role
  IF NOT has_role(v_admin_id, 'admin'::app_role) THEN
    RETURN json_build_object('success', false, 'error', 'Admin access required');
  END IF;

  -- Get order total for percentage calculation
  SELECT total_price INTO v_order_total FROM orders WHERE id = p_order_id;
  
  IF v_order_total IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Order not found');
  END IF;

  -- Calculate commission amount
  IF p_commission_type = 'percentage' THEN
    v_commission_calculated := v_order_total * p_commission_value / 100;
  ELSE
    v_commission_calculated := p_commission_value;
  END IF;

  -- Mark any previous pending assignments as reassigned
  UPDATE order_assignments 
  SET assignment_status = 'reassigned'
  WHERE order_id = p_order_id AND assignment_status = 'pending';

  -- Create new assignment record with calculated commission
  INSERT INTO order_assignments (order_id, partner_id, assigned_by_admin_id, commission_type, commission_value, commission_amount_calculated)
  VALUES (p_order_id, p_partner_id, v_admin_id, p_commission_type, p_commission_value, v_commission_calculated)
  RETURNING id INTO v_assignment_id;

  -- Update order status
  UPDATE orders 
  SET 
    assigned_partner_id = p_partner_id,
    order_status = 'ASSIGNED',
    status = 'ASSIGNED',
    assigned_at = now(),
    partner_commission = v_commission_calculated,
    updated_at = now()
  WHERE id = p_order_id;

  -- Log event
  INSERT INTO order_events (order_id, actor_user_id, event_type, event_payload)
  VALUES (
    p_order_id, 
    v_admin_id, 
    'assigned',
    json_build_object(
      'partner_id', p_partner_id,
      'commission_type', p_commission_type,
      'commission_value', p_commission_value,
      'commission_calculated', v_commission_calculated,
      'assignment_id', v_assignment_id
    )::jsonb
  );

  RETURN json_build_object('success', true, 'assignment_id', v_assignment_id, 'commission_calculated', v_commission_calculated);
END;
$function$;

-- Fix rpc_mark_completed to properly get commission from assignment OR order
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
    IF v_order.status IS NULL OR v_order.status NOT IN ('ASSIGNED', 'ON_THE_WAY', 'ACCEPTED', 'pending') THEN
      RETURN json_build_object('success', false, 'error', 'Order must be assigned or on the way to mark as completed. Current status: ' || COALESCE(v_order.order_status, v_order.status, 'unknown'));
    END IF;
  END IF;
  
  -- Try to get partner ID and commission from assignment first
  SELECT oa.partner_id, COALESCE(oa.commission_amount_calculated, oa.commission_value, 0)
  INTO v_partner_id, v_commission_amount
  FROM order_assignments oa
  WHERE oa.order_id = p_order_id
  ORDER BY oa.assigned_at DESC
  LIMIT 1;
  
  -- Fallback: if no assignment found, use orders.assigned_partner_id and partner_commission
  IF v_partner_id IS NULL THEN
    v_partner_id := v_order.assigned_partner_id;
    v_commission_amount := COALESCE(v_order.partner_commission, 0);
    
    IF v_partner_id IS NULL THEN
      RETURN json_build_object('success', false, 'error', 'No partner assignment found for this order. Please ask admin to reassign.');
    END IF;
    
    -- Create the missing assignment record for data integrity
    INSERT INTO order_assignments (order_id, partner_id, assigned_by_admin_id, commission_type, commission_value, commission_amount_calculated, assignment_status)
    VALUES (p_order_id, v_partner_id, v_calling_user, 'fixed', v_commission_amount, v_commission_amount, 'pending')
    ON CONFLICT (order_id) DO NOTHING;
  ELSE
    -- Also check order's partner_commission as fallback if assignment value is 0
    IF v_commission_amount = 0 AND v_order.partner_commission IS NOT NULL AND v_order.partner_commission > 0 THEN
      v_commission_amount := v_order.partner_commission;
    END IF;
  END IF;
  
  -- Verify calling user is the assigned partner (or admin)
  IF v_calling_user != v_partner_id AND NOT has_role(v_calling_user, 'admin'::app_role) THEN
    RETURN json_build_object('success', false, 'error', 'You are not assigned to this order');
  END IF;
  
  -- Use provided gross or fall back to order total
  v_gross := COALESCE(p_gross_collected, v_order.total_price);
  
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
      UPDATE partner_stock
      SET qty_on_hand = qty_on_hand - v_item.quantity,
          last_updated_at = now()
      WHERE partner_id = v_partner_id AND product_id = v_item.product_id;
      
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
      responded_at = now(),
      commission_amount_calculated = v_commission_amount
  WHERE order_id = p_order_id AND partner_id = v_partner_id;
  
  -- ========== CREATE CASH LEDGER ==========
  INSERT INTO partner_cash_ledger (partner_id, order_id, gross_collected, commission_amount, ledger_status)
  VALUES (v_partner_id, p_order_id, v_gross, v_commission_amount, 'unsettled')
  ON CONFLICT (order_id) DO UPDATE SET
    gross_collected = EXCLUDED.gross_collected,
    commission_amount = EXCLUDED.commission_amount;
  
  -- ========== LOG EVENT ==========
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

-- Fix existing ledger entries for completed orders
UPDATE partner_cash_ledger pcl
SET commission_amount = COALESCE(
  (SELECT COALESCE(oa.commission_amount_calculated, oa.commission_value, o.partner_commission, 0)
   FROM orders o
   LEFT JOIN order_assignments oa ON oa.order_id = o.id
   WHERE o.id = pcl.order_id
   ORDER BY oa.assigned_at DESC
   LIMIT 1),
  0
)
WHERE pcl.commission_amount = 0;