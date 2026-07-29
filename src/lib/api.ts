import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Recipe = Database["public"]["Tables"]["recipes"]["Row"];
export type RecipeIngredient = Database["public"]["Tables"]["recipe_ingredients"]["Row"];
export type RecipeStep = Database["public"]["Tables"]["recipe_steps"]["Row"];
export type KitchenItem = Database["public"]["Tables"]["kitchen_items"]["Row"];
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type UserPreferences = Database["public"]["Tables"]["user_preferences"]["Row"];

export async function listRecipes(includeArchived = false) {
  let q = supabase.from("recipes").select("*").order("created_at", { ascending: false });
  if (!includeArchived) q = q.is("archived_at", null);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function listKitchenItems(includeArchived = false) {
  let q = supabase.from("kitchen_items").select("*").order("ingredient_name");
  if (!includeArchived) q = q.is("archived_at", null);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function getRecipeDetail(recipeId: string) {
  const [recipe, ingredients, steps] = await Promise.all([
    supabase.from("recipes").select("*").eq("id", recipeId).maybeSingle(),
    supabase
      .from("recipe_ingredients")
      .select("*")
      .eq("recipe_id", recipeId)
      .order("position"),
    supabase.from("recipe_steps").select("*").eq("recipe_id", recipeId).order("position"),
  ]);
  if (recipe.error) throw recipe.error;
  if (!recipe.data) return null;
  if (ingredients.error) throw ingredients.error;
  if (steps.error) throw steps.error;
  return { recipe: recipe.data, ingredients: ingredients.data ?? [], steps: steps.data ?? [] };
}

export interface RecipeFormValues {
  title: string;
  description: string;
  servings: number | null;
  prep_time_minutes: number | null;
  cook_time_minutes: number | null;
  notes: string;
  ingredients: Array<{
    display_name: string;
    raw_text: string;
    quantity_text: string;
    unit: string;
    preparation_note: string;
    importance: "core" | "supporting" | "seasoning" | "optional";
  }>;
  steps: Array<{ instruction: string }>;
}

// Creates or updates a recipe together with its ingredients and steps as a
// single database transaction via the save_recipe_with_details RPC (see
// supabase/migrations/20260729010000_save_recipe_with_details_rpc.sql). If any
// part of the write fails (e.g. a constraint violation on one ingredient row),
// the entire operation rolls back — the recipe is never left with stale or
// missing children. This call is genuinely atomic, not a best-effort sequence.
export async function saveRecipe(values: RecipeFormValues, existingId?: string) {
  const ingredientsPayload = values.ingredients
    .filter((i) => i.display_name.trim())
    .map((i, idx) => ({
      display_name: i.display_name.trim(),
      raw_text: i.raw_text.trim(),
      quantity_text: i.quantity_text.trim(),
      unit: i.unit.trim(),
      preparation_note: i.preparation_note.trim(),
      importance: i.importance,
      position: idx,
    }));

  const stepsPayload = values.steps
    .filter((s) => s.instruction.trim())
    .map((s, idx) => ({
      instruction: s.instruction.trim(),
      position: idx,
    }));

  const { data: recipeId, error } = await supabase.rpc("save_recipe_with_details", {
    p_recipe_id: existingId ?? null,
    p_title: values.title.trim(),
    p_description: values.description.trim() || null,
    p_servings: values.servings,
    p_prep_time_minutes: values.prep_time_minutes,
    p_cook_time_minutes: values.cook_time_minutes,
    p_notes: values.notes.trim() || null,
    p_ingredients: ingredientsPayload,
    p_steps: stepsPayload,
  });
  if (error) throw error;
  if (!recipeId) throw new Error("Save failed: no recipe id returned");

  return recipeId;
}

export async function archiveRecipe(id: string) {
  const { error } = await supabase
    .from("recipes")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}
export async function unarchiveRecipe(id: string) {
  const { error } = await supabase.from("recipes").update({ archived_at: null }).eq("id", id);
  if (error) throw error;
}
export async function deleteRecipe(id: string) {
  const { error } = await supabase.from("recipes").delete().eq("id", id);
  if (error) throw error;
}
