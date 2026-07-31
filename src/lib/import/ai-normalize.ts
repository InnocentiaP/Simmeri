import type { AiRecipeDraft } from "./ai-draft-schema";

// AiRecipeDraft's request-side shape (source_note omitted — it's optional
// on the schema and never sent by either AI Recipe feature).
type AiEditRequestPayload = Omit<AiRecipeDraft, "source_note">;

// Structurally identical to RecipeFormValues (src/lib/api.ts) — defined
// locally rather than imported so this module stays pure/dependency-free
// (no bundler-alias resolution needed to run under `node --test`), matching
// the DbXLike-interface convention already used by src/lib/shopping-generate.ts.
export interface NormalizedRecipeIngredient {
  display_name: string;
  raw_text: string;
  quantity_text: string;
  unit: string;
  preparation_note: string;
  importance: "core" | "supporting" | "seasoning" | "optional";
}

export interface NormalizedRecipeStep {
  instruction: string;
}

export interface NormalizedRecipeDraft {
  title: string;
  description: string;
  servings: number | null;
  prep_time_minutes: number | null;
  cook_time_minutes: number | null;
  notes: string;
  ingredients: NormalizedRecipeIngredient[];
  steps: NormalizedRecipeStep[];
}

// Sorts by position, drops position, maps every null to "" (matching
// RecipeFormValues' non-nullable string fields), defaults a null importance
// to "core" (matching save_recipe_with_details' own COALESCE(...,'core')
// default), and re-trims all strings defensively. This is the seam that lets
// a validated AI draft slot into the existing ReviewStep/useRecipeForm/
// saveImportedRecipe pipeline with zero new save-path code. Does not mutate
// its input.
export function normalizeAiDraftToFormValues(draft: AiRecipeDraft): NormalizedRecipeDraft {
  const ingredients = [...draft.ingredients]
    .sort((a, b) => a.position - b.position)
    .map((ingredient) => ({
      display_name: ingredient.display_name.trim(),
      raw_text: (ingredient.raw_text ?? "").trim(),
      quantity_text: (ingredient.quantity_text ?? "").trim(),
      unit: (ingredient.unit ?? "").trim(),
      preparation_note: (ingredient.preparation_note ?? "").trim(),
      importance: ingredient.importance ?? "core",
    }));

  const steps = [...draft.steps]
    .sort((a, b) => a.position - b.position)
    .map((step) => ({ instruction: step.instruction.trim() }));

  return {
    title: draft.title.trim(),
    description: (draft.description ?? "").trim(),
    servings: draft.servings,
    prep_time_minutes: draft.prep_time_minutes,
    cook_time_minutes: draft.cook_time_minutes,
    notes: (draft.personal_notes ?? "").trim(),
    ingredients,
    steps,
  };
}

// The inverse of normalizeAiDraftToFormValues, used only by the AI Recipe
// Edit Assistant (src/lib/import/recipe-ai-edit.functions.ts): serializes
// the current, possibly user-edited, form-shaped recipe into the
// AiRecipeDraft-compatible request payload (explicit position, "" -> null)
// that gets embedded as untrusted content in the cleanup prompt. Blank
// ingredient/step rows are dropped first and position is reassigned over the
// filtered list — the same filter-then-reindex convention saveRecipe already
// uses in src/lib/api.ts, so what gets sent to Gemini matches what would
// actually be saved. Does not mutate its input.
export function buildAiEditRequestPayload(recipe: NormalizedRecipeDraft): AiEditRequestPayload {
  const ingredients = recipe.ingredients.filter((i) => i.display_name.trim());
  const steps = recipe.steps.filter((s) => s.instruction.trim());

  return {
    title: recipe.title.trim(),
    description: recipe.description.trim() || null,
    servings: recipe.servings,
    prep_time_minutes: recipe.prep_time_minutes,
    cook_time_minutes: recipe.cook_time_minutes,
    personal_notes: recipe.notes.trim() || null,
    ingredients: ingredients.map((ingredient, index) => ({
      raw_text: ingredient.raw_text.trim() || null,
      display_name: ingredient.display_name.trim(),
      quantity_text: ingredient.quantity_text.trim() || null,
      unit: ingredient.unit.trim() || null,
      preparation_note: ingredient.preparation_note.trim() || null,
      importance: ingredient.importance,
      position: index,
    })),
    steps: steps.map((step, index) => ({
      instruction: step.instruction.trim(),
      position: index,
    })),
  };
}
