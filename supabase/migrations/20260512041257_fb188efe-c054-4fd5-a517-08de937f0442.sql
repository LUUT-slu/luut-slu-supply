
-- Enums
CREATE TYPE public.po_status AS ENUM (
  'draft','ordered','paid','in_transit','arrived','partially_arrived',
  'published','selling','completed','cancelled'
);

CREATE TYPE public.po_payment_status AS ENUM ('unpaid','partial','paid');
CREATE TYPE public.po_owner_role AS ENUM ('admin','seller');
CREATE TYPE public.po_publish_state AS ENUM ('hidden','coming_soon','draft','active');
CREATE TYPE public.po_tag_source AS ENUM ('manual','auto');

-- Purchase orders
CREATE TABLE public.purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL,
  owner_role public.po_owner_role NOT NULL DEFAULT 'admin',
  seller_profile_id uuid REFERENCES public.seller_profiles(id) ON DELETE SET NULL,
  name text NOT NULL,
  supplier_name text,
  supplier_link text,
  date_ordered date,
  expected_arrival_date date,
  actual_arrival_date date,
  payment_status public.po_payment_status NOT NULL DEFAULT 'unpaid',
  status public.po_status NOT NULL DEFAULT 'draft',
  notes text,
  total_cost numeric NOT NULL DEFAULT 0,
  total_expected_revenue numeric NOT NULL DEFAULT 0,
  total_expected_profit numeric NOT NULL DEFAULT 0,
  avg_margin numeric NOT NULL DEFAULT 0,
  high_roi_count integer NOT NULL DEFAULT 0,
  risky_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_po_owner ON public.purchase_orders(owner_user_id, status);
CREATE INDEX idx_po_status ON public.purchase_orders(status);

-- Items
CREATE TABLE public.purchase_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id uuid NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  product_name text NOT NULL,
  category text,
  sub_category text,
  quantity_ordered integer NOT NULL DEFAULT 0,
  quantity_arrived integer NOT NULL DEFAULT 0,
  quantity_missing integer NOT NULL DEFAULT 0,
  quantity_damaged integer NOT NULL DEFAULT 0,
  cost_per_item numeric NOT NULL DEFAULT 0,
  selling_price numeric NOT NULL DEFAULT 0,
  image_url text,
  supplier_link text,
  color text,
  size text,
  brand text,
  notes text,
  linked_seller_product_id uuid REFERENCES public.seller_products(id) ON DELETE SET NULL,
  shopify_product_id text,
  shopify_variant_id text,
  shopify_sync_status text,
  shopify_synced_at timestamptz,
  shopify_publish_state public.po_publish_state NOT NULL DEFAULT 'hidden',
  qty_sold_cached integer NOT NULL DEFAULT 0,
  revenue_cached numeric NOT NULL DEFAULT 0,
  first_sold_at timestamptz,
  last_sold_at timestamptz,
  total_cost numeric GENERATED ALWAYS AS (cost_per_item * quantity_ordered) STORED,
  expected_revenue numeric GENERATED ALWAYS AS (selling_price * quantity_ordered) STORED,
  expected_profit numeric GENERATED ALWAYS AS ((selling_price - cost_per_item) * quantity_ordered) STORED,
  profit_margin numeric GENERATED ALWAYS AS (
    CASE WHEN selling_price > 0 THEN ((selling_price - cost_per_item) / selling_price) * 100 ELSE 0 END
  ) STORED,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_po_items_po ON public.purchase_order_items(purchase_order_id);
CREATE INDEX idx_po_items_cat ON public.purchase_order_items(category, sub_category);
CREATE INDEX idx_po_items_shopify ON public.purchase_order_items(shopify_product_id);
CREATE INDEX idx_po_items_name ON public.purchase_order_items(lower(product_name));

-- Tags
CREATE TABLE public.purchase_order_item_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.purchase_order_items(id) ON DELETE CASCADE,
  tag text NOT NULL,
  source public.po_tag_source NOT NULL DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(item_id, tag)
);
CREATE INDEX idx_po_tags_item ON public.purchase_order_item_tags(item_id);

-- Events
CREATE TABLE public.purchase_order_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id uuid NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  actor_user_id uuid,
  event_type text NOT NULL,
  event_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_po_events_po ON public.purchase_order_events(purchase_order_id);

