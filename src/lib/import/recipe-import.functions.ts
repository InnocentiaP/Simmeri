import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { importAuthMiddleware } from "./import-auth.server";
import { fetchRecipePageHtml } from "./url-fetch.server";
import { extractJsonLdBlocks, findRecipeNode, mapSchemaOrgRecipeToDraft } from "./jsonld-extract";
import { emptyDraft, type ImportResult } from "./types";

function extractPageTitle(html: string): string | null {
  const m = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  return m ? m[1].trim() || null : null;
}

// The only new server surface this feature adds. Auth is enforced by
// importAuthMiddleware (not by any route guard). Returns a draft or throws —
// it never writes to recipes/recipe_ingredients/recipe_steps itself; saving
// only happens when the user explicitly submits the review form.
export const extractRecipeFromUrl = createServerFn({ method: "POST" })
  .middleware([importAuthMiddleware])
  .validator(z.object({ url: z.string().trim().url() }))
  .handler(async ({ data }): Promise<ImportResult> => {
    const html = await fetchRecipePageHtml(data.url);
    const pageTitle = extractPageTitle(html);
    const node = findRecipeNode(extractJsonLdBlocks(html));

    if (!node) {
      return {
        draft: emptyDraft(pageTitle ?? "Imported recipe"),
        warnings: [
          "We couldn't find recipe details on that page — fill in what's missing below.",
        ],
        source: { url: data.url, title: pageTitle },
      };
    }

    const draft = mapSchemaOrgRecipeToDraft(node);
    const warnings: string[] = [];
    if (draft.ingredients.length === 0) {
      warnings.push("No ingredients were found — add them below.");
    }
    if (draft.steps.length === 0) {
      warnings.push("No steps were found — add them below.");
    }

    return {
      draft,
      warnings,
      source: { url: data.url, title: pageTitle ?? draft.title },
    };
  });
