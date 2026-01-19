-- =============================================================
-- V1 PARTNER OPERATIONS MIGRATION
-- =============================================================
-- This migration adds:
-- 1. Lifecycle columns to orders table
-- 2. order_events table for audit trail
-- 3. order_assignments table for tracking partner assignments with commission
-- 4. partner_cash_ledger for tracking cash collected
-- 5. partner_settlements for admin settlement records
-- 6. partner_stock for partner inventory
-- 7. partner_stock_movements for stock change audit trail
-- 8. RPC functions for safe operations
-- 9. RLS policies for all new tables

-- =============================================================
-- PHASE 1: ALTER ORDERS TABLE
-- =============================================================

-- Add order lifecycle columns
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS order_status text DEFAULT 'NEW',
ADD COLUMN IF NOT EXISTS settlement_status text DEFAULT 'unsettled',
ADD COLUMN IF NOT EXISTS assigned_at timestamptz,
ADD COLUMN IF NOT EXISTS accepted_at timestamptz,
ADD COLUMN IF NOT EXISTS completed_at timestamptz,
ADD COLUMN IF NOT EXISTS no_sale_at timestamptz;

-- Migrate existing status values to order_status if needed
UPDATE orders 
SET order_status = UPPER(status) 
WHERE order_status IS NULL OR order_status = 'NEW';

-- Add constraints (drop first if exists)
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_order_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_order_status_check 
  CHECK (order_status IN ('NEW', 'ASSIGNED', 'ACCEPTED', 'ON_THE_WAY', 'COMPLETED', 'CANCELLED', 'NO_SALE', 'DECLINED'));

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_settlement_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_settlement_status_check 
  CHECK (settlement_status IN ('unsettled', 'settled'));

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_orders_order_status ON orders(order_status);
CREATE INDEX IF NOT EXISTS idx_orders_settlement_status ON orders(settlement_status);
CREATE INDEX IF NOT EXISTS idx_orders_assigned_partner_id ON orders(assigned_partner_id);

-- =============================================================
-- PHASE 2: CREATE ORDER_EVENTS TABLE (Audit Trail)
-- =============================================================

CREATE TABLE IF NOT EXISTS order_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES orders(id) ON DELETE CASCADE,
  actor_user_id uuid NOT NULL,
  event_type text NOT NULL,
  event_payload jsonb,
  created_at timestamptz DEFAULT now()
);

-- Add constraint for event types
ALTER TABLE order_events DROP CONSTRAINT IF EXISTS order_events_type_check;
ALTER TABLE order_events ADD CONSTRAINT order_events_type_check 
  CHECK (event_type IN ('created', 'assigned', 'accepted', 'declined', 'on_the_way', 'completed', 'undo_completed', 'cancelled', 'no_sale', 'settled', 'reassigned', 'stock_added', 'stock_removed'));

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_order_events_order_id ON order_events(order_id);
CREATE INDEX IF NOT EXISTS idx_order_events_created_at ON order_events(created_at);

-- Enable RLS
ALTER TABLE order_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies for order_events
DROP POLICY IF EXISTS "Admins can do all on order_events" ON order_events;
CREATE POLICY "Admins can do all on order_events" ON order_events
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Partners can view events for assigned orders" ON order_events;
CREATE POLICY "Partners can view events for assigned orders" ON order_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_events.order_id
      AND o.assigned_partner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "System can insert order_events" ON order_events;
CREATE POLICY "System can insert order_events" ON order_events
  FOR INSERT WITH CHECK (auth.uid() = actor_user_id);

-- =============================================================
-- PHASE 3: CREATE ORDER_ASSIGNMENTS TABLE
-- =============================================================

CREATE TABLE IF NOT EXISTS order_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES orders(id) ON DELETE CASCADE,
  partner_id uuid NOT NULL,
  assigned_by_admin_id uuid NOT NULL,
  commission_type text DEFAULT 'fixed',
  commission_value numeric NOT NULL DEFAULT 0,
  commission_amount_calculated numeric,
  assignment_status text DEFAULT 'pending',
  assigned_at timestamptz DEFAULT now(),
  responded_at timestamptz,
  UNIQUE(order_id, partner_id, assigned_at)
);

