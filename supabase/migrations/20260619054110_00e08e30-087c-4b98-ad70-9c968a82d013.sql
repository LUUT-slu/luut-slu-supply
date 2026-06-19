
DROP TRIGGER IF EXISTS trg_send_seller_welcome_email ON public.seller_profiles;
DROP TRIGGER IF EXISTS trg_seller_welcome_email ON public.seller_profiles;
DROP FUNCTION IF EXISTS public.handle_seller_profile_welcome_email() CASCADE;
