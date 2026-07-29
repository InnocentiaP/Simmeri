-- Transactional recipe save: creates/updates a recipe together with its
-- ingredients and steps in a single statement, so a failure partway through
-- (e.g. an ingredient row violating a check constraint) rolls back the whole
-- write instead of leaving the recipe with stale or missing children.
--
-- SECURITY INVOKER (the default) is used deliberately, not SECURITY DEFINER:
-- the function runs with the calling user's privileges, so every insert/
-- update/delete inside it still passes through the existing owner-only RLS
-- policies on recipes/recipe_ingredients/recipe_steps. The explicit
-- auth.uid() checks below are defense in depth on top of RLS, not a
-- replacement for it.
CREATE OR REPLACE FUNCTION public.save_recipe_with_details(
  p_recipe_id uuid,
  p_title text,
  p_description text,
  p_servings integer,
  p_prep_time_minutes integer,
  p_cook_time_minutes integer,
  p_notes text,
  p_ingredients jsonb,
  p_steps jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_recipe_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_title IS NULL OR btrim(p_title) = '' THEN
    RAISE EXCEPTION 'Title is required';
  END IF;

  IF p_recipe_id IS NULL THEN
    INSERT INTO public.recipes (
      user_id, title, description, servings, prep_time_minutes, cook_time_minutes, notes
    )
    VALUES (
      v_user_id, p_title, p_description, p_servings, p_prep_time_minutes, p_cook_time_minutes, p_notes
    )
    RETURNING id INTO v_recipe_id;
  ELSE
    UPDATE public.recipes
    SET title = p_title,
        description = p_description,
        servings = p_servings,
        prep_time_minutes = p_prep_time_minutes,
        cook_time_minutes = p_cook_time_minutes,
        notes = p_notes
    WHERE id = p_recipe_id AND user_id = v_user_id
    RETURNING id INTO v_recipe_id;

    IF v_recipe_id IS NULL THEN
      RAISE EXCEPTION 'Recipe not found or not owned by the current user';
    END IF;
  END IF;

  DELETE FROM public.recipe_ingredients WHERE recipe_id = v_recipe_id AND user_id = v_user_id;
  DELETE FROM public.recipe_steps WHERE recipe_id = v_recipe_id AND user_id = v_user_id;

  INSERT INTO public.recipe_ingredients (
    recipe_id, user_id, display_name, raw_text, quantity_text, unit, preparation_note, importance, position
  )
  SELECT
    v_recipe_id,
    v_user_id,
    elem ->> 'display_name',
    NULLIF(elem ->> 'raw_text', ''),
    NULLIF(elem ->> 'quantity_text', ''),
    NULLIF(elem ->> 'unit', ''),
    NULLIF(elem ->> 'preparation_note', ''),
    COALESCE(NULLIF(elem ->> 'importance', ''), 'core'),
    COALESCE((elem ->> 'position')::integer, 0)
  FROM jsonb_array_elements(COALESCE(p_ingredients, '[]'::jsonb)) AS elem
  WHERE COALESCE(elem ->> 'display_name', '') <> '';

  INSERT INTO public.recipe_steps (recipe_id, user_id, instruction, position)
  SELECT
    v_recipe_id,
    v_user_id,
    elem ->> 'instruction',
    COALESCE((elem ->> 'position')::integer, 0)
  FROM jsonb_array_elements(COALESCE(p_steps, '[]'::jsonb)) AS elem
  WHERE COALESCE(elem ->> 'instruction', '') <> '';

  RETURN v_recipe_id;
END;
$$;

REVOKE ALL ON FUNCTION public.save_recipe_with_details(
  uuid, text, text, integer, integer, integer, text, jsonb, jsonb
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_recipe_with_details(
  uuid, text, text, integer, integer, integer, text, jsonb, jsonb
) TO authenticated;
