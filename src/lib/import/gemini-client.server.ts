import {
  buildGeminiPrompt,
  SYSTEM_INSTRUCTION,
  GEMINI_RESPONSE_SCHEMA,
  buildGeminiEditPrompt,
  EDIT_SYSTEM_INSTRUCTION,
} from "./gemini-prompt";

// Model configuration is isolated here and never accepted from a request
// body — matches the PRD's "price identifiers/plan mappings must not be
// accepted from untrusted request bodies" principle applied to model choice.
const GEMINI_MODEL = "gemini-3.5-flash";;
const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";
// 20s: generation is slower than the 8s HTML-fetch timeout in ./url-fetch.server.ts.
// Must be re-checked against the actual Vercel plan's serverless function
// duration limit before relying on it in production (see plan section D/Q).
const GEMINI_TIMEOUT_MS = 20_000;
const GEMINI_MAX_OUTPUT_TOKENS = 8192;

const isDev = process.env.NODE_ENV !== "production";

// Dev-only diagnostics, mirroring ./url-fetch.server.ts's devLog convention
// exactly: never passed the API key, never passed full recipe text/response
// content in production (in dev, at most a short preview).
function devLog(...args: unknown[]) {
  if (isDev) console.error("[recipe-import:gemini]", ...args);
}

interface GeminiGenerateContentResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
  }>;
}

function extractResponseText(json: GeminiGenerateContentResponse): string | null {
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
  return typeof text === "string" && text.trim().length > 0 ? text : null;
}

export type GeminiCallResult =
  | { ok: true; rawText: string; model: string }
  | {
      ok: false;
      category: "not_configured" | "timeout" | "network" | "rate_limited" | "upstream_error";
    };

// Direct REST call (no SDK — see plan section D) to Gemini's generateContent
// endpoint. systemInstruction carries every behavior rule; contents carries
// only the caller-supplied prompt text (already-cleaned/truncated page text
// for extraction, or a serialized current-recipe JSON for cleanup — never a
// URL, never other user data). No automatic retry — a single manual "Try
// again" is exposed to the user instead (see recipe-ai-import.functions.ts /
// recipe-ai-edit.functions.ts and their review UIs).
//
// Shared by both AI Recipe entry points (Import's extraction and Edit's
// cleanup) — model/endpoint/timeout/output-token cap, the fetch call itself,
// and every error category below are identical for both; only which
// systemInstruction/prompt pair is sent differs, via the two thin wrappers
// beneath this function.
async function callGemini(
  systemInstruction: string,
  userPrompt: string,
  logLabel: string,
): Promise<GeminiCallResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    devLog(logLabel, "missing GEMINI_API_KEY");
    return { ok: false, category: "not_configured" };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);
  const startedAt = Date.now();

  try {
    const response = await fetch(
      `${GEMINI_API_BASE}/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        signal: controller.signal,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { role: "system", parts: [{ text: systemInstruction }] },
          contents: [{ role: "user", parts: [{ text: userPrompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: GEMINI_RESPONSE_SCHEMA,
            maxOutputTokens: GEMINI_MAX_OUTPUT_TOKENS,
          },
        }),
      },
    );
    clearTimeout(timer);
    const durationMs = Date.now() - startedAt;

    if (response.status === 429) {
      devLog(logLabel, "rate limited by Gemini", { durationMs });
      return { ok: false, category: "rate_limited" };
    }
    if (!response.ok) {
      devLog(logLabel, "non-2xx response from Gemini", { status: response.status, durationMs });
      return { ok: false, category: "upstream_error" };
    }

    const json = (await response.json()) as GeminiGenerateContentResponse;
    const rawText = extractResponseText(json);
    if (!rawText) {
      devLog(logLabel, "Gemini returned no usable text", { durationMs });
      return { ok: false, category: "upstream_error" };
    }

    devLog(logLabel, "success", { model: GEMINI_MODEL, durationMs });
    return { ok: true, rawText, model: GEMINI_MODEL };
  } catch (err) {
    clearTimeout(timer);
    if (controller.signal.aborted) {
      devLog(logLabel, "timeout after", GEMINI_TIMEOUT_MS, "ms");
      return { ok: false, category: "timeout" };
    }
    devLog(logLabel, "network error", err instanceof Error ? err.message : String(err));
    return { ok: false, category: "network" };
  }
}

// Used by the deterministic-import "Improve with AI" flow. Behavior is
// unchanged from before this function was factored out of a single
// monolithic implementation — same model, endpoint, timeout, prompt, and
// error mapping.
export async function callGeminiForRecipeExtraction(cleanedText: string): Promise<GeminiCallResult> {
  return callGemini(SYSTEM_INSTRUCTION, buildGeminiPrompt(cleanedText), "extraction");
}

// Used by the Edit Recipe "Clean up with AI" flow. recipeJson is the
// caller's already-serialized current-recipe payload (see
// buildAiEditRequestPayload in ./ai-normalize.ts) — this function performs
// no serialization itself, matching callGeminiForRecipeExtraction's own
// separation between prompt-building (./gemini-prompt.ts) and the network
// call.
export async function callGeminiForRecipeCleanup(recipeJson: string): Promise<GeminiCallResult> {
  return callGemini(EDIT_SYSTEM_INSTRUCTION, buildGeminiEditPrompt(recipeJson), "cleanup");
}
