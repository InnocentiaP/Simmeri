-- =========================================================
-- cooking_history
-- =========================================================
CREATE TABLE public.cooking_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipe_id uuid NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  cooked_at timestamptz NOT NULL DEFAULT now(),
  servings_made integer,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cooking_history_servings_positive_check
    CHECK (servings_made IS NULL OR servings_made > 0),
  CONSTRAINT cooking_history_notes_length_check
    CHECK (notes IS NULL OR char_length(notes) <= 4000)
);
CREATE INDEX cooking_history_recipe_cooked_at_idx ON public.cooking_history(recipe_id, cooked_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cooking_history TO authenticated;
GRANT ALL ON public.cooking_history TO service_role;
ALTER TABLE public.cooking_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cooking_history_select_own" ON public.cooking_history FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "cooking_history_insert_own" ON public.cooking_history FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "cooking_history_update_own" ON public.cooking_history FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "cooking_history_delete_own" ON public.cooking_history FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER cooking_history_updated_at BEFORE UPDATE ON public.cooking_history FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Cross-owner integrity: RLS's WITH CHECK (auth.uid() = user_id) only proves
-- the acting row's user_id matches the caller — it does not prove the
-- REFERENCED recipe_id belongs to that same user. Same philosophy as
-- collection_recipes_validate_ownership in the collections migration.
CREATE FUNCTION public.validate_cooking_history_ownership()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.recipes
    WHERE id = NEW.recipe_id AND user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'Recipe not found or not owned by the current user';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER cooking_history_validate_ownership
  BEFORE INSERT OR UPDATE ON public.cooking_history
  FOR EACH ROW EXECUTE FUNCTION public.validate_cooking_history_ownership();

-- =========================================================
-- cooking_photos (insert/delete only — no updated_at, no UPDATE policy)
-- =========================================================
CREATE TABLE public.cooking_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cooking_history_id uuid NOT NULL REFERENCES public.cooking_history(id) ON DELETE CASCADE,
  storage_bucket text NOT NULL,
  storage_path text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cooking_photos_storage_object_unique UNIQUE (storage_bucket, storage_path)
);
CREATE INDEX cooking_photos_history_idx ON public.cooking_photos(cooking_history_id);
GRANT SELECT, INSERT, DELETE ON public.cooking_photos TO authenticated;
GRANT ALL ON public.cooking_photos TO service_role;
ALTER TABLE public.cooking_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cooking_photos_select_own" ON public.cooking_photos FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "cooking_photos_insert_own" ON public.cooking_photos FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "cooking_photos_delete_own" ON public.cooking_photos FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE FUNCTION public.validate_cooking_photo_ownership()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.cooking_history
    WHERE id = NEW.cooking_history_id AND user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'Cooking history entry not found or not owned by the current user';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER cooking_photos_validate_ownership
  BEFORE INSERT ON public.cooking_photos
  FOR EACH ROW EXECUTE FUNCTION public.validate_cooking_photo_ownership();

-- =========================================================
-- recipes.cover_cooking_photo_id — additive column on top of the existing
-- cover_storage_bucket / cover_storage_path / cover_source from Checkpoint 1
-- (none of which are replaced or removed here). Existing recipes RLS
-- policies are untouched; they already cover this new column.
-- =========================================================
ALTER TABLE public.recipes
  ADD COLUMN cover_cooking_photo_id uuid REFERENCES public.cooking_photos(id) ON DELETE SET NULL;

-- A cooking photo may only become a recipe's cover if it belongs to THIS
-- recipe's own cooking history and the same user — not merely "same user,
-- any recipe". ON DELETE SET NULL (above) only clears the FK when the photo
-- row is deleted; it does not by itself stop a user from pointing
-- cover_cooking_photo_id at an unrelated photo, which is what this trigger
-- prevents.
CREATE FUNCTION public.validate_recipe_cover_cooking_photo()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.cover_cooking_photo_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.cooking_photos cp
      JOIN public.cooking_history ch ON ch.id = cp.cooking_history_id
      WHERE cp.id = NEW.cover_cooking_photo_id
        AND ch.user_id = NEW.user_id
        AND ch.recipe_id = NEW.id
    ) THEN
      RAISE EXCEPTION 'Cover cooking photo not found, not owned by the current user, or not associated with this recipe';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER recipes_validate_cover_cooking_photo
  BEFORE INSERT OR UPDATE OF cover_cooking_photo_id ON public.recipes
  FOR EACH ROW EXECUTE FUNCTION public.validate_recipe_cover_cooking_photo();
