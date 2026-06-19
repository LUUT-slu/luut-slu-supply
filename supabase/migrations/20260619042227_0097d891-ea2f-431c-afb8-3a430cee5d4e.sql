
-- Trigger: send LUUT seller welcome email when a seller_profiles row is inserted.
-- Calls the send-seller-welcome-email edge function via pg_net. Fire-and-forget; failures never block the insert.

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.handle_seller_profile_welcome_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  fn_url text := 'https://brwnjlsdovqlkbtkhsye.supabase.co/functions/v1/send-seller-welcome-email';
  anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJyd25qbHNkb3ZxbGtidGtoc3llIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYxODY1MDQsImV4cCI6MjA4MTc2MjUwNH0.6ifYvbaK9EIDeDd46arNnZaEixh2Ca2E115GJFXKQH0';
BEGIN
  BEGIN
    PERFORM net.http_post(
      url := fn_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || anon_key
      ),
      body := jsonb_build_object(
        'sellerId', NEW.id,
        'userId', NEW.user_id,
        'email', NEW.owner_email
      )
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'seller welcome email dispatch failed: %', SQLERRM;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_send_seller_welcome_email ON public.seller_profiles;
CREATE TRIGGER trg_send_seller_welcome_email
AFTER INSERT ON public.seller_profiles
FOR EACH ROW EXECUTE FUNCTION public.handle_seller_profile_welcome_email();
