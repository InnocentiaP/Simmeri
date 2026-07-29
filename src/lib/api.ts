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

export async function saveRecipe(values: RecipeFormValues, existingId?: string) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const payload = {
    user_id: user.id,
    title: values.title.trim(),
    description: values.description.trim() || null,
    servings: values.servings,
    prep_time_minutes: values.prep_time_minutes,
    cook_time_minutes: values.cook_time_minutes,
    notes: values.notes.trim() || null,
  };

  let recipeId = existingId;
  if (existingId) {
    const { error } = await supabase.from("recipes").update(payload).eq("id", existingId);
    if (error) throw error;
  } else {
    const { data, error } = await supabase.from("recipes").insert(payload).select("id").single();
    if (error) throw error;
    recipeId = data.id;
  }
  if (!recipeId) throw new Error("Missing recipe id");

  // Replace ingredients & steps
  await supabase.from("recipe_ingredients").delete().eq("recipe_id", recipeId);
  await supabase.from("recipe_steps").delete().eq("recipe_id", recipeId);

  const ingredientsToInsert = values.ingredients
    .filter((i) => i.display_name.trim())
    .map((i, idx) => ({
      recipe_id: recipeId!,
      user_id: user.id,
      display_name: i.display_name.trim(),
      raw_text: i.raw_text.trim() || null,
      quantity_text: i.quantity_text.trim() || null,
      unit: i.unit.trim() || null,
      preparation_note: i.preparation_note.trim() || null,
      importance: i.importance,
      position: idx,
    }));
  if (ingredientsToInsert.length) {
    const { error } = await supabase.from("recipe_ingredients").insert(ingredientsToInsert);
    if (error) throw error;
  }

  const stepsToInsert = values.steps
    .filter((s) => s.instruction.trim())
    .map((s, idx) => ({
      recipe_id: recipeId!,
      user_id: user.id,
      instruction: s.instruction.trim(),
      position: idx,
    }));
  if (stepsToInsert.length) {
    const { error } = await supabase.from("recipe_steps").insert(stepsToInsert);
    if (error) throw error;
  }

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
