import type { AiRecipeDraft } from "./ai-draft-schema";

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
