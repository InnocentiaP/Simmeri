import {
  buildGeminiPrompt,
  buildGeminiImagePrompt,
  buildGeminiVideoPrompt,
  SYSTEM_INSTRUCTION,
  GEMINI_RESPONSE_SCHEMA,
  buildGeminiEditPrompt,
  EDIT_SYSTEM_INSTRUCTION,
} from "./gemini-prompt";

// Model configuration is isolated here and never accepted from a request
// body — matches the PRD's "price identifiers/plan mappings must not be
// accepted from untrusted request bodies" principle applied to model choice.
const GEMINI_MODEL = "gemini-3.8-flash";
const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";
const GEMINI_UPLOAD_BASE = "https://generativelanguage.googleapis.com/upload/v1beta";
// 20s: generation is slower than the 8s HTML-fetch timeout in ./url-fetch.server.ts.
// Must be re-checked against the actual Vercel plan's serverless function
// duration limit before relying on it in production (see plan section D/Q).
const GEMINI_TIMEOUT_MS = 20_000;
// Reading several screenshots takes noticeably longer than reading text.
const GEMINI_IMAGE_TIMEOUT_MS = 45_000;
// Watching a video (uploaded or YouTube) is the slowest call of all — a
// 5-minute recipe video took ~28 s in testing. Must stay below the 60 s
// serverless limit set in vite.config.ts.
const GEMINI_VIDEO_TIMEOUT_MS = 50_000;
const GEMINI_FILES_TIMEOUT_MS = 15_000;
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
type GeminiPart =
  | { text: string }
  | { inline_data: { mime_type: string; data: string } }
  | { file_data: { file_uri: string; mime_type?: string } };

async function callGemini(
  systemInstruction: string,
  parts: GeminiPart[],
  logLabel: string,
  timeoutMs: number = GEMINI_TIMEOUT_MS,
  extraGenerationConfig: Record<string, unknown> = {},
): Promise<GeminiCallResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    devLog(logLabel, "missing GEMINI_API_KEY");
    return { ok: false, category: "not_configured" };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();

  try {
    const response = await fetch(`${GEMINI_API_BASE}/models/${GEMINI_MODEL}:generateContent`, {
      method: "POST",
      signal: controller.signal,
      // Key in a header (not the URL) so it never lands in request logs.
      headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        systemInstruction: { role: "system", parts: [{ text: systemInstruction }] },
        contents: [{ role: "user", parts }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: GEMINI_RESPONSE_SCHEMA,
          maxOutputTokens: GEMINI_MAX_OUTPUT_TOKENS,
          ...extraGenerationConfig,
        },
      }),
    });
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
      devLog(logLabel, "timeout after", timeoutMs, "ms");
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
export async function callGeminiForRecipeExtraction(
  cleanedText: string,
): Promise<GeminiCallResult> {
  return callGemini(SYSTEM_INSTRUCTION, [{ text: buildGeminiPrompt(cleanedText) }], "extraction");
}

// Used by the Edit Recipe "Clean up with AI" flow. recipeJson is the
// caller's already-serialized current-recipe payload (see
// buildAiEditRequestPayload in ./ai-normalize.ts) — this function performs
// no serialization itself, matching callGeminiForRecipeExtraction's own
// separation between prompt-building (./gemini-prompt.ts) and the network
// call.
export async function callGeminiForRecipeCleanup(recipeJson: string): Promise<GeminiCallResult> {
  return callGemini(
    EDIT_SYSTEM_INSTRUCTION,
    [{ text: buildGeminiEditPrompt(recipeJson) }],
    "cleanup",
  );
}

// Used by screenshot/photo import. Same system instruction and response
// schema as text extraction; the images are untrusted content just like
// page text, and the instruction text sits in its own part after them.
export async function callGeminiForImageRecipeExtraction(
  images: readonly { mimeType: string; base64: string }[],
): Promise<GeminiCallResult> {
  const parts: GeminiPart[] = [
    ...images.map((image) => ({ inline_data: { mime_type: image.mimeType, data: image.base64 } })),
    { text: buildGeminiImagePrompt(images.length) },
  ];
  return callGemini(SYSTEM_INSTRUCTION, parts, "image-extraction", GEMINI_IMAGE_TIMEOUT_MS);
}