-- Add constraints
ALTER TABLE order_assignments DROP CONSTRAINT IF EXISTS order_assignments_type_check;
ALTER TABLE order_assignments ADD CONSTRAINT order_assignments_type_check 
  CHECK (commission_type IN ('fixed', 'percent'));

ALTER TABLE order_assignments DROP CONSTRAINT IF EXISTS order_assignments_status_check;
ALTER TABLE order_assignments ADD CONSTRAINT order_assignments_status_check 
  CHECK (assignment_status IN ('pending', 'accepted', 'declined', 'reassigned'));

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_order_assignments_partner_id ON order_assignments(partner_id);
CREATE INDEX IF NOT EXISTS idx_order_assignments_order_id ON order_assignments(order_id);
CREATE INDEX IF NOT EXISTS idx_order_assignments_status ON order_assignments(assignment_status);

-- Enable RLS
ALTER TABLE order_assignments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for order_assignments
DROP POLICY IF EXISTS "Admins can do all on order_assignments" ON order_assignments;
CREATE POLICY "Admins can do all on order_assignments" ON order_assignments
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Partners can view own assignments" ON order_assignments;
CREATE POLICY "Partners can view own assignments" ON order_assignments
  FOR SELECT USING (partner_id = auth.uid());

DROP POLICY IF EXISTS "Partners can update own assignment status" ON order_assignments;
CREATE POLICY "Partners can update own assignment status" ON order_assignments
  FOR UPDATE USING (partner_id = auth.uid())
  WITH CHECK (partner_id = auth.uid());

-- =============================================================
-- PHASE 4: CREATE PARTNER_CASH_LEDGER TABLE
-- =============================================================

CREATE TABLE IF NOT EXISTS partner_cash_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL,
  order_id uuid REFERENCES orders(id) ON DELETE CASCADE,
  gross_collected numeric NOT NULL DEFAULT 0,
  commission_amount numeric NOT NULL DEFAULT 0,
  net_owed_to_admin numeric GENERATED ALWAYS AS (gross_collected - commission_amount) STORED,
  ledger_status text DEFAULT 'unsettled',
  created_at timestamptz DEFAULT now(),
  UNIQUE(order_id)
);

