-- Create orders table for storing meetup orders
CREATE TABLE public.orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_number SERIAL,
  customer_name TEXT NOT NULL,
  location TEXT NOT NULL,
  preferred_date TEXT NOT NULL,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  total_price DECIMAL(10,2) NOT NULL,
  currency_code TEXT NOT NULL DEFAULT 'XCD',
  line_items JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Allow anyone to create orders (customers don't need auth)
CREATE POLICY "Anyone can create orders"
ON public.orders
FOR INSERT
WITH CHECK (true);

-- Allow anyone to view orders by ID (for confirmation page)
CREATE POLICY "Anyone can view orders"
ON public.orders
FOR SELECT
USING (true);

-- Create function to format order number
CREATE OR REPLACE FUNCTION public.format_order_number(order_num INTEGER)
RETURNS TEXT AS $$
BEGIN
  RETURN '#L' || LPAD(order_num::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create trigger to update updated_at
CREATE OR REPLACE FUNCTION public.update_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_orders_updated_at
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.update_orders_updated_at();