import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { importAuthMiddleware } from "./import-auth.server";
import { runAiVideoRecipeExtraction } from "./ai-extract.server";
import { isAiRateLimited } from "./ai-rate-limit.server";
import {
  AI_RATE_LIMIT_EXCEEDED_MESSAGE,
  mapGeminiErrorToUserMessage,
} from "./gemini-error-messages";
import { deleteGeminiFile, getGeminiFile, startGeminiVideoUpload } from "./gemini-client.server";
import {
  buildVideoDisplayName,
  checkVideoUpload,
  isGeminiFileName,
  isVideoOwnedBy,
  parseYouTubeUrl,
  prepareWrittenRecipeText,
  VIDEO_MIME_TYPES,
} from "./video-source";
import { fetchYouTubeDescription } from "./youtube-description.server";
import type { ImportResult } from "./types";

// How long one call waits for Gemini to finish processing an upload before
// handing back "processing" so the browser asks again. A call that had to
// wait never also runs the (up to 50 s) AI read, so every invocation stays
// under the 60 s serverless limit.
const PROCESSING_WAIT_MS = 20_000;
const POLL_INTERVAL_MS = 2_000;
const NOT_FOUND_MESSAGE = "We couldn't find that video upload. Please try uploading it again.";

const VIDEO_WARNING =
  "Meri watched this video. Amounts that weren't said or shown are left blank — please fill them in.";

function videoWarnings(writtenText: string | null, wasPasted: boolean): string[] {
  if (writtenText) {
    return [
      wasPasted
        ? "Meri combined the video with the caption you pasted — amounts come from the text where it had them."
        : "Meri combined the video with its YouTube description — amounts come from the description where it had them.",
      "Anything neither source stated is left blank — please fill it in.",
    ];
  }
  return [
    VIDEO_WARNING,
    "Tip: if the video's description or caption lists the recipe, paste it in the Video tab and import again for exact amounts.",
  ];
}

function userIdOf(context: unknown): string {
  return (context as { userId: string }).userId;
}

// The browser's origin for this request, used to bind the upload session.
// Only the app's own origin is ever used — a mismatched Origin header falls
// back to the origin of the request URL itself.
function appOrigin(): string {
  const request = getRequest();
  const own = new URL(request.url).origin;
  const header = request.headers.get("origin");
  return header === own ? header : own;
}

// Step 1 of uploading a video: checks the file and the user's AI allowance,
// then opens an upload session the browser can send the video to directly.
export const startVideoImport = createServerFn({ method: "POST" })
  .middleware([importAuthMiddleware])
  .validator(
    z.object({
      mimeType: z.enum(VIDEO_MIME_TYPES),
      sizeBytes: z.number().int().positive(),
      durationSeconds: z.number().positive().nullable(),
    }),
  )
  .handler(async ({ data, context }): Promise<{ uploadUrl: string }> => {
    const userId = userIdOf(context);
    const check = checkVideoUpload(data);
    if (!check.ok) throw new Error(check.message);
    if (isAiRateLimited(userId)) throw new Error(AI_RATE_LIMIT_EXCEEDED_MESSAGE);

    const session = await startGeminiVideoUpload({
      sizeBytes: data.sizeBytes,
      mimeType: data.mimeType,
      displayName: buildVideoDisplayName(userId, crypto.randomUUID()),
      origin: appOrigin(),
    });
    if (!session.ok) throw new Error(mapGeminiErrorToUserMessage(session.category));
    return { uploadUrl: session.uploadUrl };
  });

export type VideoImportResponse =
  { status: "processing" } | { status: "done"; result: ImportResult };

// Step 2: Meri watches the video and drafts the recipe — either a public
// YouTube link or a video the user just uploaded. Uploaded files must carry
// the caller's ownership tag, and are deleted right after reading (or on
// failure). Returns "processing" while Gemini is still preparing an upload;
// the browser then calls again. Never saves anything.
export const extractRecipeFromVideo = createServerFn({ method: "POST" })
  .middleware([importAuthMiddleware])
  .validator(
    z.discriminatedUnion("kind", [
      z.object({
        kind: z.literal("youtube"),
        url: z.string().trim().url(),
        writtenText: z.string().max(20_000).optional(),
      }),
      z.object({
        kind: z.literal("upload"),
        fileName: z.string().trim(),
        writtenText: z.string().max(20_000).optional(),
      }),
    ]),
  )
  .handler(async ({ data, context }): Promise<VideoImportResponse> => {
    const userId = userIdOf(context);

    // Text the user pasted (a caption or description) always wins; for
    // YouTube, the description is fetched automatically when it isn't.
    const pasted = prepareWrittenRecipeText(data.writtenText);

    if (data.kind === "youtube") {
      const watchUrl = parseYouTubeUrl(data.url);
      if (!watchUrl) throw new Error("That doesn't look like a public YouTube video link.");
      const videoId = new URL(watchUrl).searchParams.get("v");
      const writtenText =
        pasted ?? prepareWrittenRecipeText(videoId ? await fetchYouTubeDescription(videoId) : null);
      const ai = await runAiVideoRecipeExtraction(userId, { fileUri: watchUrl, writtenText });
      if (!ai.ok) {
        throw new Error(`${ai.message} Private and unlisted YouTube videos can't be read.`);
      }
      return {
        status: "done",
        result: {
          draft: { ...ai.draft, title: ai.draft.title || "YouTube recipe" },
          warnings: videoWarnings(writtenText, pasted !== null),
          source: { url: watchUrl, title: ai.draft.title || null },
          method: "video",
          imageUrl: videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : null,
        },
      };
    }

    if (!isGeminiFileName(data.fileName)) throw new Error(NOT_FOUND_MESSAGE);

    const deadline = Date.now() + PROCESSING_WAIT_MS;
    let lookup = await getGeminiFile(data.fileName);
    if (!lookup.ok || !isVideoOwnedBy(lookup.file.displayName, userId)) {
      throw new Error(NOT_FOUND_MESSAGE);
    }
    const hadToWait = lookup.file.state === "PROCESSING";
    while (lookup.ok && lookup.file.state === "PROCESSING" && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      lookup = await getGeminiFile(data.fileName);
    }
    if (!lookup.ok) throw new Error(mapGeminiErrorToUserMessage(lookup.category));
    // Ready now, but this call already spent its time waiting: let the
    // browser's next call do the AI read with a full time budget.
    if (lookup.file.state === "PROCESSING" || (hadToWait && lookup.file.state === "ACTIVE")) {
      return { status: "processing" };
    }

    try {
      if (lookup.file.state !== "ACTIVE" || !lookup.file.uri) {
        throw new Error(
          "Meri couldn't process that video. Try a different file format or a shorter clip.",
        );
      }
      const ai = await runAiVideoRecipeExtraction(
        userId,
        { fileUri: lookup.file.uri, mimeType: lookup.file.mimeType, writtenText: pasted },
        { alreadyCounted: true },
      );
      if (!ai.ok) throw new Error(ai.message);
      return {
        status: "done",
        result: {
          draft: { ...ai.draft, title: ai.draft.title || "Video recipe" },
          warnings: videoWarnings(pasted, true),
          source: { url: null, title: null },
          method: "video",
        },
      };
    } finally {
      // The video is only needed for this one read.
      await deleteGeminiFile(data.fileName);
    }
  });
