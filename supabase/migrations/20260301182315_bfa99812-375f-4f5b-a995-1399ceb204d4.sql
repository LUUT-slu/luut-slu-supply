-- Add ON DELETE CASCADE to all foreign keys referencing orders
ALTER TABLE public.order_items DROP CONSTRAINT IF EXISTS order_items_order_id_fkey;
ALTER TABLE public.order_items ADD CONSTRAINT order_items_order_id_fkey 
  FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;

ALTER TABLE public.order_events DROP CONSTRAINT IF EXISTS order_events_order_id_fkey;
ALTER TABLE public.order_events ADD CONSTRAINT order_events_order_id_fkey 
  FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;

ALTER TABLE public.order_assignments DROP CONSTRAINT IF EXISTS order_assignments_order_id_fkey;
ALTER TABLE public.order_assignments ADD CONSTRAINT order_assignments_order_id_fkey 
  FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;

ALTER TABLE public.customer_discounts DROP CONSTRAINT IF EXISTS customer_discounts_used_on_order_id_fkey;
ALTER TABLE public.customer_discounts ADD CONSTRAINT customer_discounts_used_on_order_id_fkey 
  FOREIGN KEY (used_on_order_id) REFERENCES public.orders(id) ON DELETE SET NULL;

ALTER TABLE public.partner_cash_ledger DROP CONSTRAINT IF EXISTS partner_cash_ledger_order_id_fkey;
ALTER TABLE public.partner_cash_ledger ADD CONSTRAINT partner_cash_ledger_order_id_fkey 
  FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;

ALTER TABLE public.partner_stock_movements DROP CONSTRAINT IF EXISTS partner_stock_movements_related_order_id_fkey;
ALTER TABLE public.partner_stock_movements ADD CONSTRAINT partner_stock_movements_related_order_id_fkey 
  FOREIGN KEY (related_order_id) REFERENCES public.orders(id) ON DELETE SET NULL;