-- Updated_at triggers
CREATE TRIGGER trg_po_updated_at BEFORE UPDATE ON public.purchase_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_po_items_updated_at BEFORE UPDATE ON public.purchase_order_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Rollup totals on parent PO
CREATE OR REPLACE FUNCTION public.recalc_po_totals(p_po_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_cost numeric := 0;
  v_total_rev numeric := 0;
  v_total_profit numeric := 0;
  v_avg_margin numeric := 0;
  v_high_roi int := 0;
  v_risky int := 0;
BEGIN
  SELECT
    COALESCE(SUM(total_cost),0),
    COALESCE(SUM(expected_revenue),0),
    COALESCE(SUM(expected_profit),0),
    COALESCE(AVG(profit_margin),0),
    COUNT(*) FILTER (WHERE profit_margin >= 50),
    COUNT(*) FILTER (WHERE profit_margin < 25)
  INTO v_total_cost, v_total_rev, v_total_profit, v_avg_margin, v_high_roi, v_risky
  FROM public.purchase_order_items
  WHERE purchase_order_id = p_po_id;

  UPDATE public.purchase_orders
  SET total_cost = v_total_cost,
      total_expected_revenue = v_total_rev,
      total_expected_profit = v_total_profit,
      avg_margin = v_avg_margin,
      high_roi_count = v_high_roi,
      risky_count = v_risky,
      updated_at = now()
  WHERE id = p_po_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_recalc_po_totals()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recalc_po_totals(OLD.purchase_order_id);
    RETURN OLD;
  ELSE
    PERFORM public.recalc_po_totals(NEW.purchase_order_id);
    RETURN NEW;
  END IF;
END;
$$;

CREATE TRIGGER trg_po_items_recalc
AFTER INSERT OR UPDATE OR DELETE ON public.purchase_order_items
FOR EACH ROW EXECUTE FUNCTION public.trg_recalc_po_totals();

-- Helper: is owner of PO
CREATE OR REPLACE FUNCTION public.is_po_owner(p_po_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.purchase_orders
    WHERE id = p_po_id AND owner_user_id = auth.uid()
  );
$$;

-- RLS
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_item_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_events ENABLE ROW LEVEL SECURITY;

-- purchase_orders policies
CREATE POLICY "Admins manage all POs" ON public.purchase_orders
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Owners view own POs" ON public.purchase_orders
  FOR SELECT USING (owner_user_id = auth.uid());

CREATE POLICY "Owners insert own POs" ON public.purchase_orders
  FOR INSERT WITH CHECK (owner_user_id = auth.uid());

CREATE POLICY "Owners update own POs" ON public.purchase_orders
  FOR UPDATE USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());

CREATE POLICY "Owners delete own POs" ON public.purchase_orders
  FOR DELETE USING (owner_user_id = auth.uid());

-- items policies
CREATE POLICY "Admins manage all PO items" ON public.purchase_order_items
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Owners view own PO items" ON public.purchase_order_items
  FOR SELECT USING (public.is_po_owner(purchase_order_id));

CREATE POLICY "Owners insert own PO items" ON public.purchase_order_items
  FOR INSERT WITH CHECK (public.is_po_owner(purchase_order_id));

CREATE POLICY "Owners update own PO items" ON public.purchase_order_items
  FOR UPDATE USING (public.is_po_owner(purchase_order_id))
  WITH CHECK (public.is_po_owner(purchase_order_id));

CREATE POLICY "Owners delete own PO items" ON public.purchase_order_items
  FOR DELETE USING (public.is_po_owner(purchase_order_id));

-- tags policies
CREATE POLICY "Admins manage all PO tags" ON public.purchase_order_item_tags
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Owners view own PO tags" ON public.purchase_order_item_tags
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.purchase_order_items i
    WHERE i.id = item_id AND public.is_po_owner(i.purchase_order_id)
  ));

CREATE POLICY "Owners insert own PO tags" ON public.purchase_order_item_tags
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM public.purchase_order_items i
    WHERE i.id = item_id AND public.is_po_owner(i.purchase_order_id)
  ));

CREATE POLICY "Owners delete own PO tags" ON public.purchase_order_item_tags
  FOR DELETE USING (EXISTS (
    SELECT 1 FROM public.purchase_order_items i
    WHERE i.id = item_id AND public.is_po_owner(i.purchase_order_id)
  ));

-- events policies
CREATE POLICY "Admins view all PO events" ON public.purchase_order_events
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Owners view own PO events" ON public.purchase_order_events
  FOR SELECT USING (public.is_po_owner(purchase_order_id));

CREATE POLICY "Authenticated insert PO events" ON public.purchase_order_events
  FOR INSERT WITH CHECK (auth.uid() = actor_user_id);

-- ====== RPCs ======

