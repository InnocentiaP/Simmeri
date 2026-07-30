import { z } from "zod";

// Bounds mirror recipeFormSchema (src/components/app/RecipeForm.tsx) exactly,
// so AI output and manual input are validated against the same limits. Every
// field where "unknown" is a legitimate answer is nullable — the model is
// instructed (see ./gemini-prompt) to use null rather than invent a value.
export const MAX_AI_INGREDIENTS = 60;
export const MAX_AI_STEPS = 40;

const aiImportanceEnum = z.enum(["core", "supporting", "seasoning", "optional"]);

export const aiIngredientSchema = z.object({
  raw_text: z.string().max(400).nullable(),
  display_name: z.string().trim().min(1).max(200),
  quantity_text: z.string().max(60).nullable(),
  unit: z.string().max(40).nullable(),
  preparation_note: z.string().max(200).nullable(),
  importance: aiImportanceEnum.nullable(),
  position: z.number().int().min(0).max(MAX_AI_INGREDIENTS - 1),
});

export const aiStepSchema = z.object({
  instruction: z.string().trim().min(1).max(1200),
  position: z.number().int().min(0).max(MAX_AI_STEPS - 1),
});

// Note: this schema's field is personal_notes (matching the product brief's
// naming), while RecipeFormValues (src/lib/api.ts) calls the equivalent field
// notes — ./ai-normalize.ts bridges the two at the normalization boundary.
export const aiRecipeDraftSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().max(2000).nullable(),
  servings: z.number().int().min(1).max(99).nullable(),
  prep_time_minutes: z.number().int().min(0).max(1440).nullable(),
  cook_time_minutes: z.number().int().min(0).max(1440).nullable(),
  personal_notes: z.string().max(4000).nullable(),
  ingredients: z.array(aiIngredientSchema).min(1).max(MAX_AI_INGREDIENTS),
  steps: z.array(aiStepSchema).min(1).max(MAX_AI_STEPS),
  source_note: z.string().max(500).nullable().optional(),
});

export type AiRecipeDraft = z.infer<typeof aiRecipeDraftSchema>;
export type AiIngredient = z.infer<typeof aiIngredientSchema>;
export type AiStep = z.infer<typeof aiStepSchema>;

export type AiDraftParseResult =
  | { ok: true; draft: AiRecipeDraft }
  | { ok: false; reason: "invalid_json" | "schema_validation_failed" };

// Full rejection on any failure — no partial acceptance, no best-effort
// field salvage. A malformed response is treated as a complete failure of
// that AI call; the caller's existing draft/edits are left untouched.
export function parseAiRecipeDraft(rawJsonText: string): AiDraftParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJsonText);
  } catch {
    return { ok: false, reason: "invalid_json" };
  }

  const result = aiRecipeDraftSchema.safeParse(parsed);
  if (!result.success) {
    return { ok: false, reason: "schema_validation_failed" };
  }

  return { ok: true, draft: result.data };
}
