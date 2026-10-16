import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { importAuthMiddleware } from "./import-auth.server";
import { runAiImageRecipeExtraction } from "./ai-extract.server";
import { AI_IMAGE_MIME_TYPES, checkAiImagePayloads, MAX_AI_IMAGES } from "./image-payload";
import type { ImportResult } from "./types";

const requestSchema = z.object({
  images: z
    .array(
      z.object({
        mimeType: z.enum(AI_IMAGE_MIME_TYPES),
        // Shape/size are re-checked precisely below; this bounds parsing.
        base64: z.string().min(1).max(2_200_000),
      }),
    )
    .min(1)
    .max(MAX_AI_IMAGES),
});

// Screenshot/photo import: Meri (Gemini) reads the recipe text visible in up
// to five images. Each image is checked against its real bytes before
// anything is sent to AI. Images are never stored — they exist only for the
// length of this request. Never saves a recipe; the draft goes to review.
export const extractRecipeFromImages = createServerFn({ method: "POST" })
  .middleware([importAuthMiddleware])
  .validator(requestSchema)
  .handler(async ({ data, context }): Promise<ImportResult> => {
    const userId = (context as { userId: string }).userId;

    const check = checkAiImagePayloads(
      data.images,
      (base64) => new Uint8Array(Buffer.from(base64.slice(0, 64), "base64")),
    );
    if (!check.ok) throw new Error(check.message);

    const ai = await runAiImageRecipeExtraction(userId, data.images);
    if (!ai.ok) throw new Error(ai.message);

    const warnings = [
      "Meri read this from your images. Check quantities and steps — handwriting and small text are easy to misread.",
    ];
    if (ai.draft.ingredients.length === 0)
      warnings.push("No ingredients were found — add them below.");
    if (ai.draft.steps.length === 0) warnings.push("No steps were found — add them below.");

    return {
      draft: { ...ai.draft, title: ai.draft.title || "Imported recipe" },
      warnings,
      source: { url: null, title: null },
      method: "images",
    };
  });
