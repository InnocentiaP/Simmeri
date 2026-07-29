-- Adds recipe-import source provenance columns. Additive and reversible: no
-- existing column, constraint, or RLS policy changes. recipes_select_own /
-- recipes_update_own (auth.uid() = user_id, row-level) already cover these
-- new columns on any row the user owns — no new policy needed.
ALTER TABLE public.recipes
  ADD COLUMN source_url text,
  ADD COLUMN source_title text;