-- Confirm arrival: arrivals jsonb array of {item_id, arrived, missing, damaged}
CREATE OR REPLACE FUNCTION public.rpc_po_confirm_arrival(
  p_po_id uuid,
  p_arrivals jsonb,
  p_actual_date date DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_owner uuid;
  v_total_ordered int := 0;
  v_total_arrived int := 0;
  v_new_status public.po_status;
  v_rec jsonb;
BEGIN
  SELECT owner_user_id INTO v_owner FROM purchase_orders WHERE id = p_po_id;
  IF v_owner IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'PO not found');
  END IF;
  IF v_owner != v_uid AND NOT has_role(v_uid, 'admin'::app_role) THEN
    RETURN json_build_object('success', false, 'error', 'Not authorized');
  END IF;

  FOR v_rec IN SELECT * FROM jsonb_array_elements(COALESCE(p_arrivals, '[]'::jsonb)) LOOP
    UPDATE purchase_order_items
    SET quantity_arrived = COALESCE((v_rec->>'arrived')::int, 0),
        quantity_missing = COALESCE((v_rec->>'missing')::int, 0),
        quantity_damaged = COALESCE((v_rec->>'damaged')::int, 0)
    WHERE id = (v_rec->>'item_id')::uuid AND purchase_order_id = p_po_id;
  END LOOP;

  SELECT COALESCE(SUM(quantity_ordered),0), COALESCE(SUM(quantity_arrived),0)
    INTO v_total_ordered, v_total_arrived
    FROM purchase_order_items WHERE purchase_order_id = p_po_id;

  IF v_total_arrived = 0 THEN
    v_new_status := 'in_transit';
  ELSIF v_total_arrived >= v_total_ordered THEN
    v_new_status := 'arrived';
  ELSE
    v_new_status := 'partially_arrived';
  END IF;

  UPDATE purchase_orders
  SET status = v_new_status,
      actual_arrival_date = COALESCE(p_actual_date, CURRENT_DATE),
      notes = CASE WHEN p_notes IS NOT NULL THEN COALESCE(notes||E'\n','')||'Arrival: '||p_notes ELSE notes END,
      updated_at = now()
  WHERE id = p_po_id;

  INSERT INTO purchase_order_events (purchase_order_id, actor_user_id, event_type, event_payload)
  VALUES (p_po_id, v_uid, 'arrival_confirmed', jsonb_build_object('arrivals', p_arrivals, 'status', v_new_status));

  RETURN json_build_object('success', true, 'status', v_new_status);
END;
$$;

-- Auto tag rules
CREATE OR REPLACE FUNCTION public.rpc_po_apply_auto_tags(p_po_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_owner uuid;
  v_avg_cost numeric;
  v_avg_sell numeric;
  v_item record;
  v_prior_count int;
BEGIN
  SELECT owner_user_id INTO v_owner FROM purchase_orders WHERE id = p_po_id;
  IF v_owner IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'PO not found');
  END IF;
  IF v_owner != v_uid AND NOT has_role(v_uid, 'admin'::app_role) THEN
    RETURN json_build_object('success', false, 'error', 'Not authorized');
  END IF;

  -- Owner's average cost & price baseline
  SELECT AVG(NULLIF(cost_per_item,0)), AVG(NULLIF(selling_price,0))
    INTO v_avg_cost, v_avg_sell
    FROM purchase_order_items i
    JOIN purchase_orders po ON po.id = i.purchase_order_id
    WHERE po.owner_user_id = v_owner;

  -- Clear prior auto tags for this PO's items
  DELETE FROM purchase_order_item_tags
  WHERE source = 'auto' AND item_id IN (
    SELECT id FROM purchase_order_items WHERE purchase_order_id = p_po_id
  );

  FOR v_item IN SELECT * FROM purchase_order_items WHERE purchase_order_id = p_po_id LOOP
    -- Margin tags
    IF v_item.profit_margin >= 50 THEN
      INSERT INTO purchase_order_item_tags (item_id, tag, source) VALUES (v_item.id, 'High ROI', 'auto') ON CONFLICT DO NOTHING;
    ELSIF v_item.profit_margin >= 30 THEN
      INSERT INTO purchase_order_item_tags (item_id, tag, source) VALUES (v_item.id, 'Good margin', 'auto') ON CONFLICT DO NOTHING;
    ELSIF v_item.profit_margin > 0 AND v_item.profit_margin < 25 THEN
      INSERT INTO purchase_order_item_tags (item_id, tag, source) VALUES (v_item.id, 'Low ROI', 'auto') ON CONFLICT DO NOTHING;
    END IF;

    -- Cost vs avg
    IF v_avg_cost IS NOT NULL AND v_item.cost_per_item > 0 AND v_item.cost_per_item < v_avg_cost * 0.5 THEN
      INSERT INTO purchase_order_item_tags (item_id, tag, source) VALUES (v_item.id, 'Cheap item', 'auto') ON CONFLICT DO NOTHING;
    END IF;
    IF v_avg_sell IS NOT NULL AND v_item.selling_price > v_avg_sell * 1.5 THEN
      INSERT INTO purchase_order_item_tags (item_id, tag, source) VALUES (v_item.id, 'Premium item', 'auto') ON CONFLICT DO NOTHING;
    END IF;

    -- Limited stock: remaining (arrived - sold) <= 3
    IF (v_item.quantity_arrived - v_item.qty_sold_cached) <= 3 AND v_item.quantity_arrived > 0 THEN
      INSERT INTO purchase_order_item_tags (item_id, tag, source) VALUES (v_item.id, 'Limited stock', 'auto') ON CONFLICT DO NOTHING;
    END IF;

    -- Test product / Restock again
    SELECT COUNT(*) INTO v_prior_count
      FROM purchase_order_items i2
      JOIN purchase_orders po2 ON po2.id = i2.purchase_order_id
      WHERE po2.owner_user_id = v_owner
        AND po2.id <> p_po_id
        AND lower(i2.product_name) = lower(v_item.product_name);
    IF v_prior_count = 0 THEN
      INSERT INTO purchase_order_item_tags (item_id, tag, source) VALUES (v_item.id, 'Test product', 'auto') ON CONFLICT DO NOTHING;
    ELSE
      INSERT INTO purchase_order_item_tags (item_id, tag, source) VALUES (v_item.id, 'Restock again', 'auto') ON CONFLICT DO NOTHING;
    END IF;

    -- Quick / Slow seller (using cached sales + arrival date)
    IF v_item.quantity_arrived > 0 AND v_item.first_sold_at IS NOT NULL THEN
      IF v_item.qty_sold_cached >= v_item.quantity_arrived * 0.5
         AND v_item.first_sold_at <= now() - interval '0 days' THEN
        INSERT INTO purchase_order_item_tags (item_id, tag, source) VALUES (v_item.id, 'Quick seller', 'auto') ON CONFLICT DO NOTHING;
      END IF;
    END IF;
  END LOOP;

  RETURN json_build_object('success', true);
