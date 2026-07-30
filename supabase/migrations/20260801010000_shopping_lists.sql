-- =========================================================
-- shopping_lists
--
-- Multiple named lists per user (create/rename/archive/delete as
-- independent actions, mirroring collections) — no uniqueness constraint on
-- name; duplicate list names are harmless and validated/trimmed in the UI
-- only.
-- =========================================================
CREATE TABLE public.shopping_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Shopping List',
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX shopping_lists_user_archived_idx ON public.shopping_lists(user_id, archived_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.shopping_lists TO authenticated;
GRANT ALL ON public.shopping_lists TO service_role;
ALTER TABLE public.shopping_lists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shopping_lists_select_own" ON public.shopping_lists FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "shopping_lists_insert_own" ON public.shopping_lists FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "shopping_lists_update_own" ON public.shopping_lists FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "shopping_lists_delete_own" ON public.shopping_lists FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER shopping_lists_updated_at BEFORE UPDATE ON public.shopping_lists
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- shopping_list_items
--
-- Manually-managed items only in this checkpoint — no shopping_item_sources
-- yet (that table, plus generation/merge logic, is Checkpoint 3). Purchased
-- state lives directly on the item row: is_purchased/purchased_at are a
-- simple paired flag, not a separate lifecycle entity.
-- =========================================================
CREATE TABLE public.shopping_list_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shopping_list_id uuid NOT NULL REFERENCES public.shopping_lists(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  quantity_text text,
  unit text,
  note text,
  is_purchased boolean NOT NULL DEFAULT false,
  purchased_at timestamptz,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT shopping_list_items_note_length_check
    CHECK (note IS NULL OR char_length(note) <= 1000),
  -- Paired-state guard: purchased_at is set if and only if is_purchased is
  -- true — enforced at the database level, not just in the UI/API layer.
  CONSTRAINT shopping_list_items_purchased_pair_check
    CHECK (
      (is_purchased = false AND purchased_at IS NULL) OR
      (is_purchased = true AND purchased_at IS NOT NULL)
    )
);
CREATE INDEX shopping_list_items_list_purchased_idx ON public.shopping_list_items(shopping_list_id, is_purchased);
CREATE INDEX shopping_list_items_user_idx ON public.shopping_list_items(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.shopping_list_items TO authenticated;
GRANT ALL ON public.shopping_list_items TO service_role;
ALTER TABLE public.shopping_list_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shopping_list_items_select_own" ON public.shopping_list_items FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "shopping_list_items_insert_own" ON public.shopping_list_items FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "shopping_list_items_update_own" ON public.shopping_list_items FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "shopping_list_items_delete_own" ON public.shopping_list_items FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER shopping_list_items_updated_at BEFORE UPDATE ON public.shopping_list_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Cross-owner integrity: RLS's WITH CHECK (auth.uid() = user_id) only proves
-- the acting row's user_id matches the caller — it does not prove the
-- REFERENCED shopping_list_id belongs to that same user. Same philosophy as
-- validate_meal_plan_entry_ownership / validate_collection_recipe_ownership
-- in prior migrations.
CREATE FUNCTION public.validate_shopping_list_item_ownership()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.shopping_lists
    WHERE id = NEW.shopping_list_id AND user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'Shopping list not found or not owned by the current user';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER shopping_list_items_validate_ownership
  BEFORE INSERT OR UPDATE ON public.shopping_list_items
  FOR EACH ROW EXECUTE FUNCTION public.validate_shopping_list_item_ownership();
