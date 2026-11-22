// Pure rules for video recipe import (shared by client and server):
// recognising YouTube and social-media links, the accepted upload formats
// and limits, and the ownership tag put on each uploaded file.

// ---------------------------------------------------------------------------
// Links
// ---------------------------------------------------------------------------

const YOUTUBE_ID_RE = /^[A-Za-z0-9_-]{11}$/;
const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be",
  "www.youtu.be",
]);

// Returns the canonical watch URL for a public YouTube video link (watch,
// youtu.be, shorts, live, embed), or null when the input isn't one.
export function parseYouTubeUrl(input: string): string | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const host = url.hostname.toLowerCase();
  if (!YOUTUBE_HOSTS.has(host)) return null;

  let id: string | null = null;
  if (host.endsWith("youtu.be")) {
    id = url.pathname.split("/")[1] ?? null;
  } else if (url.pathname === "/watch") {
    id = url.searchParams.get("v");
  } else {
    const m = /^\/(?:shorts|live|embed)\/([^/?#]+)/.exec(url.pathname);
    id = m ? m[1] : null;
  }
  return id && YOUTUBE_ID_RE.test(id) ? `https://www.youtube.com/watch?v=${id}` : null;
}

export type SocialPlatform = "Instagram" | "TikTok" | "Facebook" | "X" | "Threads";

// Platforms whose pages can't be read by apps; the UI points users to the
// screenshot or video-upload options instead.
export function detectSocialPlatform(input: string): SocialPlatform | null {
  let host: string;
  try {
    host = new URL(input.trim()).hostname.toLowerCase().replace(/^www\.|^m\./, "");
  } catch {
    return null;
  }
  if (host === "instagram.com" || host === "instagr.am") return "Instagram";
  if (host === "tiktok.com" || host.endsWith(".tiktok.com")) return "TikTok";
  if (host === "facebook.com" || host === "fb.watch" || host.endsWith(".facebook.com"))
    return "Facebook";
  if (host === "x.com" || host === "twitter.com") return "X";
  if (host === "threads.net" || host === "threads.com") return "Threads";
  return null;
}

// ---------------------------------------------------------------------------
// Uploads
// ---------------------------------------------------------------------------

export const VIDEO_MIME_TYPES = [
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/3gpp",
  "video/mpeg",
] as const;
export type VideoMimeType = (typeof VIDEO_MIME_TYPES)[number];

export const MAX_VIDEO_BYTES = 200 * 1024 * 1024;
// Recipe videos are short; this keeps AI cost and wait time reasonable.
export const MAX_VIDEO_SECONDS = 15 * 60;

export type VideoCheck = { ok: true } | { ok: false; message: string };

export function checkVideoUpload(input: {
  mimeType: string;
  sizeBytes: number;
  durationSeconds: number | null;
}): VideoCheck {
  if (!(VIDEO_MIME_TYPES as readonly string[]).includes(input.mimeType)) {
    return { ok: false, message: "Please use an MP4, MOV, WebM, 3GP, or MPEG video." };
  }
  if (!Number.isFinite(input.sizeBytes) || input.sizeBytes <= 0) {
    return { ok: false, message: "That video file looks empty." };
  }
  if (input.sizeBytes > MAX_VIDEO_BYTES) {
    return { ok: false, message: "That video is larger than 200 MB. Try a shorter clip." };
  }
  if (input.durationSeconds != null && input.durationSeconds > MAX_VIDEO_SECONDS) {
    return {
      ok: false,
      message: "That video is longer than 15 minutes. Try trimming it to the recipe.",
    };
  }
  return { ok: true };
}

// Each uploaded file is tagged with its owner so a user can only ever ask AI
// to read (and delete) their own upload, even though all uploads share one
// AI project. Format: simmeri-video:<userId>:<random nonce>.
const OWNER_PREFIX = "simmeri-video";

export function buildVideoDisplayName(userId: string, nonce: string): string {
  return `${OWNER_PREFIX}:${userId}:${nonce}`;
}

export function isVideoOwnedBy(displayName: unknown, userId: string): boolean {
  if (typeof displayName !== "string") return false;
  const parts = displayName.split(":");
  return (
    parts.length === 3 && parts[0] === OWNER_PREFIX && parts[1] === userId && parts[2].length > 0
  );
}

// Gemini file resource names look like "files/abc123"; anything else is
// rejected before it is put into a request path.
export function isGeminiFileName(name: string): boolean {
  return /^files\/[a-z0-9-]{1,64}$/.test(name);
}

// ---------------------------------------------------------------------------
// Written text that comes with a video (YouTube description, pasted caption)
// ---------------------------------------------------------------------------

export const MAX_WRITTEN_TEXT_CHARS = 6000;
// Shorter than this can't hold an ingredient list ("Yummy! 🍜 #bakso").
const MIN_WRITTEN_TEXT_CHARS = 30;

// Tidies a description/caption before it is sent to AI alongside the video:
// normalises line endings, collapses runs of blank lines and spaces, and caps
// the length (recipes come first in descriptions; long tails are usually
// links and sponsor text). Returns null when there is nothing useful.
export function prepareWrittenRecipeText(text: string | null | undefined): string | null {
  if (!text) return null;
  const tidy = text
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (tidy.length < MIN_WRITTEN_TEXT_CHARS) return null;
  return tidy.length > MAX_WRITTEN_TEXT_CHARS ? tidy.slice(0, MAX_WRITTEN_TEXT_CHARS) : tidy;
}
