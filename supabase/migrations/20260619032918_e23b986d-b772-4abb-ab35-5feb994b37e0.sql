DROP POLICY IF EXISTS "Authenticated users can upload to seller-assets" ON storage.objects;

CREATE POLICY "Sellers can upload own seller-assets"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'seller-assets'
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    -- reviews/* open to any signed-in user (matches existing public review-upload policy)
    OR (storage.foldername(name))[1] = 'reviews'
    -- logos/{user_id}-logo-*  owned by uploader
    OR name LIKE ('logos/' || (auth.uid())::text || '-logo-%')
    -- products/{seller_profile_id}-*  owned by uploader's seller profile
    OR EXISTS (
      SELECT 1 FROM public.seller_profiles sp
      WHERE sp.user_id = auth.uid()
        AND storage.objects.name LIKE ('products/' || (sp.id)::text || '-%')
    )
  )
);