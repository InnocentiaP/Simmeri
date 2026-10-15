import type { RecipeFormValues } from "@/lib/api";

// Reuses the exact shape RecipeForm/useRecipeForm already accepts as
// defaultValues — an extracted draft is never a separate data model.
export type ExtractedRecipeDraft = RecipeFormValues;

export interface ImportSource {
  url: string | null;
  title: string | null;
}

// How a draft was produced, shown to the user during review:
// - json_ld / microdata: read from the page's schema.org recipe data
// - ai: extracted by AI from the page text (structured data was missing
//   or incomplete)
// - partial: whatever could be read without AI; fields may be missing
// - text: parsed from pasted text
export type ImportMethod = "json_ld" | "microdata" | "ai" | "partial" | "text";

export interface ImportResult {
  draft: ExtractedRecipeDraft;
  warnings: string[];
  source: ImportSource;
  method?: ImportMethod;
  // The recipe's own photo on the source page, offered as a cover.
  imageUrl?: string | null;
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
