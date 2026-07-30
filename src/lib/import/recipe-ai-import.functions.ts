import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { importAuthMiddleware } from "./import-auth.server";
import { fetchRecipePageHtml } from "./url-fetch.server";
import { stripHtmlToReadableText } from "./html-to-text";
import { callGeminiForRecipeExtraction } from "./gemini-client.server";
import { parseAiRecipeDraft } from "./ai-draft-schema";
import { normalizeAiDraftToFormValues, type NormalizedRecipeDraft } from "./ai-normalize";

const MAX_PASTE_CHARS = 20_000;
const MAX_EXTRACTED_CHARS = 12_000;

// Best-effort, in-memory, per-user rate limiter — explicitly NOT a durable
// quota system (see plan section H). Resets on cold start and is not shared
// across concurrent serverless instances; it is a soft speed-bump, not an
// enforced limit. Upgrading to a persisted (e.g. Supabase) usage counter is
// the natural next step if real abuse is ever observed — deliberately not
// built now, per the "smallest practical" instruction.
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX_CALLS = 10;
const callHistory = new Map<string, number[]>();

function isRateLimited(userId: string): boolean {
  const now = Date.now();
  const recent = (callHistory.get(userId) ?? []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (recent.length >= RATE_LIMIT_MAX_CALLS) {
    callHistory.set(userId, recent);
    return true;
  }
  recent.push(now);
  callHistory.set(userId, recent);
  return false;
}

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
    if (isRateLimited(userId)) {
      throw new Error(
        "You've reached the AI assistance limit for now — try again shortly, or continue editing manually.",
      );
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
      switch (geminiResult.category) {
        case "not_configured":
          throw new Error("AI recipe assistance isn't configured yet.");
        case "timeout":
        case "network":
          throw new Error(
            "The AI assistant took too long to respond. Try again or keep your current draft.",
          );
        case "rate_limited":
          throw new Error("The AI assistant is busy right now. Try again in a moment.");
        case "upstream_error":
        default:
          throw new Error("The AI assistant is temporarily unavailable.");
      }
    }

    const parsed = parseAiRecipeDraft(geminiResult.rawText);
    if (!parsed.ok) {
      throw new Error(
        "The AI assistant returned an unexpected response. Try again or keep your current draft.",
      );
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
