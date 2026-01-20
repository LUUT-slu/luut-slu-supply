
-- PHASE 2: Backfill missing order_assignments for orders with assigned_partner_id
-- This ensures rpc_mark_completed can find the assignment record

-- Backfill any orders that have assigned_partner_id but no order_assignments row
INSERT INTO order_assignments (
  order_id,
  partner_id,
  assigned_by_admin_id,
  commission_type,
  commission_value,
  commission_amount_calculated,
  assignment_status,
  assigned_at
)
SELECT 
  o.id as order_id,
  o.assigned_partner_id as partner_id,
  -- Use the first admin we can find, or fallback to the partner themselves
  COALESCE(
    (SELECT ur.user_id FROM user_roles ur WHERE ur.role = 'admin' LIMIT 1),
    o.assigned_partner_id
  ) as assigned_by_admin_id,
  'fixed' as commission_type,
  COALESCE(o.partner_commission, 0) as commission_value,
  COALESCE(o.partner_commission, 0) as commission_amount_calculated,
  CASE 
    WHEN o.order_status = 'COMPLETED' OR o.status = 'completed' THEN 'completed'
    WHEN o.order_status = 'NO_SALE' OR o.status = 'NO_SALE' THEN 'completed'
    ELSE 'pending'
  END as assignment_status,
  COALESCE(o.assigned_at, o.updated_at, now()) as assigned_at
FROM orders o
WHERE o.assigned_partner_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM order_assignments oa WHERE oa.order_id = o.id
  );

-- Update rpc_mark_completed to be more robust:
-- 1) First try to find assignment by order_id
-- 2) If not found but order has assigned_partner_id, use that (with logging)
-- 3) Ensure caller is the assigned partner
CREATE OR REPLACE FUNCTION public.rpc_mark_completed(p_order_id uuid, p_gross_collected numeric DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  
  -- ========== LOG EVENT ==========
  INSERT INTO order_events (order_id, event_type, actor_user_id, event_payload)
  VALUES (p_order_id, 'COMPLETED', v_calling_user, json_build_object(
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
$$;

-- Also update rpc_mark_no_sale to use similar fallback logic
CREATE OR REPLACE FUNCTION public.rpc_mark_no_sale(p_order_id uuid, p_note text DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_partner_id uuid;
  v_calling_user uuid;
  v_order record;
BEGIN
  v_calling_user := auth.uid();
  
  -- Get order details
  SELECT * INTO v_order FROM orders WHERE id = p_order_id;
  
  IF v_order IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Order not found');
  END IF;

  -- Get partner from assignment or order
  SELECT oa.partner_id INTO v_partner_id
  FROM order_assignments oa
  WHERE oa.order_id = p_order_id
  ORDER BY oa.assigned_at DESC
  LIMIT 1;
  
  -- Fallback to order.assigned_partner_id
  IF v_partner_id IS NULL THEN
    v_partner_id := v_order.assigned_partner_id;
  END IF;

  -- Verify caller is assigned partner or admin
  IF v_calling_user != v_partner_id AND NOT has_role(v_calling_user, 'admin'::app_role) THEN
    RETURN json_build_object('success', false, 'error', 'Order not assigned to you');
  END IF;

  -- Update order status - NO stock deduction, NO ledger creation
  UPDATE orders 
  SET 
    order_status = 'NO_SHOW',
    status = 'NO_SHOW',
    no_sale_at = now(),
    note = CASE 
      WHEN p_note IS NOT NULL THEN COALESCE(note || E'\n---\n', '') || 'No Show: ' || p_note
      ELSE note
    END,
    updated_at = now()
  WHERE id = p_order_id;

  -- Update assignment
  UPDATE order_assignments
  SET assignment_status = 'completed',
      responded_at = now()
  WHERE order_id = p_order_id AND partner_id = v_partner_id;

  -- Log event
  INSERT INTO order_events (order_id, actor_user_id, event_type, event_payload)
  VALUES (
    p_order_id, 
    v_calling_user, 
    'no_show', 
    json_build_object('note', p_note)::jsonb
  );

  RETURN json_build_object('success', true);
END;
$$;

-- Create unique constraint on order_assignments.order_id to support ON CONFLICT
-- (Only if not already exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'order_assignments_order_id_key' 
    AND conrelid = 'order_assignments'::regclass
  ) THEN
    ALTER TABLE order_assignments ADD CONSTRAINT order_assignments_order_id_key UNIQUE (order_id);
  END IF;
EXCEPTION WHEN duplicate_object THEN
  -- Constraint already exists, ignore
  NULL;
END $$;
