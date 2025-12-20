-- Fix security warnings by setting search_path on functions
CREATE OR REPLACE FUNCTION public.format_order_number(order_num INTEGER)
RETURNS TEXT AS $$
BEGIN
  RETURN '#L' || LPAD(order_num::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql IMMUTABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.update_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;