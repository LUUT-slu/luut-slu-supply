
CREATE POLICY "Anyone can view approved product reviews"
ON public.reviews
FOR SELECT
USING (status = 'approved' AND product_handle IS NOT NULL);
