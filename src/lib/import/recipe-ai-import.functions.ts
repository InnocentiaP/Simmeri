import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { importAuthMiddleware } from "./import-auth.server";
import { fetchRecipePageHtml } from "./url-fetch.server";
import { buildAiInputFromHtml, extractRecipeFromHtml } from "./recipe-page-extract";
import { runAiRecipeExtraction } from "./ai-extract.server";
import type { NormalizedRecipeDraft } from "./ai-normalize";

const MAX_PASTE_CHARS = 20_000;
const MAX_EXTRACTED_CHARS = 12_000;

const requestSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("text"),
    text: z
      .string()
      .trim()
      .min(1, "Paste some recipe text first.")
      .max(
        MAX_PASTE_CHARS,
        "That text is too long for AI extraction — try trimming it or use manual entry.",
      ),
  }),
  z.object({ kind: z.literal("url"), url: z.string().trim().url() }),
]);

export interface ImproveRecipeDraftWithAiResult {
  draft: NormalizedRecipeDraft;
  warnings: string[];
  aiMeta: { model: string; truncatedInput: boolean };
}

// The one new AI-facing server surface this feature adds. Auth is enforced
// by importAuthMiddleware (reused unmodified, same as extractRecipeFromUrl).
// Never writes to recipes/recipe_ingredients/recipe_steps itself — returns a
// draft or throws; saving only happens when the user explicitly submits the
// review form through the existing, unmodified saveImportedRecipe/saveRecipe
// path. For url mode, the page is re-fetched here (via the existing
// SSRF-safe fetchRecipePageHtml) and reduced to cleaned text — Gemini itself
// never fetches a URL and never receives raw HTML.
export const improveRecipeDraftWithAI = createServerFn({ method: "POST" })
  .middleware([importAuthMiddleware])
  .validator(requestSchema)
  .handler(async ({ data, context }): Promise<ImproveRecipeDraftWithAiResult> => {
    const userId = (context as { userId: string }).userId;

    let cleanedText: string;
    let truncatedInput = false;

    if (data.kind === "text") {
      cleanedText = data.text;
    } else {
      // Focus on the page's recipe section (and any partial schema.org data)
      // rather than the top of the page, where blogs put long stories.
      const html = await fetchRecipePageHtml(data.url);
      const page = extractRecipeFromHtml(html, data.url);
      const input = buildAiInputFromHtml(html, MAX_EXTRACTED_CHARS, page.recipeNode);
      cleanedText = input.text;
      truncatedInput = input.truncated;
    }

    const ai = await runAiRecipeExtraction(userId, cleanedText);
    if (!ai.ok) {
      throw new Error(ai.message);
    }

    const warnings: string[] = [];
    if (truncatedInput) {
      warnings.push("That page was long — some content may have been cut before AI extraction.");
    }

    return {
      draft: ai.draft,
      warnings,
      aiMeta: { model: ai.model, truncatedInput },
    };
  });
