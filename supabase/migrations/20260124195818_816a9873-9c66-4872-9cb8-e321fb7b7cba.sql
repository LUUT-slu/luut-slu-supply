-- Fix infinite recursion in seller RLS policies
-- The issue: orders policy checks order_items, order_items policy checks orders = infinite loop

-- Drop the problematic policies
DROP POLICY IF EXISTS "Sellers can view orders containing their items" ON public.orders;
DROP POLICY IF EXISTS "Sellers can update orders containing their items" ON public.orders;
DROP POLICY IF EXISTS "Sellers can view own order items" ON public.order_items;
DROP POLICY IF EXISTS "Sellers can update own order items" ON public.order_items;
DROP POLICY IF EXISTS "Sellers can delete own order items" ON public.order_items;

-- Create a SECURITY DEFINER function to check if user is seller for an order
-- This bypasses RLS when checking, preventing recursion
CREATE OR REPLACE FUNCTION public.is_seller_for_order(p_order_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM order_items oi
    JOIN seller_profiles sp ON sp.id = oi.seller_id
    WHERE oi.order_id = p_order_id 
    AND sp.user_id = auth.uid()
  )
$$;

-- Create a SECURITY DEFINER function to check if user is seller for an order item
CREATE OR REPLACE FUNCTION public.is_seller_for_order_item(p_seller_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM seller_profiles sp
    WHERE sp.id = p_seller_id 
    AND sp.user_id = auth.uid()
  )
$$;

-- Recreate orders policies using the security definer function
CREATE POLICY "Sellers can view orders containing their items"
ON public.orders FOR SELECT
USING (is_seller_for_order(id));

CREATE POLICY "Sellers can update orders containing their items"
ON public.orders FOR UPDATE
USING (is_seller_for_order(id));

-- Recreate order_items policies using the security definer function
CREATE POLICY "Sellers can view own order items"
ON public.order_items FOR SELECT
USING (is_seller_for_order_item(seller_id));

CREATE POLICY "Sellers can update own order items"
ON public.order_items FOR UPDATE
USING (is_seller_for_order_item(seller_id));

CREATE POLICY "Sellers can delete own order items"
ON public.order_items FOR DELETE
USING (is_seller_for_order_item(seller_id));