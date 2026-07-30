-- =========================================================
-- shopping_item_sources (insert/delete only — no updated_at, no UPDATE
-- policy, matching the collection_recipes/cooking_photos precedent)
--
-- Provenance for generated shopping items. recipe_id/meal_plan_entry_id are
-- independently nullable (ON DELETE SET NULL) — generated items are
-- immutable snapshots, so deleting the source recipe or meal-plan entry
-- must never delete or corrupt an already-generated shopping item; only the
-- live FK link is cleared, while the *_snapshot columns keep the
-- provenance text readable forever. Manually-added shopping items simply
-- have zero rows here (no row = manual).
--
-- IMPORTANT: there is deliberately NO "at least one live FK" CHECK here
-- (e.g. recipe_id IS NOT NULL OR meal_plan_entry_id IS NOT NULL). A
-- direct-recipe source always has meal_plan_entry_id = NULL from the start;
-- when its recipe is later deleted, ON DELETE SET NULL sets recipe_id to
-- NULL too, leaving BOTH ids null. A "must have at least one origin" CHECK
-- would reject that resulting row, and since the SET NULL update happens
-- inside the same transaction as the recipe DELETE, the constraint
-- violation would roll back the recipe deletion itself — silently blocking
-- users from deleting a recipe that was ever used to generate a shopping
-- item. The durable invariant instead lives on recipe_title_snapshot below:
-- every source always keeps a non-blank snapshot of the recipe it came
-- from, independent of whether either live FK survives.
-- =========================================================
CREATE TABLE public.shopping_item_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shopping_list_item_id uuid NOT NULL REFERENCES public.shopping_list_items(id) ON DELETE CASCADE,
  recipe_id uuid REFERENCES public.recipes(id) ON DELETE SET NULL,
  recipe_title_snapshot text NOT NULL,
  meal_plan_entry_id uuid REFERENCES public.meal_plan_entries(id) ON DELETE SET NULL,
  planned_date_snapshot date,
  meal_type_snapshot text,
  raw_quantity_text text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT shopping_item_sources_title_snapshot_not_blank_check
    CHECK (btrim(recipe_title_snapshot) <> '')
);
CREATE INDEX shopping_item_sources_item_idx ON public.shopping_item_sources(shopping_list_item_id);
CREATE INDEX shopping_item_sources_recipe_idx ON public.shopping_item_sources(recipe_id);
CREATE INDEX shopping_item_sources_entry_idx ON public.shopping_item_sources(meal_plan_entry_id);

GRANT SELECT, INSERT, DELETE ON public.shopping_item_sources TO authenticated;
GRANT ALL ON public.shopping_item_sources TO service_role;
ALTER TABLE public.shopping_item_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shopping_item_sources_select_own" ON public.shopping_item_sources FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "shopping_item_sources_insert_own" ON public.shopping_item_sources FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "shopping_item_sources_delete_own" ON public.shopping_item_sources FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Cross-owner integrity: RLS's WITH CHECK (auth.uid() = user_id) only proves
-- the acting row's user_id matches the caller — it does not prove the
-- REFERENCED shopping_list_item_id/recipe_id/meal_plan_entry_id belong to
-- that same user. Same philosophy as validate_shopping_list_item_ownership /
-- validate_meal_plan_entry_ownership in prior migrations. Each nullable
-- origin is checked independently, only when present.
CREATE FUNCTION public.validate_shopping_item_source_ownership()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.shopping_list_items
    WHERE id = NEW.shopping_list_item_id AND user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'Shopping list item not found or not owned by the current user';
  END IF;

  IF NEW.recipe_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.recipes
    WHERE id = NEW.recipe_id AND user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'Recipe not found or not owned by the current user';
  END IF;

  IF NEW.meal_plan_entry_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.meal_plan_entries
    WHERE id = NEW.meal_plan_entry_id AND user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'Meal plan entry not found or not owned by the current user';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER shopping_item_sources_validate_ownership
  BEFORE INSERT ON public.shopping_item_sources
  FOR EACH ROW EXECUTE FUNCTION public.validate_shopping_item_source_ownership();

-- =========================================================
-- generate_shopping_list_items — transactional multi-row write for
-- generated shopping items + their provenance rows, atomically.
--
-- Same SECURITY INVOKER precedent as save_recipe_with_details: runs with
-- the caller's own privileges, so every insert below still passes through
-- the owner-only RLS policies (and the ownership-consistency triggers)
-- already defined on shopping_list_items and shopping_item_sources. The
-- explicit auth.uid()/ownership checks here are defense in depth on top of
-- RLS, not a replacement for it. No merge/quantity business logic runs in
-- SQL — p_items is the already-decided, already-merged payload computed
-- client-side by the pure shopping-merge/shopping-generate modules; this
-- function only performs the atomic write. A single function invocation is
-- one implicit transaction, so any exception raised anywhere below (a
-- failed check constraint, a rejected ownership trigger, etc.) rolls back
-- every insert already made in this call — no partial item/source list is
-- ever possible.
-- =========================================================
CREATE OR REPLACE FUNCTION public.generate_shopping_list_items(
  p_shopping_list_id uuid,
  p_items jsonb
)
RETURNS uuid[]
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_item jsonb;
  v_source jsonb;
  v_item_id uuid;
  v_ids uuid[] := '{}';
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.shopping_lists
    WHERE id = p_shopping_list_id AND user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Shopping list not found or not owned by the current user';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb))
  LOOP
    IF COALESCE(v_item ->> 'display_name', '') = '' THEN
      RAISE EXCEPTION 'Each generated item requires a display_name';
    END IF;

    INSERT INTO public.shopping_list_items (
      user_id, shopping_list_id, display_name, quantity_text, unit, note
    )
    VALUES (
      v_user_id,
      p_shopping_list_id,
      v_item ->> 'display_name',
      NULLIF(v_item ->> 'quantity_text', ''),
      NULLIF(v_item ->> 'unit', ''),
      NULLIF(v_item ->> 'note', '')
    )
    RETURNING id INTO v_item_id;

    v_ids := array_append(v_ids, v_item_id);

    FOR v_source IN SELECT * FROM jsonb_array_elements(COALESCE(v_item -> 'sources', '[]'::jsonb))
    LOOP
      IF COALESCE(btrim(v_source ->> 'recipe_title_snapshot'), '') = '' THEN
        RAISE EXCEPTION 'Each source requires a non-blank recipe_title_snapshot';
      END IF;

      INSERT INTO public.shopping_item_sources (
        user_id, shopping_list_item_id, recipe_id, recipe_title_snapshot,
        meal_plan_entry_id, planned_date_snapshot, meal_type_snapshot, raw_quantity_text
      )
      VALUES (
        v_user_id,
        v_item_id,
        NULLIF(v_source ->> 'recipe_id', '')::uuid,
        v_source ->> 'recipe_title_snapshot',
        NULLIF(v_source ->> 'meal_plan_entry_id', '')::uuid,
        NULLIF(v_source ->> 'planned_date_snapshot', '')::date,
        NULLIF(v_source ->> 'meal_type_snapshot', ''),
        NULLIF(v_source ->> 'raw_quantity_text', '')
      );
    END LOOP;
  END LOOP;

  RETURN v_ids;
END;
$$;

REVOKE ALL ON FUNCTION public.generate_shopping_list_items(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_shopping_list_items(uuid, jsonb) TO authenticated;
