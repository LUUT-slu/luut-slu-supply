-- Server-side storage for Google OAuth refresh tokens.
-- No user-facing RLS policies — only service_role can read/write this table.
CREATE TABLE IF NOT EXISTS public.google_tokens (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  refresh_token text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.google_tokens ENABLE ROW LEVEL SECURITY;
-- Intentionally no user policies — service_role bypasses RLS automatically.

-- Lightweight flag so the UI can show "Calendar connected" without exposing the token.
ALTER TABLE public.customer_profiles
  ADD COLUMN IF NOT EXISTS calendar_connected boolean NOT NULL DEFAULT false;
