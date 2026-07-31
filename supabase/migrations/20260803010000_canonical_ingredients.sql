-- =========================================================
-- canonical_ingredients (Wave 3 Checkpoint 3.1 — see
-- docs/plans/WAVE_3_CANONICAL_INGREDIENTS_AND_RECOMMENDATIONS_PLAN.md)
--
-- Global, read-only-to-normal-users catalog. This is the FIRST globally
-- readable table in this schema — every other table in this database is
-- owner-scoped. Curated exclusively via service_role (this migration's own
-- seed data now; rare, deliberate, out-of-band admin action later). There
-- is deliberately no INSERT/UPDATE/DELETE GRANT to `authenticated` at all,
-- so even a mistakenly-added future policy could never take effect —
-- normal users can only ever SELECT from this table.
--
-- This table is completely inert in this checkpoint: nothing in the
-- running application references it yet. recipe_ingredients and
-- kitchen_items gain no new columns here (that is Checkpoint 3.2).
-- =========================================================
CREATE TABLE public.canonical_ingredients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_key text NOT NULL UNIQUE,
  canonical_name text NOT NULL,
  ingredient_state text,
  category text,
  status text NOT NULL DEFAULT 'active',
  merged_into_id uuid REFERENCES public.canonical_ingredients(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT canonical_ingredients_ingredient_state_check CHECK (
    ingredient_state IS NULL OR ingredient_state IN
      ('raw', 'cooked', 'dried', 'fresh', 'ground', 'whole', 'powder', 'other')
  ),
  CONSTRAINT canonical_ingredients_status_check CHECK (
    status IN ('active', 'deprecated', 'merged')
  )
);

GRANT SELECT ON public.canonical_ingredients TO authenticated;
GRANT ALL ON public.canonical_ingredients TO service_role;
ALTER TABLE public.canonical_ingredients ENABLE ROW LEVEL SECURITY;

-- The one and only policy on this table: every authenticated user may read
-- every row. There is no insert/update/delete policy for `authenticated` —
-- combined with the missing GRANT above, mutation via the authenticated
-- role is structurally impossible, not just discouraged by convention.
CREATE POLICY "canonical_ingredients_select_all" ON public.canonical_ingredients
  FOR SELECT TO authenticated USING (true);

CREATE TRIGGER canonical_ingredients_updated_at
  BEFORE UPDATE ON public.canonical_ingredients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- ingredient_aliases
--
-- Hybrid table: global curated rows (owner_user_id IS NULL, readable by
-- every authenticated user) plus private per-user rows (readable only by
-- their owner). A normal authenticated user can only ever write a row where
-- owner_user_id = auth.uid() — the WITH CHECK/USING clauses below make it
-- structurally impossible to create, edit, or delete a global (NULL-owner)
-- row via the authenticated role, since no real auth.uid() value ever
-- equals NULL. Only service_role (this migration's seed data, or a future
-- deliberate admin action) can ever touch a global row.
--
-- One global alias string maps to at most one canonical ingredient — this
-- is the anti-ambiguity mechanism: a genuinely ambiguous term (e.g. bare
-- "rice") is simply never seeded as a global alias, rather than one alias
-- ever fanning out to multiple candidates. See the two partial unique
-- indexes below.
-- =========================================================
CREATE TABLE public.ingredient_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_ingredient_id uuid NOT NULL REFERENCES public.canonical_ingredients(id) ON DELETE CASCADE,
  normalized_alias text NOT NULL,
  display_alias text NOT NULL,
  language_code text,
  region_code text,
  alias_type text NOT NULL DEFAULT 'synonym',
  confidence real,
  review_status text NOT NULL DEFAULT 'approved',
  source text NOT NULL DEFAULT 'seed',
  owner_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ingredient_aliases_alias_type_check CHECK (
    alias_type IN ('synonym', 'regional', 'plural', 'misspelling', 'abbreviation', 'brand')
  ),
  CONSTRAINT ingredient_aliases_confidence_check CHECK (
    confidence IS NULL OR (confidence >= 0 AND confidence <= 1)
  ),
  CONSTRAINT ingredient_aliases_review_status_check CHECK (
    review_status IN ('pending', 'approved', 'rejected')
  ),
  CONSTRAINT ingredient_aliases_source_check CHECK (
    source IN ('seed', 'user', 'ai_suggested', 'admin')
  )
);

