CREATE TABLE IF NOT EXISTS public.google_tokens (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  refresh_token text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.google_tokens TO authenticated;
GRANT ALL ON public.google_tokens TO service_role;

ALTER TABLE public.google_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own Google tokens" 
ON public.google_tokens 
FOR ALL 
TO authenticated 
USING (auth.uid() = user_id) 
WITH CHECK (auth.uid() = user_id);

ALTER TABLE public.customer_profiles
  ADD COLUMN IF NOT EXISTS calendar_connected boolean NOT NULL DEFAULT false;