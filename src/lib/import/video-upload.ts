// Browser-only orchestration of a video import: check the file, open an
// upload session (server), upload the bytes straight to the AI provider with
// progress, then ask the server to read it — repeating while the provider is
// still processing the upload.
import { checkVideoUpload, VIDEO_MIME_TYPES, type VideoMimeType } from "./video-source";
import { extractRecipeFromVideo, startVideoImport } from "./recipe-video-import.functions";
import type { ImportResult } from "./types";

const EXTENSION_MIME: Record<string, VideoMimeType> = {
  mp4: "video/mp4",
  m4v: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
  "3gp": "video/3gpp",
  mpeg: "video/mpeg",
  mpg: "video/mpeg",
};

// Some browsers leave File.type empty (or non-standard) for .mov/.3gp files.
export function videoMimeTypeOf(file: File): string {
  if ((VIDEO_MIME_TYPES as readonly string[]).includes(file.type)) return file.type;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return EXTENSION_MIME[ext] ?? file.type;
}

// Reads the duration from the file's metadata; null if the browser can't.
export function readVideoDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    const done = (value: number | null) => {
      URL.revokeObjectURL(url);
      resolve(value);
    };
    const timer = setTimeout(() => done(null), 5000);
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      clearTimeout(timer);
      done(Number.isFinite(video.duration) ? video.duration : null);
    };
    video.onerror = () => {
      clearTimeout(timer);
      done(null);
    };
    video.src = url;
  });
}

function uploadWithProgress(
  uploadUrl: string,
  file: File,
  onProgress: (fraction: number) => void,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", uploadUrl);
    xhr.setRequestHeader("X-Goog-Upload-Offset", "0");
    xhr.setRequestHeader("X-Goog-Upload-Command", "upload, finalize");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded / e.total);
    };
    xhr.onload = () => {
      try {
        const name = JSON.parse(xhr.responseText)?.file?.name;
        if (xhr.status >= 200 && xhr.status < 300 && typeof name === "string") resolve(name);
        else reject(new Error("The video upload didn't finish. Please try again."));
      } catch {
        reject(new Error("The video upload didn't finish. Please try again."));
      }
    };
    xhr.onerror = () =>
      reject(new Error("The video upload failed. Check your connection and try again."));
    xhr.send(file);
  });
}

export type VideoImportPhase =
  { kind: "checking" } | { kind: "uploading"; fraction: number } | { kind: "watching" };

const MAX_PROCESSING_ROUNDS = 8;

export async function importRecipeFromVideoFile(
  file: File,
  onPhase: (phase: VideoImportPhase) => void,
): Promise<ImportResult> {
  onPhase({ kind: "checking" });
  const mimeType = videoMimeTypeOf(file);
  const durationSeconds = await readVideoDuration(file);
  const check = checkVideoUpload({ mimeType, sizeBytes: file.size, durationSeconds });
  if (!check.ok) throw new Error(check.message);

  const { uploadUrl } = await startVideoImport({
    data: {
      mimeType: mimeType as VideoMimeType,
      sizeBytes: file.size,
      durationSeconds,
    },
  });

  onPhase({ kind: "uploading", fraction: 0 });
  const fileName = await uploadWithProgress(uploadUrl, file, (fraction) =>
    onPhase({ kind: "uploading", fraction }),
  );

  onPhase({ kind: "watching" });
  for (let round = 0; round < MAX_PROCESSING_ROUNDS; round++) {
    const response = await extractRecipeFromVideo({ data: { kind: "upload", fileName } });
    if (response.status === "done") return response.result;
  }
  throw new Error("That video is taking too long to process. Try a shorter clip.");
}

export async function importRecipeFromYouTube(url: string): Promise<ImportResult> {
  const response = await extractRecipeFromVideo({ data: { kind: "youtube", url } });
  if (response.status !== "done") throw new Error("Meri couldn't watch that video. Try again.");
  return response.result;
}
