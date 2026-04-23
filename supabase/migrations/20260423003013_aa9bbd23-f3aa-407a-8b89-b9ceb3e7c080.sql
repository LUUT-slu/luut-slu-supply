-- Restore anonymous read access to approved seller profiles.
-- Sensitive columns (whatsapp, phone, owner_email, document_url) remain protected
-- via the public_seller_profiles view (which excludes them) and rpc_get_seller_contact.

CREATE POLICY "Public can view approved seller profiles"
  ON public.seller_profiles
  FOR SELECT
  TO anon
  USING (is_approved = true);

-- Ensure the public view is selectable by both anon and authenticated roles.
GRANT SELECT ON public.public_seller_profiles TO anon, authenticated;