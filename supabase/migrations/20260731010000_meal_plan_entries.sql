-- =========================================================
-- meal_plan_entries
--
-- Date-indexed planning entries scoped directly to the user — no separate
-- meal_plans container. "This week"/"this day" is just a date-range filter
-- on this table; nothing in the current product scope needs a distinct
-- container row with its own status/date range (see Wave 2 plan section B).
-- =========================================================
CREATE TABLE public.meal_plan_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipe_id uuid NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  planned_date date NOT NULL,
  meal_type text NOT NULL DEFAULT 'dinner',
  servings integer,
  notes text,
  position integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'planned',
  cooking_history_id uuid REFERENCES public.cooking_history(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT meal_plan_entries_meal_type_check
    CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack', 'other')),
  CONSTRAINT meal_plan_entries_servings_positive_check
    CHECK (servings IS NULL OR servings > 0),
  CONSTRAINT meal_plan_entries_notes_length_check
    CHECK (notes IS NULL OR char_length(notes) <= 2000),
  -- Deliberately 4 states, not 5: "moved" is an in-place update to
  -- planned_date/meal_type/position on the same row, not a separate
  -- terminal status (see Wave 2 plan section E).
  CONSTRAINT meal_plan_entries_status_check
    CHECK (status IN ('planned', 'cooked', 'skipped', 'cancelled'))
);
CREATE INDEX meal_plan_entries_user_date_idx ON public.meal_plan_entries(user_id, planned_date);
CREATE INDEX meal_plan_entries_recipe_idx ON public.meal_plan_entries(recipe_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.meal_plan_entries TO authenticated;
GRANT ALL ON public.meal_plan_entries TO service_role;
ALTER TABLE public.meal_plan_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "meal_plan_entries_select_own" ON public.meal_plan_entries FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "meal_plan_entries_insert_own" ON public.meal_plan_entries FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "meal_plan_entries_update_own" ON public.meal_plan_entries FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "meal_plan_entries_delete_own" ON public.meal_plan_entries FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER meal_plan_entries_updated_at BEFORE UPDATE ON public.meal_plan_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Cross-owner integrity: RLS's WITH CHECK (auth.uid() = user_id) only proves
-- the acting row's user_id matches the caller — it does not prove the
-- REFERENCED recipe_id (or cooking_history_id) belongs to that same user.
-- Same philosophy as validate_cooking_history_ownership /
-- validate_collection_recipe_ownership in prior migrations.
CREATE FUNCTION public.validate_meal_plan_entry_ownership()
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

  IF NEW.cooking_history_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.cooking_history
      WHERE id = NEW.cooking_history_id
        AND user_id = NEW.user_id
        AND recipe_id = NEW.recipe_id
    ) THEN
      RAISE EXCEPTION 'Cooking history entry not found, not owned by the current user, or not associated with this recipe';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER meal_plan_entries_validate_ownership
  BEFORE INSERT OR UPDATE ON public.meal_plan_entries
  FOR EACH ROW EXECUTE FUNCTION public.validate_meal_plan_entry_ownership();
