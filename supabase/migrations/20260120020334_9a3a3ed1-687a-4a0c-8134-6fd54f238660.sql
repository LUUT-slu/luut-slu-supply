-- Add missing columns to orders table for seller order management
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS pickup_time text,
ADD COLUMN IF NOT EXISTS seller_notes text,
ADD COLUMN IF NOT EXISTS last_edited_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS last_edited_by uuid;

-- Create RLS policy for sellers to view orders containing their items
CREATE POLICY "Sellers can view orders containing their items"
ON public.orders FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.order_items oi
    JOIN public.seller_profiles sp ON sp.id = oi.seller_id
    WHERE oi.order_id = orders.id 
    AND sp.user_id = auth.uid()
  )
);

-- Create RLS policy for sellers to update orders containing their items
CREATE POLICY "Sellers can update orders containing their items"
ON public.orders FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.order_items oi
    JOIN public.seller_profiles sp ON sp.id = oi.seller_id
    WHERE oi.order_id = orders.id 
    AND sp.user_id = auth.uid()
  )
);

-- Sellers can update their own order items (qty changes)
CREATE POLICY "Sellers can update own order items"
ON public.order_items FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.seller_profiles sp
    WHERE sp.id = order_items.seller_id
    AND sp.user_id = auth.uid()
  )
);

-- Sellers can delete their own order items
CREATE POLICY "Sellers can delete own order items"
ON public.order_items FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.seller_profiles sp
    WHERE sp.id = order_items.seller_id
    AND sp.user_id = auth.uid()
  )
);