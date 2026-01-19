-- Add RLS policy for partners to view order items for their assigned orders
CREATE POLICY "Partners can view items for assigned orders" 
ON order_items
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM orders o 
    WHERE o.id = order_items.order_id 
    AND o.assigned_partner_id = auth.uid()
  )
);