-- Add constraint
ALTER TABLE partner_cash_ledger DROP CONSTRAINT IF EXISTS partner_cash_ledger_status_check;
ALTER TABLE partner_cash_ledger ADD CONSTRAINT partner_cash_ledger_status_check 
  CHECK (ledger_status IN ('unsettled', 'settled'));

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_partner_cash_ledger_partner_id ON partner_cash_ledger(partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_cash_ledger_status ON partner_cash_ledger(ledger_status);
CREATE INDEX IF NOT EXISTS idx_partner_cash_ledger_order_id ON partner_cash_ledger(order_id);

-- Enable RLS
ALTER TABLE partner_cash_ledger ENABLE ROW LEVEL SECURITY;

-- RLS Policies for partner_cash_ledger
DROP POLICY IF EXISTS "Admins can do all on partner_cash_ledger" ON partner_cash_ledger;
CREATE POLICY "Admins can do all on partner_cash_ledger" ON partner_cash_ledger
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Partners can only see their own ledger entries (but not the per-order net_owed, handled in UI)
DROP POLICY IF EXISTS "Partners can view own ledger" ON partner_cash_ledger;
CREATE POLICY "Partners can view own ledger" ON partner_cash_ledger
  FOR SELECT USING (partner_id = auth.uid());

-- =============================================================
-- PHASE 5: CREATE PARTNER_SETTLEMENTS TABLE
-- =============================================================

CREATE TABLE IF NOT EXISTS partner_settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL,
  settled_by_admin_id uuid NOT NULL,
  settlement_amount numeric NOT NULL,
  settlement_note text,
  settled_at timestamptz DEFAULT now()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_partner_settlements_partner_id ON partner_settlements(partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_settlements_settled_at ON partner_settlements(settled_at);

-- Enable RLS
ALTER TABLE partner_settlements ENABLE ROW LEVEL SECURITY;

-- RLS Policies for partner_settlements
DROP POLICY IF EXISTS "Admins can do all on partner_settlements" ON partner_settlements;
CREATE POLICY "Admins can do all on partner_settlements" ON partner_settlements
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Partners can view own settlements" ON partner_settlements;
CREATE POLICY "Partners can view own settlements" ON partner_settlements
  FOR SELECT USING (partner_id = auth.uid());

-- =============================================================
-- PHASE 6: CREATE PARTNER_STOCK TABLE
-- =============================================================

CREATE TABLE IF NOT EXISTS partner_stock (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL,
  product_id uuid REFERENCES seller_products(id) ON DELETE CASCADE,
  variant_id uuid,
  qty_on_hand integer NOT NULL DEFAULT 0,
  last_updated_at timestamptz DEFAULT now()
);

-- Add unique constraint
CREATE UNIQUE INDEX IF NOT EXISTS idx_partner_stock_unique 
  ON partner_stock(partner_id, product_id, COALESCE(variant_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_partner_stock_partner_id ON partner_stock(partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_stock_product_id ON partner_stock(product_id);

-- Enable RLS
ALTER TABLE partner_stock ENABLE ROW LEVEL SECURITY;

-- RLS Policies for partner_stock
DROP POLICY IF EXISTS "Admins can do all on partner_stock" ON partner_stock;
CREATE POLICY "Admins can do all on partner_stock" ON partner_stock
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Partners can view own stock" ON partner_stock;
CREATE POLICY "Partners can view own stock" ON partner_stock
  FOR SELECT USING (partner_id = auth.uid());

-- =============================================================
-- PHASE 7: CREATE PARTNER_STOCK_MOVEMENTS TABLE
-- =============================================================

CREATE TABLE IF NOT EXISTS partner_stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL,
  product_id uuid REFERENCES seller_products(id) ON DELETE CASCADE,
  variant_id uuid,
  movement_type text NOT NULL,
  qty_change integer NOT NULL,
  related_order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
  note text,
  created_at timestamptz DEFAULT now()
);

-- Add constraint
ALTER TABLE partner_stock_movements DROP CONSTRAINT IF EXISTS partner_stock_movements_type_check;
ALTER TABLE partner_stock_movements ADD CONSTRAINT partner_stock_movements_type_check 
  CHECK (movement_type IN ('stock_added', 'stock_removed', 'sold_deducted', 'returned_to_admin', 'adjustment', 'undo_sale_restore'));

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_partner_stock_movements_partner_id ON partner_stock_movements(partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_stock_movements_order_id ON partner_stock_movements(related_order_id);
CREATE INDEX IF NOT EXISTS idx_partner_stock_movements_created_at ON partner_stock_movements(created_at);

-- Enable RLS
ALTER TABLE partner_stock_movements ENABLE ROW LEVEL SECURITY;

-- RLS Policies for partner_stock_movements
DROP POLICY IF EXISTS "Admins can do all on partner_stock_movements" ON partner_stock_movements;
CREATE POLICY "Admins can do all on partner_stock_movements" ON partner_stock_movements
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Partners can view own stock movements" ON partner_stock_movements;
CREATE POLICY "Partners can view own stock movements" ON partner_stock_movements
  FOR SELECT USING (partner_id = auth.uid());

-- =============================================================
-- PHASE 8: CREATE RPC FUNCTIONS
-- =============================================================

-- A) rpc_assign_order: Admin assigns order to partner with commission
CREATE OR REPLACE FUNCTION public.rpc_assign_order(
  p_order_id uuid,
  p_partner_id uuid,
  p_commission_type text DEFAULT 'fixed',
  p_commission_value numeric DEFAULT 0
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id uuid;
  v_assignment_id uuid;
BEGIN
  -- Get current user
  v_admin_id := auth.uid();
  
  -- Verify admin role
  IF NOT has_role(v_admin_id, 'admin'::app_role) THEN
    RETURN json_build_object('success', false, 'error', 'Admin access required');
  END IF;

  -- Mark any previous pending assignments as reassigned
  UPDATE order_assignments 
  SET assignment_status = 'reassigned'
  WHERE order_id = p_order_id AND assignment_status = 'pending';

  -- Create new assignment record
  INSERT INTO order_assignments (order_id, partner_id, assigned_by_admin_id, commission_type, commission_value)
  VALUES (p_order_id, p_partner_id, v_admin_id, p_commission_type, p_commission_value)
  RETURNING id INTO v_assignment_id;

  -- Update order status
  UPDATE orders 
  SET 
    assigned_partner_id = p_partner_id,
    order_status = 'ASSIGNED',
    status = 'ASSIGNED',
    assigned_at = now(),
    partner_commission = CASE 
      WHEN p_commission_type = 'fixed' THEN p_commission_value
      ELSE (total_price * p_commission_value / 100)
    END,
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
      'assignment_id', v_assignment_id
    )::jsonb
  );

  RETURN json_build_object('success', true, 'assignment_id', v_assignment_id);
END;
$$;

-- B) rpc_partner_respond: Partner accepts or declines assignment
CREATE OR REPLACE FUNCTION public.rpc_partner_respond(
  p_order_id uuid,
  p_response text,
  p_decline_reason text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_partner_id uuid;
  v_assignment_id uuid;
BEGIN
  -- Get current user
  v_partner_id := auth.uid();
  
  -- Validate response
  IF p_response NOT IN ('accepted', 'declined') THEN
    RETURN json_build_object('success', false, 'error', 'Invalid response. Must be accepted or declined');
  END IF;

  -- Get the pending assignment for this order and partner
  SELECT id INTO v_assignment_id
  FROM order_assignments
  WHERE order_id = p_order_id 
    AND partner_id = v_partner_id 
    AND assignment_status = 'pending'
  ORDER BY assigned_at DESC
  LIMIT 1;

  IF v_assignment_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'No pending assignment found');
  END IF;

  -- Update assignment
  UPDATE order_assignments 
  SET 
    assignment_status = p_response,
    responded_at = now()
  WHERE id = v_assignment_id;

  IF p_response = 'accepted' THEN
    -- Update order status
    UPDATE orders 
    SET 
      order_status = 'ACCEPTED',
      status = 'ACCEPTED',
      accepted_at = now(),
      updated_at = now()
    WHERE id = p_order_id;

    -- Log event
    INSERT INTO order_events (order_id, actor_user_id, event_type, event_payload)
    VALUES (p_order_id, v_partner_id, 'accepted', json_build_object('assignment_id', v_assignment_id)::jsonb);
  ELSE
    -- Declined: Reset order to NEW so admin can reassign
    UPDATE orders 
    SET 
      order_status = 'NEW',
      status = 'NEW',
      assigned_partner_id = NULL,
      partner_commission = NULL,
      assigned_at = NULL,
      updated_at = now()
    WHERE id = p_order_id;

    -- Log event
    INSERT INTO order_events (order_id, actor_user_id, event_type, event_payload)
    VALUES (
      p_order_id, 
      v_partner_id, 
      'declined', 
      json_build_object('assignment_id', v_assignment_id, 'reason', p_decline_reason)::jsonb
    );
  END IF;

  RETURN json_build_object('success', true, 'response', p_response);
END;
$$;

-- C) rpc_mark_completed: Partner marks order as completed
CREATE OR REPLACE FUNCTION public.rpc_mark_completed(
  p_order_id uuid,
  p_gross_collected numeric DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_partner_id uuid;
  v_order record;
  v_assignment record;
  v_commission_amount numeric;
  v_gross numeric;
BEGIN
  -- Get current user
  v_partner_id := auth.uid();
  
  -- Get order details
  SELECT * INTO v_order FROM orders WHERE id = p_order_id;
  
  IF v_order IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Order not found');
  END IF;

  -- Verify partner is assigned
  IF v_order.assigned_partner_id != v_partner_id THEN
    RETURN json_build_object('success', false, 'error', 'Order not assigned to you');
  END IF;

  -- Verify order is in correct state
  IF v_order.order_status NOT IN ('ASSIGNED', 'ACCEPTED', 'ON_THE_WAY') THEN
    RETURN json_build_object('success', false, 'error', 'Order cannot be completed in current state');
  END IF;

  -- Use provided gross or order total
  v_gross := COALESCE(p_gross_collected, v_order.total_price);

  -- Get the active assignment for commission calculation
  SELECT * INTO v_assignment 
  FROM order_assignments 
  WHERE order_id = p_order_id 
    AND partner_id = v_partner_id 
    AND assignment_status IN ('pending', 'accepted')
  ORDER BY assigned_at DESC 
  LIMIT 1;

  -- Calculate commission
  IF v_assignment IS NOT NULL THEN
    IF v_assignment.commission_type = 'fixed' THEN
      v_commission_amount := v_assignment.commission_value;
    ELSE
      v_commission_amount := v_gross * (v_assignment.commission_value / 100);
    END IF;

    -- Lock commission on assignment
    UPDATE order_assignments 
    SET 
      commission_amount_calculated = v_commission_amount,
      assignment_status = 'accepted'
    WHERE id = v_assignment.id;
  ELSE
    v_commission_amount := COALESCE(v_order.partner_commission, 0);
  END IF;

  -- Update order status
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

  -- Create cash ledger entry
  INSERT INTO partner_cash_ledger (partner_id, order_id, gross_collected, commission_amount)
  VALUES (v_partner_id, p_order_id, v_gross, v_commission_amount)
  ON CONFLICT (order_id) DO UPDATE SET
    gross_collected = EXCLUDED.gross_collected,
    commission_amount = EXCLUDED.commission_amount;

  -- Log event
  INSERT INTO order_events (order_id, actor_user_id, event_type, event_payload)
  VALUES (
    p_order_id, 
    v_partner_id, 
    'completed', 
    json_build_object(
      'gross_collected', v_gross,
      'commission_amount', v_commission_amount
    )::jsonb
  );

  RETURN json_build_object(
    'success', true, 
    'gross_collected', v_gross,
    'commission_earned', v_commission_amount
  );
END;
$$;

-- D) rpc_mark_no_sale: Partner marks order as no sale
CREATE OR REPLACE FUNCTION public.rpc_mark_no_sale(
  p_order_id uuid,
  p_note text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_partner_id uuid;
  v_order record;
BEGIN
  -- Get current user
  v_partner_id := auth.uid();
  
  -- Get order details
  SELECT * INTO v_order FROM orders WHERE id = p_order_id;
  
  IF v_order IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Order not found');
  END IF;

  -- Verify partner is assigned
  IF v_order.assigned_partner_id != v_partner_id THEN
    RETURN json_build_object('success', false, 'error', 'Order not assigned to you');
  END IF;

  -- Update order status - NO stock deduction, NO ledger creation
  UPDATE orders 
  SET 
    order_status = 'NO_SALE',
    status = 'NO_SALE',
    no_sale_at = now(),
    note = CASE 
      WHEN p_note IS NOT NULL THEN COALESCE(note || E'\n---\n', '') || 'No Sale: ' || p_note
      ELSE note
    END,
    updated_at = now()
  WHERE id = p_order_id;

  -- Log event
  INSERT INTO order_events (order_id, actor_user_id, event_type, event_payload)
  VALUES (
    p_order_id, 
    v_partner_id, 
    'no_sale', 
    json_build_object('note', p_note)::jsonb
  );

  RETURN json_build_object('success', true);
END;
$$;

-- E) rpc_undo_completed: Partner undoes completion within time limit
CREATE OR REPLACE FUNCTION public.rpc_undo_completed(
  p_order_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_partner_id uuid;
  v_order record;
  v_time_limit_minutes integer := 60;
BEGIN
  -- Get current user
  v_partner_id := auth.uid();
  
  -- Get order details
  SELECT * INTO v_order FROM orders WHERE id = p_order_id;
  
  IF v_order IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Order not found');
  END IF;

  -- Verify partner is assigned
  IF v_order.assigned_partner_id != v_partner_id THEN
    RETURN json_build_object('success', false, 'error', 'Order not assigned to you');
  END IF;

  -- Verify order is completed and unsettled
  IF v_order.order_status != 'COMPLETED' THEN
    RETURN json_build_object('success', false, 'error', 'Order is not completed');
  END IF;

  IF v_order.settlement_status = 'settled' THEN
    RETURN json_build_object('success', false, 'error', 'Cannot undo a settled order');
  END IF;

  -- Check time limit
  IF v_order.completed_at IS NULL OR now() > v_order.completed_at + (v_time_limit_minutes || ' minutes')::interval THEN
    RETURN json_build_object('success', false, 'error', 'Time limit exceeded for undo');
  END IF;

  -- Revert order status to ACCEPTED
  UPDATE orders 
  SET 
    order_status = 'ACCEPTED',
    status = 'ACCEPTED',
    completed_at = NULL,
    partner_commission_status = 'pending',
    updated_at = now()
  WHERE id = p_order_id;

  -- Delete cash ledger entry
  DELETE FROM partner_cash_ledger WHERE order_id = p_order_id;

  -- Create stock restore movement (if stock was deducted)
  -- This will be handled by the UI when stock tracking is implemented

  -- Log event
  INSERT INTO order_events (order_id, actor_user_id, event_type, event_payload)
  VALUES (
    p_order_id, 
    v_partner_id, 
    'undo_completed', 
    json_build_object('reason', 'Partner undid completion within time limit')::jsonb
  );

  RETURN json_build_object('success', true);
END;
$$;

-- F) rpc_settle_partner: Admin settles partner cash
CREATE OR REPLACE FUNCTION public.rpc_settle_partner(
  p_partner_id uuid,
  p_settlement_note text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id uuid;
  v_total_unsettled numeric;
  v_settlement_id uuid;
  v_order_ids uuid[];
BEGIN
  -- Get current user
  v_admin_id := auth.uid();
  
  -- Verify admin role
  IF NOT has_role(v_admin_id, 'admin'::app_role) THEN
    RETURN json_build_object('success', false, 'error', 'Admin access required');
  END IF;

  -- Calculate total unsettled
  SELECT 
    COALESCE(SUM(net_owed_to_admin), 0),
    ARRAY_AGG(order_id)
  INTO v_total_unsettled, v_order_ids
  FROM partner_cash_ledger
  WHERE partner_id = p_partner_id AND ledger_status = 'unsettled';

  IF v_total_unsettled = 0 THEN
    RETURN json_build_object('success', false, 'error', 'No unsettled balance');
  END IF;

  -- Create settlement record
  INSERT INTO partner_settlements (partner_id, settled_by_admin_id, settlement_amount, settlement_note)
  VALUES (p_partner_id, v_admin_id, v_total_unsettled, p_settlement_note)
  RETURNING id INTO v_settlement_id;

  -- Mark ledger entries as settled
  UPDATE partner_cash_ledger 
  SET ledger_status = 'settled'
  WHERE partner_id = p_partner_id AND ledger_status = 'unsettled';

  -- Update orders settlement_status
  UPDATE orders 
  SET settlement_status = 'settled', updated_at = now()
  WHERE id = ANY(v_order_ids);

  -- Log events for each order
  INSERT INTO order_events (order_id, actor_user_id, event_type, event_payload)
  SELECT 
    unnest(v_order_ids),
    v_admin_id,
    'settled',
    json_build_object('settlement_id', v_settlement_id, 'total_amount', v_total_unsettled)::jsonb;

  RETURN json_build_object(
    'success', true, 
    'settlement_id', v_settlement_id,
    'amount_settled', v_total_unsettled,
    'orders_settled', array_length(v_order_ids, 1)
  );
END;
$$;

-- G) Helper function to get partner totals (for UI)
CREATE OR REPLACE FUNCTION public.get_partner_totals(p_partner_id uuid DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_partner_id uuid;
  v_total_earned numeric;
  v_amount_to_return numeric;
BEGIN
  -- Use provided partner_id or current user
  v_partner_id := COALESCE(p_partner_id, auth.uid());
  
  -- Calculate totals from cash ledger
  SELECT 
    COALESCE(SUM(commission_amount), 0),
    COALESCE(SUM(CASE WHEN ledger_status = 'unsettled' THEN net_owed_to_admin ELSE 0 END), 0)
  INTO v_total_earned, v_amount_to_return
  FROM partner_cash_ledger
  WHERE partner_id = v_partner_id;

  RETURN json_build_object(
    'total_commission_earned', v_total_earned,
    'amount_to_return', v_amount_to_return
  );
END;
$$;

-- H) rpc_add_partner_stock: Admin adds stock to partner
CREATE OR REPLACE FUNCTION public.rpc_add_partner_stock(
  p_partner_id uuid,
  p_product_id uuid,
  p_quantity integer,
  p_note text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id uuid;
  v_stock_id uuid;
BEGIN
  -- Get current user
  v_admin_id := auth.uid();
  
  -- Verify admin role
  IF NOT has_role(v_admin_id, 'admin'::app_role) THEN
    RETURN json_build_object('success', false, 'error', 'Admin access required');
  END IF;

  -- Insert or update stock
  INSERT INTO partner_stock (partner_id, product_id, qty_on_hand, last_updated_at)
  VALUES (p_partner_id, p_product_id, p_quantity, now())
  ON CONFLICT (partner_id, product_id, COALESCE(variant_id, '00000000-0000-0000-0000-000000000000'::uuid))
  DO UPDATE SET 
    qty_on_hand = partner_stock.qty_on_hand + EXCLUDED.qty_on_hand,
    last_updated_at = now()
  RETURNING id INTO v_stock_id;

  -- Log movement
  INSERT INTO partner_stock_movements (partner_id, product_id, movement_type, qty_change, note)
  VALUES (p_partner_id, p_product_id, 'stock_added', p_quantity, p_note);

  RETURN json_build_object('success', true, 'stock_id', v_stock_id);
END;
$$;

-- I) rpc_remove_partner_stock: Admin removes/returns stock from partner
CREATE OR REPLACE FUNCTION public.rpc_remove_partner_stock(
  p_partner_id uuid,
  p_product_id uuid,
  p_quantity integer,
  p_movement_type text DEFAULT 'stock_removed',
  p_note text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id uuid;
  v_current_qty integer;
BEGIN
  -- Get current user
  v_admin_id := auth.uid();
  
  -- Verify admin role
  IF NOT has_role(v_admin_id, 'admin'::app_role) THEN
    RETURN json_build_object('success', false, 'error', 'Admin access required');
  END IF;

  -- Get current stock
  SELECT qty_on_hand INTO v_current_qty
  FROM partner_stock
  WHERE partner_id = p_partner_id AND product_id = p_product_id;

  IF v_current_qty IS NULL OR v_current_qty < p_quantity THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient stock');
  END IF;

  -- Update stock
  UPDATE partner_stock 
  SET qty_on_hand = qty_on_hand - p_quantity, last_updated_at = now()
  WHERE partner_id = p_partner_id AND product_id = p_product_id;

  -- Log movement
  INSERT INTO partner_stock_movements (partner_id, product_id, movement_type, qty_change, note)
  VALUES (p_partner_id, p_product_id, p_movement_type, -p_quantity, p_note);

  RETURN json_build_object('success', true, 'new_qty', v_current_qty - p_quantity);
END;
$$;