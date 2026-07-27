CREATE EXTENSION IF NOT EXISTS citext;

CREATE TABLE public.early_access_signups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email citext NOT NULL UNIQUE,
  source text NOT NULL DEFAULT 'landing_final_cta',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT INSERT ON public.early_access_signups TO anon, authenticated;
GRANT ALL ON public.early_access_signups TO service_role;

ALTER TABLE public.early_access_signups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can join early access"
  ON public.early_access_signups
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);