// Used by video import, for both an uploaded file (its Files API uri) and a
// public YouTube watch URL — Gemini accepts either as file_data. Low media
// resolution is plenty to follow a cooking video and keeps token use down.
export async function callGeminiForVideoRecipeExtraction(video: {
  fileUri: string;
  mimeType?: string;
}): Promise<GeminiCallResult> {
  const parts: GeminiPart[] = [
    {
      file_data: {
        file_uri: video.fileUri,
        ...(video.mimeType ? { mime_type: video.mimeType } : {}),
      },
    },
    { text: buildGeminiVideoPrompt() },
  ];
  return callGemini(SYSTEM_INSTRUCTION, parts, "video-extraction", GEMINI_VIDEO_TIMEOUT_MS, {
    mediaResolution: "MEDIA_RESOLUTION_LOW",
  });
}

// ---------------------------------------------------------------------------
// Files API (uploaded videos)
// ---------------------------------------------------------------------------

export interface GeminiFile {
  name: string;
  displayName?: string;
  mimeType?: string;
  uri?: string;
  state?: "STATE_UNSPECIFIED" | "PROCESSING" | "ACTIVE" | "FAILED";
}

type FilesFailure = { ok: false; category: "not_configured" | "network" | "upstream_error" };

async function filesFetch(url: string, init: RequestInit): Promise<Response | FilesFailure> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { ok: false, category: "not_configured" };
  try {
    return await fetch(url, {
      ...init,
      headers: { ...(init.headers as Record<string, string>), "x-goog-api-key": apiKey },
      signal: AbortSignal.timeout(GEMINI_FILES_TIMEOUT_MS),
    });
  } catch (err) {
    devLog("files", "network error", err instanceof Error ? err.message : String(err));
    return { ok: false, category: "network" };
  }
}

// Opens a resumable upload session and returns its one-time upload URL. The
// session is bound to the app's origin, so the browser can upload the video
// straight to Gemini (with proper CORS) without the API key ever leaving the
// server and without the bytes passing through our serverless functions.
export async function startGeminiVideoUpload(input: {
  sizeBytes: number;
  mimeType: string;
  displayName: string;
  origin: string;
}): Promise<{ ok: true; uploadUrl: string } | FilesFailure> {
  const res = await filesFetch(`${GEMINI_UPLOAD_BASE}/files`, {
    method: "POST",
    headers: {
      Origin: input.origin,
      "X-Goog-Upload-Protocol": "resumable",
      "X-Goog-Upload-Command": "start",
      "X-Goog-Upload-Header-Content-Length": String(input.sizeBytes),
      "X-Goog-Upload-Header-Content-Type": input.mimeType,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ file: { display_name: input.displayName } }),
  });
  if (!(res instanceof Response)) return res;
  const uploadUrl = res.headers.get("x-goog-upload-url");
  if (!res.ok || !uploadUrl) {
    devLog("files", "upload start failed", { status: res.status });
    return { ok: false, category: "upstream_error" };
  }
  return { ok: true, uploadUrl };
}

export async function getGeminiFile(
  name: string,
): Promise<{ ok: true; file: GeminiFile } | FilesFailure> {
  const res = await filesFetch(`${GEMINI_API_BASE}/${name}`, { method: "GET" });
  if (!(res instanceof Response)) return res;
  if (!res.ok) {
    devLog("files", "get failed", { status: res.status });
    return { ok: false, category: "upstream_error" };
  }
  return { ok: true, file: (await res.json()) as GeminiFile };
}

// Best effort: Gemini also deletes every file automatically after 48 hours.
export async function deleteGeminiFile(name: string): Promise<void> {
  const res = await filesFetch(`${GEMINI_API_BASE}/${name}`, { method: "DELETE" });
  if (res instanceof Response && !res.ok) devLog("files", "delete failed", { status: res.status });
}
