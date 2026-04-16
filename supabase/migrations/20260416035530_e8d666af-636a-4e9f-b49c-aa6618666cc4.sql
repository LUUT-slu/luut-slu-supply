
-- AI usage tracking table for rate limiting and admin visibility
CREATE TABLE public.ai_usage_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  feature text NOT NULL,
  tokens_used integer DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;

-- Sellers can view their own usage
CREATE POLICY "Users can view own AI usage"
  ON public.ai_usage_logs FOR SELECT
  USING (auth.uid() = user_id);

-- Anyone authenticated can insert (edge function does this server-side)
CREATE POLICY "Authenticated users can insert AI usage"
  ON public.ai_usage_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Admins can view all usage
CREATE POLICY "Admins can view all AI usage"
  ON public.ai_usage_logs FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Index for rate limiting queries
CREATE INDEX idx_ai_usage_user_created ON public.ai_usage_logs (user_id, created_at DESC);
CREATE INDEX idx_ai_usage_feature ON public.ai_usage_logs (feature);
