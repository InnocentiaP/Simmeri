import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { importAuthMiddleware } from "./import-auth.server";
import { callGeminiForRecipeCleanup } from "./gemini-client.server";
import { parseAiRecipeDraft, MAX_AI_INGREDIENTS, MAX_AI_STEPS } from "./ai-draft-schema";
import {
  normalizeAiDraftToFormValues,
  buildAiEditRequestPayload,
  type NormalizedRecipeDraft,
} from "./ai-normalize";
import { isAiRateLimited } from "./ai-rate-limit.server";
import {
  mapGeminiErrorToUserMessage,
  AI_MALFORMED_RESPONSE_MESSAGE,
  AI_RATE_LIMIT_EXCEEDED_MESSAGE,
} from "./gemini-error-messages";

const importanceEnum = z.enum(["core", "supporting", "seasoning", "optional"]);

// Bounds mirror recipeFormSchema (src/components/app/RecipeForm.tsx) so a
// request built from the live edit form always validates here. This is a
// request-shape guard (bounding payload size), not a full recipe-validity
// check — the form's own zod resolver is the source of truth for that.
const recipeEditRequestSchema = z.object({
  title: z.string().max(200),
  description: z.string().max(2000),
  servings: z.number().int().min(1).max(99).nullable(),
  prep_time_minutes: z.number().int().min(0).max(1440).nullable(),
  cook_time_minutes: z.number().int().min(0).max(1440).nullable(),
  notes: z.string().max(4000),
  ingredients: z
    .array(
      z.object({
        display_name: z.string().max(200),
        raw_text: z.string().max(400),
        quantity_text: z.string().max(60),
        unit: z.string().max(40),
        preparation_note: z.string().max(200),
        importance: importanceEnum,
      }),
    )
    .max(MAX_AI_INGREDIENTS),
  steps: z.array(z.object({ instruction: z.string().max(1200) })).max(MAX_AI_STEPS),
});

export interface CleanUpRecipeWithAiResult {
  draft: NormalizedRecipeDraft;
  aiMeta: { model: string };
}

// The AI Recipe Edit Assistant's one new server surface ("Clean up with AI"
// on /app/recipes/$recipeId/edit). Reuses the exact same architecture as the
// AI Recipe Import Assistant: importAuthMiddleware for auth, the shared
// Gemini REST client (same GEMINI_API_KEY handling, model, endpoint,
// timeout — see ./gemini-client.server.ts), the shared in-memory rate
// limiter (same budget, shared with Import), and the exact same
// aiRecipeDraftSchema/parseAiRecipeDraft/normalizeAiDraftToFormValues
// response pipeline. It never writes to recipes/recipe_ingredients/
// recipe_steps itself — it returns a proposed draft or throws; applying and
// saving are both separate, explicit user actions handled entirely by the
// existing Edit Recipe route and the unmodified saveRecipe() path.
export const cleanUpRecipeWithAI = createServerFn({ method: "POST" })
  .middleware([importAuthMiddleware])
  .validator(recipeEditRequestSchema)
  .handler(async ({ data, context }): Promise<CleanUpRecipeWithAiResult> => {
    const userId = (context as { userId: string }).userId;
    if (isAiRateLimited(userId)) {
      throw new Error(AI_RATE_LIMIT_EXCEEDED_MESSAGE);
    }

    const payload = buildAiEditRequestPayload(data);
    const recipeJson = JSON.stringify(payload);

    const geminiResult = await callGeminiForRecipeCleanup(recipeJson);
    if (!geminiResult.ok) {
      throw new Error(mapGeminiErrorToUserMessage(geminiResult.category));
    }

    const parsed = parseAiRecipeDraft(geminiResult.rawText);
    if (!parsed.ok) {
      throw new Error(AI_MALFORMED_RESPONSE_MESSAGE);
    }

    const draft = normalizeAiDraftToFormValues(parsed.draft);
    return { draft, aiMeta: { model: geminiResult.model } };
  });
