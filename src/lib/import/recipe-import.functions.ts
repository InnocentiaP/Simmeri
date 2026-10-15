import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { importAuthMiddleware } from "./import-auth.server";
import { fetchRecipePageHtml, fetchRemoteImage } from "./url-fetch.server";
import { buildAiInputFromHtml, extractRecipeFromHtml } from "./recipe-page-extract";
import { runAiRecipeExtraction } from "./ai-extract.server";
import type { ImportResult } from "./types";

// Same budget the explicit "Improve with AI" path uses for page text.
const MAX_AI_INPUT_CHARS = 12_000;

// Imports a recipe from a public web page in one step:
//   1. schema.org data (JSON-LD, then microdata) — exact and free
//   2. if that is missing or incomplete, AI reads the page's recipe section
//   3. if AI is unavailable, whatever step 1 found, with clear warnings
// Never saves anything: the result always goes through user review.
export const extractRecipeFromUrl = createServerFn({ method: "POST" })
  .middleware([importAuthMiddleware])
  .validator(z.object({ url: z.string().trim().url() }))
  .handler(async ({ data, context }): Promise<ImportResult> => {
    const userId = (context as { userId: string }).userId;
    const html = await fetchRecipePageHtml(data.url);
    const page = extractRecipeFromHtml(html, data.url);
    const source = { url: data.url, title: page.pageTitle ?? page.draft.title };

    if (page.complete) {
      return {
        draft: page.draft,
        warnings: [],
        source,
        method: page.method === "microdata" ? "microdata" : "json_ld",
        imageUrl: page.imageUrl,
      };
    }

    const aiInput = buildAiInputFromHtml(html, MAX_AI_INPUT_CHARS, page.recipeNode);
    const ai = await runAiRecipeExtraction(userId, aiInput.text);

    if (ai.ok) {
      const warnings = [
        "Meri read this page with AI because it had no complete recipe data. Double-check quantities and steps.",
      ];
      if (aiInput.truncated) {
        warnings.push("That page was long — some content may have been cut before AI extraction.");
      }
      return {
        // Keep a structured title when AI couldn't find one.
        draft: { ...ai.draft, title: ai.draft.title || page.draft.title },
        warnings,
        source,
        method: "ai",
        imageUrl: page.imageUrl,
      };
    }

    const warnings: string[] = [];
    if (page.method === "none") {
      warnings.push("We couldn't find recipe details on that page — fill in what's missing below.");
    } else {
      if (page.draft.ingredients.length === 0)
        warnings.push("No ingredients were found — add them below.");
      if (page.draft.steps.length === 0) warnings.push("No steps were found — add them below.");
    }
    if (!ai.notConfigured) warnings.push(`AI couldn't help this time: ${ai.message}`);

    return { draft: page.draft, warnings, source, method: "partial", imageUrl: page.imageUrl };
  });

// Downloads an imported page's recipe photo (via the same SSRF-safe fetcher)
// so the browser can resize, strip metadata, and upload it as the recipe
// cover through the normal cover-photo pipeline. Images are capped at 5 MB.
export const fetchImportImage = createServerFn({ method: "POST" })
  .middleware([importAuthMiddleware])
  .validator(z.object({ url: z.string().trim().url() }))
  .handler(async ({ data }): Promise<{ base64: string; mimeType: string }> => {
    const { bytes, mimeType } = await fetchRemoteImage(data.url);
    return { base64: bytes.toString("base64"), mimeType };
  });
