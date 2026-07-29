import type { RecipeFormValues } from "@/lib/api";

// Reuses the exact shape RecipeForm/useRecipeForm already accepts as
// defaultValues — an extracted draft is never a separate data model.
export type ExtractedRecipeDraft = RecipeFormValues;

export interface ImportSource {
  url: string | null;
  title: string | null;
}

export interface ImportResult {
  draft: ExtractedRecipeDraft;
  warnings: string[];
  source: ImportSource;
}

export function emptyDraft(title = ""): ExtractedRecipeDraft {
  return {
    title,
    description: "",
    servings: null,
    prep_time_minutes: null,
    cook_time_minutes: null,
    notes: "",
    ingredients: [],
    steps: [],
  };
}
