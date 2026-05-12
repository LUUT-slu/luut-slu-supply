
-- Extend purchase_order_items
DO $$ BEGIN
  CREATE TYPE public.po_source_type AS ENUM ('manual','shopify','seller_product');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.purchase_order_items
  ADD COLUMN IF NOT EXISTS source_type public.po_source_type NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS source_product_ref text,
  ADD COLUMN IF NOT EXISTS current_shopify_price numeric,
  ADD COLUMN IF NOT EXISTS current_shopify_stock integer,
  ADD COLUMN IF NOT EXISTS compare_at_price numeric,
  ADD COLUMN IF NOT EXISTS is_restock boolean NOT NULL DEFAULT false;

-- Variants table
CREATE TABLE IF NOT EXISTS public.purchase_order_item_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.purchase_order_items(id) ON DELETE CASCADE,
  included boolean NOT NULL DEFAULT true,
  shopify_variant_id text,
  option_color text,
  option_size text,
  option_other text,
  cost_per_item numeric NOT NULL DEFAULT 0,
  selling_price numeric NOT NULL DEFAULT 0,
  compare_at_price numeric,
  quantity_ordered integer NOT NULL DEFAULT 0,
  quantity_arrived integer NOT NULL DEFAULT 0,
  quantity_missing integer NOT NULL DEFAULT 0,
  quantity_damaged integer NOT NULL DEFAULT 0,
  is_new_variant boolean NOT NULL DEFAULT false,
  expected_profit numeric GENERATED ALWAYS AS ((selling_price - cost_per_item) * quantity_ordered) STORED,
  profit_margin numeric GENERATED ALWAYS AS (
    CASE WHEN selling_price > 0 THEN ((selling_price - cost_per_item) / selling_price) * 100 ELSE 0 END
  ) STORED,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_poiv_item ON public.purchase_order_item_variants(item_id);

ALTER TABLE public.purchase_order_item_variants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage all PO variants" ON public.purchase_order_item_variants;
CREATE POLICY "Admins manage all PO variants"
ON public.purchase_order_item_variants FOR ALL
USING (has_role(auth.uid(),'admin'::app_role))
WITH CHECK (has_role(auth.uid(),'admin'::app_role));

DROP POLICY IF EXISTS "Owners view own PO variants" ON public.purchase_order_item_variants;
CREATE POLICY "Owners view own PO variants"
ON public.purchase_order_item_variants FOR SELECT
USING (EXISTS (
  SELECT 1 FROM purchase_order_items i
  WHERE i.id = purchase_order_item_variants.item_id AND is_po_owner(i.purchase_order_id)
));

DROP POLICY IF EXISTS "Owners insert own PO variants" ON public.purchase_order_item_variants;
CREATE POLICY "Owners insert own PO variants"
ON public.purchase_order_item_variants FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM purchase_order_items i
  WHERE i.id = purchase_order_item_variants.item_id AND is_po_owner(i.purchase_order_id)
));

DROP POLICY IF EXISTS "Owners update own PO variants" ON public.purchase_order_item_variants;
CREATE POLICY "Owners update own PO variants"
ON public.purchase_order_item_variants FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM purchase_order_items i
  WHERE i.id = purchase_order_item_variants.item_id AND is_po_owner(i.purchase_order_id)
))
WITH CHECK (EXISTS (
  SELECT 1 FROM purchase_order_items i
  WHERE i.id = purchase_order_item_variants.item_id AND is_po_owner(i.purchase_order_id)
));

DROP POLICY IF EXISTS "Owners delete own PO variants" ON public.purchase_order_item_variants;
CREATE POLICY "Owners delete own PO variants"
ON public.purchase_order_item_variants FOR DELETE
USING (EXISTS (
  SELECT 1 FROM purchase_order_items i
  WHERE i.id = purchase_order_item_variants.item_id AND is_po_owner(i.purchase_order_id)
));

