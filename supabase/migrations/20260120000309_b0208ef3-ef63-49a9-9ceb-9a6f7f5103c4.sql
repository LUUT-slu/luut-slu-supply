-- =============================================
-- FIX A3: BACKFILL EXISTING ASSIGNED ORDERS
-- =============================================
UPDATE orders 
SET 
  order_status = 'ASSIGNED',
  assigned_at = COALESCE(assigned_at, now())
WHERE 
  assigned_partner_id IS NOT NULL 
  AND (order_status IS NULL OR order_status = 'NEW');

-- =============================================
-- FIX B1: CREATE ADMIN_INVENTORY TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS admin_inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES seller_products(id) ON DELETE CASCADE,
  variant_id uuid,
  qty_on_hand integer NOT NULL DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);

-- Create unique index for product_id + variant_id (handles NULL variant)
CREATE UNIQUE INDEX IF NOT EXISTS admin_inventory_product_variant_idx 
ON admin_inventory (product_id, COALESCE(variant_id, '00000000-0000-0000-0000-000000000000'));

ALTER TABLE admin_inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can do all on admin_inventory" ON admin_inventory
FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- =============================================
-- ADD UNIQUE CONSTRAINT TO PARTNER_STOCK FOR UPSERT
-- =============================================
CREATE UNIQUE INDEX IF NOT EXISTS partner_stock_unique_partner_product_idx
ON partner_stock (partner_id, product_id);

-- =============================================
-- FIX B2: RPC TO ALLOCATE STOCK TO PARTNER
-- =============================================
CREATE OR REPLACE FUNCTION rpc_admin_allocate_stock_to_partner(
  p_partner_id uuid,
  p_product_id uuid,
  p_variant_id uuid DEFAULT NULL,
  p_qty integer DEFAULT 0
) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_admin_qty integer;
  v_variant_key uuid;
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN json_build_object('success', false, 'error', 'Admin access required');
  END IF;

  IF p_qty <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'Quantity must be positive');
  END IF;

  v_variant_key := COALESCE(p_variant_id, '00000000-0000-0000-0000-000000000000');

  SELECT qty_on_hand INTO v_admin_qty 
  FROM admin_inventory 
  WHERE product_id = p_product_id 
    AND COALESCE(variant_id, '00000000-0000-0000-0000-000000000000') = v_variant_key;

  IF v_admin_qty IS NULL OR v_admin_qty < p_qty THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient admin inventory (have: ' || COALESCE(v_admin_qty, 0) || ')');
  END IF;

  UPDATE admin_inventory 
  SET qty_on_hand = qty_on_hand - p_qty, updated_at = now()
  WHERE product_id = p_product_id 
    AND COALESCE(variant_id, '00000000-0000-0000-0000-000000000000') = v_variant_key;

  INSERT INTO partner_stock (partner_id, product_id, variant_id, qty_on_hand, last_updated_at)
  VALUES (p_partner_id, p_product_id, p_variant_id, p_qty, now())
  ON CONFLICT (partner_id, product_id) 
  DO UPDATE SET qty_on_hand = partner_stock.qty_on_hand + p_qty, last_updated_at = now();

  INSERT INTO partner_stock_movements (partner_id, product_id, variant_id, movement_type, qty_change, note)
  VALUES (p_partner_id, p_product_id, p_variant_id, 'stock_added', p_qty, 'Allocated from admin');

  RETURN json_build_object('success', true, 'allocated', p_qty);
END;
$$;

-- =============================================
-- RPC TO ADD ADMIN INVENTORY (TOP UP)
-- =============================================
CREATE OR REPLACE FUNCTION rpc_admin_add_inventory(
  p_product_id uuid,
  p_variant_id uuid DEFAULT NULL,
  p_qty integer DEFAULT 0
) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN json_build_object('success', false, 'error', 'Admin access required');
  END IF;

  INSERT INTO admin_inventory (product_id, variant_id, qty_on_hand, updated_at)
  VALUES (p_product_id, p_variant_id, p_qty, now())
  ON CONFLICT (product_id, COALESCE(variant_id, '00000000-0000-0000-0000-000000000000')) 
  DO UPDATE SET qty_on_hand = admin_inventory.qty_on_hand + p_qty, updated_at = now();

  RETURN json_build_object('success', true, 'added', p_qty);
END;
$$;