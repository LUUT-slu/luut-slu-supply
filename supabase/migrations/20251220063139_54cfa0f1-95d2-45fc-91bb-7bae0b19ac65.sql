-- Add seller_id column for alternative login
ALTER TABLE public.seller_profiles 
ADD COLUMN seller_id TEXT UNIQUE;

-- Create function to generate seller ID
CREATE OR REPLACE FUNCTION public.generate_seller_id()
RETURNS TRIGGER AS $$
DECLARE
  new_id TEXT;
  id_exists BOOLEAN;
BEGIN
  LOOP
    -- Generate a random 6-character alphanumeric ID
    new_id := 'S' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 5));
    
    -- Check if it already exists
    SELECT EXISTS(SELECT 1 FROM public.seller_profiles WHERE seller_id = new_id) INTO id_exists;
    
    -- Exit loop if unique
    EXIT WHEN NOT id_exists;
  END LOOP;
  
  NEW.seller_id := new_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger to auto-generate seller_id on insert
CREATE TRIGGER generate_seller_id_trigger
BEFORE INSERT ON public.seller_profiles
FOR EACH ROW
WHEN (NEW.seller_id IS NULL)
EXECUTE FUNCTION public.generate_seller_id();

-- Update existing rows with seller IDs
UPDATE public.seller_profiles 
SET seller_id = 'S' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT || id::TEXT) FROM 1 FOR 5))
WHERE seller_id IS NULL;