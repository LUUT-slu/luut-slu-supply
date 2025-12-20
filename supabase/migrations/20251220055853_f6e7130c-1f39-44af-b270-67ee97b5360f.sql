-- Allow deletion of orders (for admin purposes)
CREATE POLICY "Anyone can delete orders" 
ON public.orders 
FOR DELETE 
USING (true);