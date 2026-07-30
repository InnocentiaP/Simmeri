-- =========================================================
-- collections
-- =========================================================
CREATE TABLE public.collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- Supports both "list active collections" (archived_at IS NULL) and
-- "list archived collections" for a given user via the same index.
CREATE INDEX collections_user_archived_idx ON public.collections(user_id, archived_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.collections TO authenticated;
GRANT ALL ON public.collections TO service_role;
ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "collections_select_own" ON public.collections FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "collections_insert_own" ON public.collections FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "collections_update_own" ON public.collections FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "collections_delete_own" ON public.collections FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER collections_updated_at BEFORE UPDATE ON public.collections FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- collection_recipes (join table; insert/delete only, never updated in
-- place, so there is no updated_at column and no UPDATE policy)
-- =========================================================
CREATE TABLE public.collection_recipes (
  collection_id uuid NOT NULL REFERENCES public.collections(id) ON DELETE CASCADE,
  recipe_id uuid NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (collection_id, recipe_id)
);
-- The composite primary key above is what prevents duplicate membership —
-- no separate unique constraint is needed.
CREATE INDEX collection_recipes_recipe_idx ON public.collection_recipes(recipe_id);
CREATE INDEX collection_recipes_user_idx ON public.collection_recipes(user_id);
GRANT SELECT, INSERT, DELETE ON public.collection_recipes TO authenticated;
GRANT ALL ON public.collection_recipes TO service_role;
ALTER TABLE public.collection_recipes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "collection_recipes_select_own" ON public.collection_recipes FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "collection_recipes_insert_own" ON public.collection_recipes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "collection_recipes_delete_own" ON public.collection_recipes FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- =========================================================
-- Cross-owner integrity: RLS alone proves the acting row's user_id matches
-- the caller, but it cannot prove the REFERENCED collection_id/recipe_id
-- belong to that same user — a crafted insert could pair the caller's own
-- collection with another user's recipe id (or vice versa) and still pass
-- `WITH CHECK (auth.uid() = user_id)`, since both FKs would resolve (the
-- rows exist) even though ownership doesn't line up. This trigger closes
-- that gap as defense-in-depth layered on top of RLS, not a replacement for
-- it — the same philosophy already documented in
-- save_recipe_with_details_rpc.sql.
-- =========================================================
CREATE FUNCTION public.validate_collection_recipe_ownership()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.collections
    WHERE id = NEW.collection_id AND user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'Collection not found or not owned by the current user';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.recipes
    WHERE id = NEW.recipe_id AND user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'Recipe not found or not owned by the current user';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER collection_recipes_validate_ownership
  BEFORE INSERT OR UPDATE ON public.collection_recipes
  FOR EACH ROW EXECUTE FUNCTION public.validate_collection_recipe_ownership();