END;
$$;

-- Buying insights
CREATE OR REPLACE FUNCTION public.rpc_po_buying_insights(
  p_product_name text,
  p_category text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_last_cost numeric;
  v_last_sell numeric;
  v_avg_margin numeric;
  v_total_sold int;
  v_restock_count int;
  v_best_sell numeric;
  v_recommendation text;
BEGIN
  IF p_product_name IS NULL OR length(trim(p_product_name)) < 2 THEN
    RETURN json_build_object('found', false);
  END IF;

  SELECT cost_per_item, selling_price INTO v_last_cost, v_last_sell
  FROM purchase_order_items i
  JOIN purchase_orders po ON po.id = i.purchase_order_id
  WHERE po.owner_user_id = v_uid
    AND lower(i.product_name) = lower(p_product_name)
  ORDER BY i.created_at DESC LIMIT 1;

  SELECT AVG(profit_margin), SUM(qty_sold_cached), MAX(selling_price), COUNT(*)
  INTO v_avg_margin, v_total_sold, v_best_sell, v_restock_count
  FROM purchase_order_items i
  JOIN purchase_orders po ON po.id = i.purchase_order_id
  WHERE po.owner_user_id = v_uid
    AND lower(i.product_name) = lower(p_product_name);

  IF v_restock_count IS NULL OR v_restock_count = 0 THEN
    -- Try category
    IF p_category IS NOT NULL THEN
      SELECT AVG(profit_margin), SUM(qty_sold_cached), MAX(selling_price), COUNT(*)
      INTO v_avg_margin, v_total_sold, v_best_sell, v_restock_count
      FROM purchase_order_items i
      JOIN purchase_orders po ON po.id = i.purchase_order_id
      WHERE po.owner_user_id = v_uid AND lower(i.category) = lower(p_category);
    END IF;
  END IF;

  IF v_restock_count IS NULL OR v_restock_count = 0 THEN
    v_recommendation := 'Test small quantity';
    RETURN json_build_object(
      'found', false,
      'recommendation', v_recommendation
    );
  END IF;

  IF v_avg_margin >= 40 AND v_total_sold > 0 THEN
    v_recommendation := 'Strong profit item — good restock';
  ELSIF v_avg_margin >= 25 THEN
    v_recommendation := 'Good restock';
  ELSIF v_total_sold = 0 THEN
    v_recommendation := 'High risk — slow history';
  ELSE
    v_recommendation := 'Test small quantity';
  END IF;

  RETURN json_build_object(
    'found', true,
    'last_cost', v_last_cost,
    'last_sell', v_last_sell,
    'avg_margin', v_avg_margin,
    'total_sold', v_total_sold,
    'restock_count', v_restock_count,
    'best_sell_price', v_best_sell,
    'recommendation', v_recommendation
  );
END;
$$;
