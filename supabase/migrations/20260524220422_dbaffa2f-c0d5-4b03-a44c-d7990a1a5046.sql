-- Remove public/anon and broad authenticated access to seller_profiles base table
-- so that phone, whatsapp, owner_email, and document_url are no longer exposed.
-- Public listings continue to use the public_seller_profiles view, which excludes
-- all contact/document columns. Sellers can still see their own profile, and
-- admins keep full access via their existing policies. Seller contact details
-- for legitimate buyer/seller flows are retrieved through the existing
-- rpc_get_seller_contact() SECURITY DEFINER function.

DROP POLICY IF EXISTS "Public can view approved seller profiles" ON public.seller_profiles;
DROP POLICY IF EXISTS "Authenticated users can view approved seller contact" ON public.seller_profiles;

-- Make sure the safe public view is readable by anonymous and signed-in visitors
GRANT SELECT ON public.public_seller_profiles TO anon, authenticated;