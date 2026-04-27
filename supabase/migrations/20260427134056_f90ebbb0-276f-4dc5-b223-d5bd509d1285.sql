-- 1. Extend customer_profiles for social login + Shopify sync
ALTER TABLE public.customer_profiles
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS auth_provider text DEFAULT 'email',
  ADD COLUMN IF NOT EXISTS shopify_customer_id text,
  ADD COLUMN IF NOT EXISTS phone_prompt_dismissed_at timestamp with time zone;

-- 2. Replace handle_new_customer trigger function to capture social metadata
CREATE OR REPLACE FUNCTION public.handle_new_customer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_full_name text;
  v_avatar text;
  v_provider text;
BEGIN
  v_full_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    NULL
  );
  v_avatar := COALESCE(
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.raw_user_meta_data->>'picture',
    NULL
  );
  v_provider := COALESCE(
    NEW.raw_app_meta_data->>'provider',
    'email'
  );

  INSERT INTO public.customer_profiles (user_id, email, full_name, avatar_url, auth_provider, signup_source)
  VALUES (NEW.id, NEW.email, v_full_name, v_avatar, v_provider, v_provider)
  ON CONFLICT (user_id) DO UPDATE
  SET
    email = COALESCE(public.customer_profiles.email, EXCLUDED.email),
    full_name = COALESCE(public.customer_profiles.full_name, EXCLUDED.full_name),
    avatar_url = COALESCE(public.customer_profiles.avatar_url, EXCLUDED.avatar_url),
    auth_provider = COALESCE(public.customer_profiles.auth_provider, EXCLUDED.auth_provider);

  RETURN NEW;
END;
$function$;

-- Make sure the trigger exists on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created_customer ON auth.users;
CREATE TRIGGER on_auth_user_created_customer
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_customer();

-- 3. Unique constraint on customer_tags(user_id, tag) for idempotent interest tagging
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'customer_tags_user_tag_unique'
  ) THEN
    ALTER TABLE public.customer_tags
      ADD CONSTRAINT customer_tags_user_tag_unique UNIQUE (user_id, tag);
  END IF;
END$$;