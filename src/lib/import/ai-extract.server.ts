import { callGeminiForRecipeExtraction } from "./gemini-client.server";
import { parseAiRecipeDraft } from "./ai-draft-schema";
import { normalizeAiDraftToFormValues, type NormalizedRecipeDraft } from "./ai-normalize";
import { isAiRateLimited } from "./ai-rate-limit.server";
import {
  mapGeminiErrorToUserMessage,
  AI_MALFORMED_RESPONSE_MESSAGE,
  AI_RATE_LIMIT_EXCEEDED_MESSAGE,
} from "./gemini-error-messages";

export type AiExtractionOutcome =
  | { ok: true; draft: NormalizedRecipeDraft; model: string }
  | { ok: false; message: string; notConfigured: boolean };

// The one AI extraction pipeline shared by the automatic URL-import fallback
// and the explicit "Improve with AI" action: per-user rate limit → Gemini →
// strict schema validation → normalization to form values. Never throws for
// expected failures; callers decide whether a failure is fatal.
export async function runAiRecipeExtraction(
  userId: string,
  text: string,
): Promise<AiExtractionOutcome> {
  if (isAiRateLimited(userId)) {
    return { ok: false, message: AI_RATE_LIMIT_EXCEEDED_MESSAGE, notConfigured: false };
  }

  const result = await callGeminiForRecipeExtraction(text);
  if (!result.ok) {
    return {
      ok: false,
      message: mapGeminiErrorToUserMessage(result.category),
      notConfigured: result.category === "not_configured",
    };
  }

  const parsed = parseAiRecipeDraft(result.rawText);
  if (!parsed.ok) {
    return { ok: false, message: AI_MALFORMED_RESPONSE_MESSAGE, notConfigured: false };
  }

  return { ok: true, draft: normalizeAiDraftToFormValues(parsed.draft), model: result.model };
}
