-- Add UPDATE policy for orders table so admin can update order status
CREATE POLICY "Anyone can update orders"
ON public.orders
FOR UPDATE
USING (true)
WITH CHECK (true);