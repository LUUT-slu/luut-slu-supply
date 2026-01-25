-- Drop the vulnerable policy that only checks token existence
DROP POLICY IF EXISTS "Order items viewable with order token" ON order_items;

-- Create a secure policy that verifies the actual token value
-- This checks if the order's token matches what's passed in the request header
CREATE POLICY "Order items viewable with matching order token"
ON order_items FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM orders o 
    WHERE o.id = order_items.order_id 
    AND o.order_token IS NOT NULL
    AND o.order_token = COALESCE(
      current_setting('request.headers', true)::json->>'order-token',
      current_setting('request.headers', true)::json->>'x-order-token'
    )
  )
);