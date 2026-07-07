
-- 1. Make customer_profiles.user_id nullable so shadow profiles can exist
ALTER TABLE public.customer_profiles ALTER COLUMN user_id DROP NOT NULL;

-- 2. Claim columns
ALTER TABLE public.customer_profiles
  ADD COLUMN IF NOT EXISTS claim_token text,
  ADD COLUMN IF NOT EXISTS claim_token_issued_at timestamptz,
  ADD COLUMN IF NOT EXISTS claimed_at timestamptz,
  ADD COLUMN IF NOT EXISTS claim_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS claim_locked_until timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS customer_profiles_claim_token_unique
  ON public.customer_profiles(claim_token)
  WHERE claim_token IS NOT NULL;

-- 3. Add customer_profile_id to orders for phone-based linking
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS customer_profile_id uuid REFERENCES public.customer_profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS orders_customer_profile_id_idx ON public.orders(customer_profile_id);

-- 4. Ensure/create a customer_profile for a phone (shadow if no auth user)
CREATE OR REPLACE FUNCTION public.ensure_customer_profile_for_order(
  p_phone text,
  p_name text,
  p_email text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_norm text;
  v_profile_id uuid;
  v_token text;
BEGIN
  v_norm := public.normalize_phone(p_phone);
  IF v_norm IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT id INTO v_profile_id
  FROM public.customer_profiles
  WHERE phone = v_norm
  ORDER BY (user_id IS NOT NULL) DESC, created_at ASC
  LIMIT 1;

  IF v_profile_id IS NOT NULL THEN
    -- Fill blanks; never overwrite existing name/email
    UPDATE public.customer_profiles
    SET full_name = COALESCE(full_name, NULLIF(p_name,'')),
        email     = COALESCE(email,     NULLIF(p_email,'')),
        updated_at = now()
    WHERE id = v_profile_id;
    RETURN v_profile_id;
  END IF;

  -- Create a shadow profile (no user_id yet)
  v_token := encode(extensions.gen_random_bytes(24), 'hex');
  INSERT INTO public.customer_profiles (user_id, phone, full_name, email, signup_source, claim_token, claim_token_issued_at)
  VALUES (NULL, v_norm, NULLIF(p_name,''), NULLIF(p_email,''), 'order_shadow', v_token, now())
  RETURNING id INTO v_profile_id;

  RETURN v_profile_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_customer_profile_for_order(text, text, text) TO service_role;

-- 5. Trigger on orders to auto-link by phone on insert/update
CREATE OR REPLACE FUNCTION public.trg_orders_link_customer_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id uuid;
  v_user_id uuid;
BEGIN
  IF NEW.customer_phone IS NULL OR length(trim(NEW.customer_phone)) = 0 THEN
    RETURN NEW;
  END IF;

  -- Normalize on the row too
  NEW.customer_phone := public.normalize_phone(NEW.customer_phone);

  v_profile_id := public.ensure_customer_profile_for_order(
    NEW.customer_phone, NEW.customer_name, NEW.customer_email
  );

  IF v_profile_id IS NOT NULL THEN
    NEW.customer_profile_id := v_profile_id;
    SELECT user_id INTO v_user_id FROM public.customer_profiles WHERE id = v_profile_id;
    IF v_user_id IS NOT NULL AND NEW.customer_user_id IS NULL THEN
      NEW.customer_user_id := v_user_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_link_customer_profile ON public.orders;
CREATE TRIGGER orders_link_customer_profile
  BEFORE INSERT OR UPDATE OF customer_phone, customer_name, customer_email ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.trg_orders_link_customer_profile();

-- 6. Backfill existing orders: link them to shadow profiles by phone
DO $$
DECLARE r record; v_pid uuid;
BEGIN
  FOR r IN
    SELECT id, customer_phone, customer_name, customer_email, customer_user_id
    FROM public.orders
    WHERE customer_profile_id IS NULL AND customer_phone IS NOT NULL
  LOOP
    v_pid := public.ensure_customer_profile_for_order(r.customer_phone, r.customer_name, r.customer_email);
    IF v_pid IS NOT NULL THEN
      UPDATE public.orders SET customer_profile_id = v_pid WHERE id = r.id;
    END IF;
  END LOOP;
END $$;

-- Attach existing customer_user_id to matching shadow (if orders already have a user)
UPDATE public.customer_profiles cp
SET user_id = o.customer_user_id, claimed_at = COALESCE(cp.claimed_at, now()), claim_token = NULL
FROM public.orders o
WHERE cp.id = o.customer_profile_id
  AND cp.user_id IS NULL
  AND o.customer_user_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.customer_profiles cp2 WHERE cp2.user_id = o.customer_user_id);

-- 7. Update handle_new_customer to attach shadow profile by phone if present
CREATE OR REPLACE FUNCTION public.handle_new_customer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_full_name text;
  v_avatar text;
  v_provider text;
  v_phone text;
  v_shadow_id uuid;
BEGIN
  v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', NULL);
  v_avatar := COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture', NULL);
  v_provider := COALESCE(NEW.raw_app_meta_data->>'provider', 'email');
  v_phone := public.normalize_phone(COALESCE(NEW.phone, NEW.raw_user_meta_data->>'phone'));

  -- Try to attach an existing shadow profile by phone
  IF v_phone IS NOT NULL THEN
    SELECT id INTO v_shadow_id
    FROM public.customer_profiles
    WHERE phone = v_phone AND user_id IS NULL
    LIMIT 1;

    IF v_shadow_id IS NOT NULL THEN
      UPDATE public.customer_profiles
      SET user_id = NEW.id,
          email = COALESCE(email, NEW.email),
          full_name = COALESCE(full_name, v_full_name),
          avatar_url = COALESCE(avatar_url, v_avatar),
          auth_provider = COALESCE(auth_provider, v_provider),
          claim_token = NULL,
          claim_attempts = 0,
          claim_locked_until = NULL,
          claimed_at = now(),
          updated_at = now()
      WHERE id = v_shadow_id;

      -- Attach any orders with matching phone to this user
      UPDATE public.orders
      SET customer_user_id = NEW.id, updated_at = now()
      WHERE customer_phone = v_phone AND customer_user_id IS NULL;

      RETURN NEW;
    END IF;
  END IF;

  INSERT INTO public.customer_profiles (user_id, email, full_name, avatar_url, auth_provider, signup_source, phone)
  VALUES (NEW.id, NEW.email, v_full_name, v_avatar, v_provider, v_provider, v_phone)
  ON CONFLICT (user_id) DO UPDATE
  SET email = COALESCE(public.customer_profiles.email, EXCLUDED.email),
      full_name = COALESCE(public.customer_profiles.full_name, EXCLUDED.full_name),
      avatar_url = COALESCE(public.customer_profiles.avatar_url, EXCLUDED.avatar_url),
      auth_provider = COALESCE(public.customer_profiles.auth_provider, EXCLUDED.auth_provider);

  RETURN NEW;
END;
$$;

-- 8. Claim attempts audit log
CREATE TABLE IF NOT EXISTS public.claim_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid REFERENCES public.customer_profiles(id) ON DELETE CASCADE,
  token_prefix text,
  ok boolean NOT NULL,
  ip text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.claim_attempts TO service_role;
ALTER TABLE public.claim_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view claim attempts" ON public.claim_attempts
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
