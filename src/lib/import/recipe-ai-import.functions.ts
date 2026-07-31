import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { importAuthMiddleware } from "./import-auth.server";
import { fetchRecipePageHtml } from "./url-fetch.server";
import { stripHtmlToReadableText } from "./html-to-text";
import { callGeminiForRecipeExtraction } from "./gemini-client.server";
import { parseAiRecipeDraft } from "./ai-draft-schema";
import { normalizeAiDraftToFormValues, type NormalizedRecipeDraft } from "./ai-normalize";
import { isAiRateLimited } from "./ai-rate-limit.server";
import {
  mapGeminiErrorToUserMessage,
  AI_MALFORMED_RESPONSE_MESSAGE,
  AI_RATE_LIMIT_EXCEEDED_MESSAGE,
} from "./gemini-error-messages";

const MAX_PASTE_CHARS = 20_000;
const MAX_EXTRACTED_CHARS = 12_000;

const requestSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("text"),
    text: z
      .string()
      .trim()
      .min(1, "Paste some recipe text first.")
      .max(MAX_PASTE_CHARS, "That text is too long for AI extraction — try trimming it or use manual entry."),
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
    if (isAiRateLimited(userId)) {
      throw new Error(AI_RATE_LIMIT_EXCEEDED_MESSAGE);
    }

    let cleanedText: string;
    let truncatedInput = false;

    if (data.kind === "text") {
      cleanedText = data.text;
    } else {
      const html = await fetchRecipePageHtml(data.url);
      const stripped = stripHtmlToReadableText(html, MAX_EXTRACTED_CHARS);
      cleanedText = stripped.text;
      truncatedInput = stripped.truncated;
    }

    const geminiResult = await callGeminiForRecipeExtraction(cleanedText);
    if (!geminiResult.ok) {
      throw new Error(mapGeminiErrorToUserMessage(geminiResult.category));
    }

    const parsed = parseAiRecipeDraft(geminiResult.rawText);
    if (!parsed.ok) {
      throw new Error(AI_MALFORMED_RESPONSE_MESSAGE);
    }

    const draft = normalizeAiDraftToFormValues(parsed.draft);
    const warnings: string[] = [];
    if (truncatedInput) {
      warnings.push("That page was long — some content may have been cut before AI extraction.");
    }

    return {
      draft,
      warnings,
      aiMeta: { model: geminiResult.model, truncatedInput },
    };
  });