CREATE TRIGGER trg_poiv_updated_at
BEFORE UPDATE ON public.purchase_order_item_variants
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Recalc parent item totals from variants when present
CREATE OR REPLACE FUNCTION public.recalc_po_item_from_variants(p_item_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_qty int := 0;
  v_arr int := 0;
  v_cost numeric := 0;
  v_sell numeric := 0;
  v_count int := 0;
  v_po uuid;
BEGIN
  SELECT purchase_order_id INTO v_po FROM purchase_order_items WHERE id = p_item_id;

  SELECT
    COALESCE(SUM(quantity_ordered),0),
    COALESCE(SUM(quantity_arrived),0),
    COALESCE(AVG(NULLIF(cost_per_item,0)),0),
    COALESCE(AVG(NULLIF(selling_price,0)),0),
    COUNT(*)
  INTO v_qty, v_arr, v_cost, v_sell, v_count
  FROM purchase_order_item_variants
  WHERE item_id = p_item_id AND included = true;

  IF v_count > 0 THEN
    UPDATE purchase_order_items
    SET quantity_ordered = v_qty,
        quantity_arrived = v_arr,
        cost_per_item = v_cost,
        selling_price = v_sell,
        updated_at = now()
    WHERE id = p_item_id;
  END IF;

  IF v_po IS NOT NULL THEN
    PERFORM public.recalc_po_totals(v_po);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.trg_poiv_recalc()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recalc_po_item_from_variants(OLD.item_id);
    RETURN OLD;
  ELSE
    PERFORM public.recalc_po_item_from_variants(NEW.item_id);
    RETURN NEW;
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_poiv_after_change ON public.purchase_order_item_variants;
CREATE TRIGGER trg_poiv_after_change
AFTER INSERT OR UPDATE OR DELETE ON public.purchase_order_item_variants
FOR EACH ROW EXECUTE FUNCTION public.trg_poiv_recalc();

-- Add-existing-product RPC
CREATE OR REPLACE FUNCTION public.rpc_po_add_existing_product(
  p_po_id uuid,
  p_source_type text,
  p_source_ref text,
  p_snapshot jsonb
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_owner uuid;
  v_item_id uuid;
  v_var jsonb;
BEGIN
  SELECT owner_user_id INTO v_owner FROM purchase_orders WHERE id = p_po_id;
  IF v_owner IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'PO not found');
  END IF;
  IF v_owner != v_uid AND NOT has_role(v_uid,'admin'::app_role) THEN
    RETURN json_build_object('success', false, 'error', 'Not authorized');
  END IF;

  INSERT INTO purchase_order_items (
    purchase_order_id, product_name, category, sub_category,
    quantity_ordered, cost_per_item, selling_price, compare_at_price,
    image_url, supplier_link, color, size, brand, notes,
    source_type, source_product_ref, current_shopify_price, current_shopify_stock,
    is_restock, shopify_product_id, linked_seller_product_id
  ) VALUES (
    p_po_id,
    p_snapshot->>'product_name',
    NULLIF(p_snapshot->>'category',''),
    NULLIF(p_snapshot->>'sub_category',''),
    COALESCE((p_snapshot->>'quantity_ordered')::int, 0),
    COALESCE((p_snapshot->>'cost_per_item')::numeric, 0),
    COALESCE((p_snapshot->>'selling_price')::numeric, 0),
    NULLIF(p_snapshot->>'compare_at_price','')::numeric,
    NULLIF(p_snapshot->>'image_url',''),
    NULLIF(p_snapshot->>'supplier_link',''),
    NULLIF(p_snapshot->>'color',''),
    NULLIF(p_snapshot->>'size',''),
    NULLIF(p_snapshot->>'brand',''),
    NULLIF(p_snapshot->>'notes',''),
    p_source_type::po_source_type,
    p_source_ref,
    NULLIF(p_snapshot->>'current_shopify_price','')::numeric,
    NULLIF(p_snapshot->>'current_shopify_stock','')::int,
    true,
    CASE WHEN p_source_type = 'shopify' THEN p_source_ref ELSE NULL END,
    CASE WHEN p_source_type = 'seller_product' THEN p_source_ref::uuid ELSE NULL END
  ) RETURNING id INTO v_item_id;

  IF jsonb_typeof(p_snapshot->'variants') = 'array' THEN
    FOR v_var IN SELECT * FROM jsonb_array_elements(p_snapshot->'variants') LOOP
      INSERT INTO purchase_order_item_variants (
        item_id, included, shopify_variant_id,
        option_color, option_size, option_other,
        cost_per_item, selling_price, compare_at_price,
        quantity_ordered, is_new_variant
      ) VALUES (
        v_item_id,
        COALESCE((v_var->>'included')::boolean, true),
        NULLIF(v_var->>'shopify_variant_id',''),
        NULLIF(v_var->>'option_color',''),
        NULLIF(v_var->>'option_size',''),
        NULLIF(v_var->>'option_other',''),
        COALESCE((v_var->>'cost_per_item')::numeric, 0),
        COALESCE((v_var->>'selling_price')::numeric, 0),
        NULLIF(v_var->>'compare_at_price','')::numeric,
        COALESCE((v_var->>'quantity_ordered')::int, 0),
        COALESCE((v_var->>'is_new_variant')::boolean, false)
      );
    END LOOP;
  END IF;

  PERFORM public.recalc_po_totals(p_po_id);

  INSERT INTO purchase_order_events (purchase_order_id, actor_user_id, event_type, event_payload)
  VALUES (p_po_id, v_uid, 'existing_product_added',
    jsonb_build_object('item_id', v_item_id, 'source_type', p_source_type, 'source_ref', p_source_ref));

  RETURN json_build_object('success', true, 'item_id', v_item_id);
END $$;
