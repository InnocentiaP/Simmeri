-- =========================================================
-- Phase 1 — cooking loop: per-cook rating + recipe favorites.
-- Purely additive: two nullable columns, one partial index. Existing
-- owner-only RLS policies on cooking_history and recipes already cover the
-- new columns (RLS is row-level), so no policy changes are needed.
-- =========================================================

-- How a specific cook turned out. Belongs to the cooking event, not the
-- recipe: the same recipe can be "loved" one time and "meh" the next.
-- text + CHECK, matching every other constrained-value column in this schema.
ALTER TABLE public.cooking_history
  ADD COLUMN rating text,
  ADD CONSTRAINT cooking_history_rating_check
    CHECK (rating IS NULL OR rating IN ('loved', 'good', 'meh'));

-- Favorite flag as a timestamp (NULL = not a favorite) so "favorited most
-- recently" ordering is available later without another migration.
-- save_recipe_with_details only updates the columns it names, so editing a
-- recipe never clears this.
ALTER TABLE public.recipes
  ADD COLUMN favorited_at timestamptz;

CREATE INDEX recipes_user_favorited_idx
  ON public.recipes(user_id)
  WHERE favorited_at IS NOT NULL;

-- Rollback:
--   DROP INDEX public.recipes_user_favorited_idx;
--   ALTER TABLE public.recipes DROP COLUMN favorited_at;
--   ALTER TABLE public.cooking_history DROP CONSTRAINT cooking_history_rating_check,
--     DROP COLUMN rating;
