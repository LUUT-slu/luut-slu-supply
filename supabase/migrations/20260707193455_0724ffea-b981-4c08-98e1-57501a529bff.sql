
CREATE OR REPLACE FUNCTION public.normalize_phone(p text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE d text;
BEGIN
  IF p IS NULL THEN RETURN NULL; END IF;
  d := regexp_replace(p, '\D', '', 'g');
  IF length(d) = 0 THEN RETURN NULL; END IF;
  IF length(d) = 7 THEN RETURN '+1758' || d; END IF;
  IF length(d) = 10 THEN RETURN '+1' || d; END IF;
  IF length(d) = 11 AND left(d, 1) = '1' THEN RETURN '+' || d; END IF;
  IF left(p, 1) = '+' THEN RETURN p; END IF;
  RETURN '+' || d;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_normalize_customer_phone()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.phone IS NOT NULL THEN
    NEW.phone := public.normalize_phone(NEW.phone);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS normalize_customer_phone ON public.customer_profiles;
CREATE TRIGGER normalize_customer_phone
  BEFORE INSERT OR UPDATE OF phone ON public.customer_profiles
  FOR EACH ROW EXECUTE FUNCTION public.trg_normalize_customer_phone();

-- Backfill existing rows
UPDATE public.customer_profiles
SET phone = public.normalize_phone(phone)
WHERE phone IS NOT NULL
  AND phone IS DISTINCT FROM public.normalize_phone(phone);

-- Resolve duplicates created by normalization: keep the oldest profile's phone; NULL the rest
WITH ranked AS (
  SELECT user_id,
    row_number() OVER (PARTITION BY phone ORDER BY created_at ASC NULLS LAST, user_id) AS rn
  FROM public.customer_profiles
  WHERE phone IS NOT NULL
)
UPDATE public.customer_profiles cp
SET phone = NULL
FROM ranked r
WHERE cp.user_id = r.user_id AND r.rn > 1;

-- Partial unique index on normalized phone
CREATE UNIQUE INDEX IF NOT EXISTS customer_profiles_phone_unique
  ON public.customer_profiles(phone)
  WHERE phone IS NOT NULL;