-- Global alias strings are unique (see header comment above).
CREATE UNIQUE INDEX ingredient_aliases_global_alias_unique_idx
  ON public.ingredient_aliases (normalized_alias) WHERE owner_user_id IS NULL;
-- The same per-user guarantee for private aliases: one user can't create
-- two different personal aliases for the identical normalized text either.
CREATE UNIQUE INDEX ingredient_aliases_owner_alias_unique_idx
  ON public.ingredient_aliases (owner_user_id, normalized_alias) WHERE owner_user_id IS NOT NULL;
CREATE INDEX ingredient_aliases_normalized_alias_idx ON public.ingredient_aliases (normalized_alias);
CREATE INDEX ingredient_aliases_canonical_ingredient_idx ON public.ingredient_aliases (canonical_ingredient_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ingredient_aliases TO authenticated;
GRANT ALL ON public.ingredient_aliases TO service_role;
ALTER TABLE public.ingredient_aliases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ingredient_aliases_select_own_or_global" ON public.ingredient_aliases
  FOR SELECT TO authenticated USING (owner_user_id IS NULL OR owner_user_id = auth.uid());
CREATE POLICY "ingredient_aliases_insert_own" ON public.ingredient_aliases
  FOR INSERT TO authenticated WITH CHECK (owner_user_id = auth.uid());
CREATE POLICY "ingredient_aliases_update_own" ON public.ingredient_aliases
  FOR UPDATE TO authenticated USING (owner_user_id = auth.uid()) WITH CHECK (owner_user_id = auth.uid());
CREATE POLICY "ingredient_aliases_delete_own" ON public.ingredient_aliases
  FOR DELETE TO authenticated USING (owner_user_id = auth.uid());

CREATE TRIGGER ingredient_aliases_updated_at
  BEFORE UPDATE ON public.ingredient_aliases
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Note: no ownership-validation trigger is added here, unlike most other
-- child tables in this schema. canonical_ingredients is not itself
-- user-owned, so there is no cross-owner case to defend against for the
-- canonical_ingredient_id FK — the FK constraint (row must exist) is the
-- only integrity requirement. The owner_user_id column has no separate FK
-- validation concern either: it either matches auth.uid() (enforced by the
-- INSERT/UPDATE policies themselves) or is NULL.

-- =========================================================
-- Starter seed data — conservative, curated, global (owner_user_id NULL).
-- Every INSERT is idempotent (ON CONFLICT DO NOTHING), safe to re-run.
--
-- Deliberately NOT seeded: a bare "rice" alias. "Rice" alone is genuinely
-- ambiguous between raw and cooked even in English — see the plan's open
-- question 1 in section P. Only qualified forms are seeded below.
-- Deliberately NOT linked: green onion <-> leek (explicitly flagged
-- uncertain in the product brief — left for a future private, per-user
-- alias only, never a global one).
-- =========================================================

INSERT INTO public.canonical_ingredients (canonical_key, canonical_name, ingredient_state, category)
VALUES
  ('rice_raw',      'Rice (uncooked)',     'raw',    'grain'),
  ('rice_cooked',   'Rice (cooked)',       'cooked', 'grain'),
  ('egg',           'Egg',                 NULL,     'protein'),
  ('green_onion',   'Green Onion',         NULL,     'produce'),
  ('onion',         'Onion',               NULL,     'produce'),
  ('onion_powder',  'Onion Powder',        'powder', 'spice'),
  ('garlic',        'Garlic',              NULL,     'produce'),
  ('garlic_powder', 'Garlic Powder',       'powder', 'spice'),
  ('flour',         'Flour (all-purpose)', NULL,     'baking'),
  ('almond_flour',  'Almond Flour',        NULL,     'baking'),
  ('tomato_fresh',  'Tomato (fresh)',      'fresh',  'produce'),
  ('tomato_canned', 'Canned Tomatoes',     NULL,     'produce'),
  ('tomato_paste',  'Tomato Paste',        NULL,     'condiment'),
  ('milk',          'Milk',                NULL,     'dairy'),
  ('coconut_milk',  'Coconut Milk',        NULL,     'dairy'),
  ('butter',        'Butter',              NULL,     'dairy'),
  ('margarine',     'Margarine',           NULL,     'dairy')
ON CONFLICT (canonical_key) DO NOTHING;

INSERT INTO public.ingredient_aliases (canonical_ingredient_id, normalized_alias, display_alias, language_code, alias_type)
SELECT ci.id, v.normalized_alias, v.display_alias, v.language_code, v.alias_type
FROM (VALUES
  -- rice_raw / rice_cooked — no bare "rice" alias, see header comment above
  ('rice_raw',      'beras',              'beras',              'id', 'synonym'),
  ('rice_raw',      'uncooked rice',      'uncooked rice',      'en', 'synonym'),
  ('rice_raw',      'white rice',         'white rice',         'en', 'synonym'),
  ('rice_cooked',   'nasi',               'nasi',               'id', 'synonym'),
  ('rice_cooked',   'cooked rice',        'cooked rice',        'en', 'synonym'),
  ('rice_cooked',   'steamed rice',       'steamed rice',       'en', 'synonym'),
  -- egg
  ('egg',           'egg',                'egg',                'en', 'synonym'),
  ('egg',           'eggs',               'eggs',               'en', 'plural'),
  -- green_onion — deliberately no alias linking to "leek"
  ('green_onion',   'green onion',        'green onion',        'en', 'synonym'),
  ('green_onion',   'green onions',       'green onions',       'en', 'plural'),
  ('green_onion',   'scallion',           'scallion',           'en', 'regional'),
  ('green_onion',   'scallions',          'scallions',          'en', 'regional'),
  ('green_onion',   'spring onion',       'spring onion',       'en', 'regional'),
  ('green_onion',   'spring onions',      'spring onions',      'en', 'regional'),
  -- onion / onion_powder — kept separate, no alias links them
  ('onion',         'onion',              'onion',              'en', 'synonym'),
  ('onion',         'onions',             'onions',             'en', 'plural'),
  ('onion_powder',  'onion powder',       'onion powder',       'en', 'synonym'),
  -- garlic / garlic_powder — kept separate, no alias links them
  ('garlic',        'garlic',             'garlic',             'en', 'synonym'),
  ('garlic_powder', 'garlic powder',      'garlic powder',      'en', 'synonym'),
  -- flour / almond_flour — kept separate, no alias links them
  ('flour',         'flour',              'flour',              'en', 'synonym'),
  ('flour',         'all-purpose flour',  'all-purpose flour',  'en', 'synonym'),
  ('flour',         'all purpose flour',  'all purpose flour',  'en', 'synonym'),
  ('flour',         'plain flour',        'plain flour',        'en', 'regional'),
  ('almond_flour',  'almond flour',       'almond flour',       'en', 'synonym'),
  -- tomato_fresh / tomato_canned / tomato_paste — three separate rows,
  -- never aliased together
  ('tomato_fresh',  'tomato',             'tomato',             'en', 'synonym'),
  ('tomato_fresh',  'tomatoes',           'tomatoes',           'en', 'plural'),
  ('tomato_canned', 'canned tomatoes',    'canned tomatoes',    'en', 'synonym'),
  ('tomato_canned', 'canned tomato',      'canned tomato',      'en', 'synonym'),
  ('tomato_canned', 'tinned tomatoes',    'tinned tomatoes',    'en', 'regional'),
  ('tomato_paste',  'tomato paste',       'tomato paste',       'en', 'synonym'),
  -- milk / coconut_milk — kept separate, no alias links them
  ('milk',          'milk',               'milk',               'en', 'synonym'),
  ('coconut_milk',  'coconut milk',       'coconut milk',       'en', 'synonym'),
  -- butter / margarine — kept separate, no alias links them
  ('butter',        'butter',             'butter',             'en', 'synonym'),
  ('margarine',     'margarine',          'margarine',          'en', 'synonym')
) AS v(canonical_key, normalized_alias, display_alias, language_code, alias_type)
JOIN public.canonical_ingredients ci ON ci.canonical_key = v.canonical_key
ON CONFLICT (normalized_alias) WHERE owner_user_id IS NULL DO NOTHING;
