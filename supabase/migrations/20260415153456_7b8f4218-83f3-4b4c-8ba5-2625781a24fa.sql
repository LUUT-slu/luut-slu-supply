CREATE TABLE public.analytics_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  product_id text,
  product_name text,
  product_category text,
  seller_id text,
  session_id text,
  user_id uuid,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_analytics_events_type_created ON analytics_events(event_type, created_at);
CREATE INDEX idx_analytics_events_product ON analytics_events(product_id, created_at);
CREATE INDEX idx_analytics_events_session ON analytics_events(session_id);

ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert analytics events"
  ON analytics_events FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can read analytics events"
  ON analytics_events FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));