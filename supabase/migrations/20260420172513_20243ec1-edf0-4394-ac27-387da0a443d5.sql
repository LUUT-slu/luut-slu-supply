-- Customer tags / interests
CREATE TABLE public.customer_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  tag text NOT NULL,
  tag_type text NOT NULL DEFAULT 'tag',
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  UNIQUE (user_id, tag, tag_type)
);
ALTER TABLE public.customer_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage customer tags" ON public.customer_tags
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE INDEX idx_customer_tags_user_id ON public.customer_tags(user_id);

-- Admin-only customer notes
CREATE TABLE public.customer_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  note text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL
);
ALTER TABLE public.customer_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage customer notes" ON public.customer_notes
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE INDEX idx_customer_notes_user_id ON public.customer_notes(user_id);

-- Referrals
CREATE TABLE public.customer_referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id uuid NOT NULL,
  referral_code text NOT NULL UNIQUE,
  referred_user_id uuid,
  referred_email text,
  status text NOT NULL DEFAULT 'pending',
  reward_granted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  rewarded_at timestamptz
);
ALTER TABLE public.customer_referrals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage referrals" ON public.customer_referrals
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users view own referrals" ON public.customer_referrals
  FOR SELECT USING (auth.uid() = referrer_user_id);
CREATE INDEX idx_customer_referrals_referrer ON public.customer_referrals(referrer_user_id);

-- Track last admin contact + signup source
ALTER TABLE public.customer_profiles
  ADD COLUMN IF NOT EXISTS last_contacted_at timestamptz,
  ADD COLUMN IF NOT EXISTS signup_source text;