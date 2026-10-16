import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { importAuthMiddleware } from "./import-auth.server";
import { fetchPublicJson } from "./url-fetch.server";
import { runAiRecipeExtraction } from "./ai-extract.server";
import {
  buildOEmbedUrl,
  captionFromOEmbed,
  captionMayHoldRecipe,
  parseSocialPostUrl,
} from "./social-link";
import type { ImportResult } from "./types";

function noCaptionMessage(platform: string): string {
  return `We couldn't read a recipe from that ${platform} post's caption. Save the video and upload it in the “Video” tab, or screenshot the caption and use “Photo / screenshot”.`;
}

// Imports a recipe from a public X or TikTok post: reads the caption through
// the platform's official oEmbed endpoint (via the SSRF-safe fetcher), then
// Meri turns it into a draft. Many creators put the whole recipe in the
// caption; when they don't, the user is pointed to video or screenshot
// import instead. Never saves anything.
export const extractRecipeFromSocialLink = createServerFn({ method: "POST" })
  .middleware([importAuthMiddleware])
  .validator(z.object({ url: z.string().trim().url() }))
  .handler(async ({ data, context }): Promise<ImportResult> => {
    const userId = (context as { userId: string }).userId;
    const post = parseSocialPostUrl(data.url);
    if (!post) throw new Error("That doesn't look like a link to a single X or TikTok post.");

    let json: unknown;
    try {
      json = await fetchPublicJson(buildOEmbedUrl(post));
    } catch {
      throw new Error(noCaptionMessage(post.platform));
    }
    const caption = captionFromOEmbed(post.platform, json);
    if (!caption || !captionMayHoldRecipe(caption.text)) {
      throw new Error(noCaptionMessage(post.platform));
    }

    const byline = caption.author ? ` by ${caption.author}` : "";
    const ai = await runAiRecipeExtraction(
      userId,
      `${post.platform} post caption${byline}:\n\n${caption.text}`,
    );
    if (!ai.ok) throw new Error(ai.message);
    if (ai.draft.ingredients.length === 0 && ai.draft.steps.length === 0) {
      throw new Error(noCaptionMessage(post.platform));
    }

    const warnings = [
      `Meri read this from the ${post.platform} post's caption. Check quantities and steps — anything only shown in the video isn't included.`,
    ];
    if (ai.draft.ingredients.length === 0)
      warnings.push("No ingredients were found — add them below.");
    if (ai.draft.steps.length === 0) warnings.push("No steps were found — add them below.");

    return {
      draft: { ...ai.draft, title: ai.draft.title || `${post.platform} recipe` },
      warnings,
      source: {
        url: post.url,
        title: caption.author
          ? `${post.platform} post by ${caption.author}`
          : `${post.platform} post`,
      },
      method: "social",
      imageUrl: caption.thumbnailUrl,
    };
  });
