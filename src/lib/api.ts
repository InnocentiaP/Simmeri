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

// Saves an imported recipe through the same saveRecipe()/RPC path as a
// manually-created recipe, then sets the source columns via a follow-up
// update — same direct-update pattern as archiveRecipe/unarchiveRecipe below.
// No new RPC parameters: save_recipe_with_details is reused unmodified.
export async function saveImportedRecipe(
  values: RecipeFormValues,
  source: { url: string | null; title: string | null },
) {
  const recipeId = await saveRecipe(values);
  if (source.url || source.title) {
    const { error } = await supabase
      .from("recipes")
      .update({ source_url: source.url, source_title: source.title })
      .eq("id", recipeId);
    if (error) throw error;
  }
  return recipeId;
}

export interface RecipeCoverInput {
  bucket: string;
  path: string;
  source: "direct_upload" | "cooking_photo";
}

// Sets or replaces a recipe's cover metadata. The image itself already lives
// in Storage by the time this is called — this only points the recipe at it.
// Reusable unmodified by a future "promote a cooking photo to cover" flow
// (source: "cooking_photo"), which would pass an existing photo's
// bucket/path here rather than uploading a new object.
export async function setRecipeCover(recipeId: string, cover: RecipeCoverInput) {
  const { error } = await supabase
    .from("recipes")
    .update({
      cover_storage_bucket: cover.bucket,
      cover_storage_path: cover.path,
      cover_source: cover.source,
    })
    .eq("id", recipeId);
  if (error) throw error;
}

export async function removeRecipeCover(recipeId: string) {
  const { error } = await supabase
    .from("recipes")
    .update({
      cover_storage_bucket: null,
      cover_storage_path: null,
      cover_source: null,
    })
    .eq("id", recipeId);
  if (error) throw error;
}

export type Collection = Database["public"]["Tables"]["collections"]["Row"];

export async function listCollections(includeArchived = false) {
  let q = supabase.from("collections").select("*").order("created_at", { ascending: false });
  if (!includeArchived) q = q.is("archived_at", null);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function getCollection(collectionId: string) {
  const { data, error } = await supabase
    .from("collections")
    .select("*")
    .eq("id", collectionId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function createCollection(userId: string, name: string) {
  const { data, error } = await supabase
    .from("collections")
    .insert({ user_id: userId, name })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function renameCollection(collectionId: string, name: string) {
  const { error } = await supabase.from("collections").update({ name }).eq("id", collectionId);
  if (error) throw error;
}

export async function archiveCollection(collectionId: string) {
  const { error } = await supabase
    .from("collections")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", collectionId);
  if (error) throw error;
}

export async function restoreCollection(collectionId: string) {
  const { error } = await supabase
    .from("collections")
    .update({ archived_at: null })
    .eq("id", collectionId);
  if (error) throw error;
}

// Deleting a collection only ever cascades its collection_recipes rows
// (ON DELETE CASCADE) — recipes are never FK-children of a collection, so
// they are structurally untouched by this call.
export async function deleteCollection(collectionId: string) {
  const { error } = await supabase.from("collections").delete().eq("id", collectionId);
  if (error) throw error;
}

// Two queries + client-side association, matching the existing pattern used
// throughout this file (e.g. recipe list + kitchen_items in app.recipes.index.tsx)
// rather than a PostgREST embedded-resource select.
export async function listRecipesInCollection(collectionId: string): Promise<Recipe[]> {
  const { data: memberships, error: membershipError } = await supabase
    .from("collection_recipes")
    .select("recipe_id")
    .eq("collection_id", collectionId);
  if (membershipError) throw membershipError;

  const recipeIds = (memberships ?? []).map((m) => m.recipe_id);
  if (recipeIds.length === 0) return [];

  const { data: recipes, error: recipesError } = await supabase
    .from("recipes")
    .select("*")
    .in("id", recipeIds)
    .order("created_at", { ascending: false });
  if (recipesError) throw recipesError;
  return recipes ?? [];
}

// All membership rows for the current user (RLS-scoped), used to derive
// per-collection recipe counts at read time — no stored/cached count column.
export async function listAllCollectionMembershipCollectionIds(): Promise<string[]> {
  const { data, error } = await supabase.from("collection_recipes").select("collection_id");
  if (error) throw error;
  return (data ?? []).map((m) => m.collection_id);
}

export async function listCollectionIdsForRecipe(recipeId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("collection_recipes")
    .select("collection_id")
    .eq("recipe_id", recipeId);
  if (error) throw error;
  return (data ?? []).map((m) => m.collection_id);
}

// Treats "already a member" (Postgres unique-violation 23505 on the
// composite primary key) as a successful no-op — membership is inherently
// idempotent, not an error condition, e.g. under a double-click or two-tab race.
export async function addRecipeToCollection(collectionId: string, recipeId: string, userId: string) {
  const { error } = await supabase
    .from("collection_recipes")
    .insert({ collection_id: collectionId, recipe_id: recipeId, user_id: userId });
  if (error && error.code !== "23505") throw error;
}

export async function removeRecipeFromCollection(collectionId: string, recipeId: string) {
  const { error } = await supabase
    .from("collection_recipes")
    .delete()
    .eq("collection_id", collectionId)
    .eq("recipe_id", recipeId);
  if (error) throw error;
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
