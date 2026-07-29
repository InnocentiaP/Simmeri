
-- Shared updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- =========================================================
-- profiles
-- =========================================================
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  onboarding_completed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_delete_own" ON public.profiles FOR DELETE TO authenticated USING (auth.uid() = id);
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- user_preferences
-- =========================================================
CREATE TABLE public.user_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  language text NOT NULL DEFAULT 'en',
  measurement_system text NOT NULL DEFAULT 'metric' CHECK (measurement_system IN ('metric', 'us')),
  timezone text NOT NULL DEFAULT 'UTC',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_preferences TO authenticated;
GRANT ALL ON public.user_preferences TO service_role;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_preferences_select_own" ON public.user_preferences FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "user_preferences_insert_own" ON public.user_preferences FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_preferences_update_own" ON public.user_preferences FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_preferences_delete_own" ON public.user_preferences FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER user_preferences_updated_at BEFORE UPDATE ON public.user_preferences FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- recipes
-- =========================================================
CREATE TABLE public.recipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  servings integer,
  prep_time_minutes integer,
  cook_time_minutes integer,
  notes text,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX recipes_user_archived_idx ON public.recipes(user_id, archived_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recipes TO authenticated;
GRANT ALL ON public.recipes TO service_role;
ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "recipes_select_own" ON public.recipes FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "recipes_insert_own" ON public.recipes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "recipes_update_own" ON public.recipes FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "recipes_delete_own" ON public.recipes FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER recipes_updated_at BEFORE UPDATE ON public.recipes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- recipe_ingredients
-- =========================================================
CREATE TABLE public.recipe_ingredients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id uuid NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  raw_text text,
  display_name text NOT NULL,
  quantity_text text,
  unit text,
  preparation_note text,
  importance text NOT NULL DEFAULT 'core' CHECK (importance IN ('core', 'supporting', 'seasoning', 'optional')),
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX recipe_ingredients_recipe_pos_idx ON public.recipe_ingredients(recipe_id, position);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recipe_ingredients TO authenticated;
GRANT ALL ON public.recipe_ingredients TO service_role;
ALTER TABLE public.recipe_ingredients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "recipe_ingredients_select_own" ON public.recipe_ingredients FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "recipe_ingredients_insert_own" ON public.recipe_ingredients FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "recipe_ingredients_update_own" ON public.recipe_ingredients FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "recipe_ingredients_delete_own" ON public.recipe_ingredients FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER recipe_ingredients_updated_at BEFORE UPDATE ON public.recipe_ingredients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- recipe_steps
-- =========================================================
CREATE TABLE public.recipe_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id uuid NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  instruction text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX recipe_steps_recipe_pos_idx ON public.recipe_steps(recipe_id, position);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recipe_steps TO authenticated;
GRANT ALL ON public.recipe_steps TO service_role;
ALTER TABLE public.recipe_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "recipe_steps_select_own" ON public.recipe_steps FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "recipe_steps_insert_own" ON public.recipe_steps FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "recipe_steps_update_own" ON public.recipe_steps FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "recipe_steps_delete_own" ON public.recipe_steps FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER recipe_steps_updated_at BEFORE UPDATE ON public.recipe_steps FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- kitchen_items
-- =========================================================
CREATE TABLE public.kitchen_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ingredient_name text NOT NULL,
  normalized_name text GENERATED ALWAYS AS (lower(trim(ingredient_name))) STORED,
  status text NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'running_low', 'out_of_stock', 'unknown')),
  storage_location text NOT NULL DEFAULT 'pantry' CHECK (storage_location IN ('pantry', 'refrigerator', 'freezer', 'spice_rack', 'other')),
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX kitchen_items_user_norm_idx ON public.kitchen_items(user_id, normalized_name);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kitchen_items TO authenticated;
GRANT ALL ON public.kitchen_items TO service_role;
ALTER TABLE public.kitchen_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "kitchen_items_select_own" ON public.kitchen_items FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "kitchen_items_insert_own" ON public.kitchen_items FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "kitchen_items_update_own" ON public.kitchen_items FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "kitchen_items_delete_own" ON public.kitchen_items FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER kitchen_items_updated_at BEFORE UPDATE ON public.kitchen_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- Auto-create profile & preferences on signup
-- =========================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data ->> 'display_name', split_part(NEW.email, '@', 1)))
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
