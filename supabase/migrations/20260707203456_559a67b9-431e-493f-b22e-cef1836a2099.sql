-- 1. Sequential placeholder counter
CREATE SEQUENCE IF NOT EXISTS public.luut_customer_placeholder_seq START WITH 1;
GRANT USAGE, SELECT ON SEQUENCE public.luut_customer_placeholder_seq TO authenticated, service_role;

-- 2. Placeholder generator — returns strings like "Luut Customer #47"
CREATE OR REPLACE FUNCTION public.next_luut_customer_placeholder()
RETURNS text
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 'Luut Customer #' || nextval('public.luut_customer_placeholder_seq')::text;
$$;

GRANT EXECUTE ON FUNCTION public.next_luut_customer_placeholder() TO authenticated, service_role, anon;

-- 3. Phone-like name detector
CREATE OR REPLACE FUNCTION public.is_phone_like_name(p text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT p IS NOT NULL
     AND btrim(p) ~ '^[\d\s\-().+]+$'
     AND length(regexp_replace(p, '\D', '', 'g')) >= 7;
$$;

-- 4. Harden phone normalizer against pasted invisibles / NBSP / fancy dashes.
--    Postgres regex \D already drops these, but we also strip them from the
--    "starts with +" branch so the branching itself doesn't get fooled.
CREATE OR REPLACE FUNCTION public.normalize_phone(p text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $function$
DECLARE
  cleaned text;
  d text;
BEGIN
  IF p IS NULL THEN RETURN NULL; END IF;
  -- Strip zero-width, bidi marks, BOM, NBSP variants, and normalize dashes.
  cleaned := regexp_replace(
    p,
    '[\u00A0\u00AD\u180E\u2000-\u200F\u202A-\u202F\u205F\u2060-\u2064\u2066-\u2069\u3000\uFEFF]',
    '',
    'g'
  );
  cleaned := btrim(cleaned);
  d := regexp_replace(cleaned, '\D', '', 'g');
  IF length(d) = 0 THEN RETURN NULL; END IF;
  IF length(d) = 7 THEN RETURN '+1758' || d; END IF;
  IF length(d) = 10 THEN RETURN '+1' || d; END IF;
  IF length(d) = 11 AND left(d, 1) = '1' THEN RETURN '+' || d; END IF;
  IF left(cleaned, 1) = '+' THEN RETURN '+' || d; END IF;
  RETURN '+' || d;
END;
$function$;

-- 5. Update the shadow-profile linker to auto-assign a placeholder when the
--    incoming name is blank OR is just a phone number. Existing profile names
--    are still never overwritten (COALESCE preserves manual edits).
CREATE OR REPLACE FUNCTION public.ensure_customer_profile_for_order(
  p_phone text,
  p_name text,
  p_email text DEFAULT NULL::text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_norm text;
  v_profile_id uuid;
  v_token text;
  v_name text;
BEGIN
  v_norm := public.normalize_phone(p_phone);
  IF v_norm IS NULL THEN
    RETURN NULL;
  END IF;

  -- Compute the name we'd persist for a NEW shadow profile:
  --   • blank / whitespace name  → placeholder
  --   • name that's just a phone → placeholder
  --   • otherwise use as-is
  v_name := NULLIF(btrim(COALESCE(p_name, '')), '');
  IF v_name IS NULL OR public.is_phone_like_name(v_name) THEN
    v_name := public.next_luut_customer_placeholder();
  END IF;

  SELECT id INTO v_profile_id
  FROM public.customer_profiles
  WHERE phone = v_norm
  ORDER BY (user_id IS NOT NULL) DESC, created_at ASC
  LIMIT 1;

  IF v_profile_id IS NOT NULL THEN
    -- Fill blanks; never overwrite existing name/email. This is what protects
    -- your manual edits from being clobbered by future syncs.
    UPDATE public.customer_profiles
    SET full_name = COALESCE(full_name, v_name),
        email     = COALESCE(email, NULLIF(p_email,'')),
        updated_at = now()
    WHERE id = v_profile_id;
    RETURN v_profile_id;
  END IF;

  v_token := encode(extensions.gen_random_bytes(24), 'hex');
  INSERT INTO public.customer_profiles (
    user_id, phone, full_name, email, signup_source,
    claim_token, claim_token_issued_at
  )
  VALUES (
    NULL, v_norm, v_name, NULLIF(p_email,''), 'order_shadow',
    v_token, now()
  )
  RETURNING id INTO v_profile_id;

  RETURN v_profile_id;
END;
$function$;

-- 6. Seed the sequence past the existing "Walk-in Customer" backlog so new
--    placeholders start clean at #1 for actual future customers.
SELECT setval('public.luut_customer_placeholder_seq', 1, false);