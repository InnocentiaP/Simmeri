// Pure helpers for importing a recipe from a social-media post's caption via
// the platform's official, public oEmbed endpoint (no login, no scraping).
// Supported: X/Twitter (verified) and TikTok (best effort — its endpoint is
// not always reachable). Instagram, Facebook, and Threads require a Meta app
// token, so those keep using screenshots or video upload.
import { htmlToReadableText } from "./html-to-text.ts";

export type CaptionPlatform = "X" | "TikTok";

export interface SocialPost {
  platform: CaptionPlatform;
  // Canonical post URL, used for the oEmbed request and as the recipe source.
  url: string;
}

function parse(input: string): URL | null {
  try {
    const url = new URL(input.trim());
    return url.protocol === "https:" || url.protocol === "http:" ? url : null;
  } catch {
    return null;
  }
}

export function parseSocialPostUrl(input: string): SocialPost | null {
  const url = parse(input);
  if (!url) return null;
  const host = url.hostname.toLowerCase().replace(/^(www|mobile|m)\./, "");

  if (host === "x.com" || host === "twitter.com") {
    const m = /^\/([A-Za-z0-9_]{1,15})\/status(?:es)?\/(\d{5,25})(?:\/|$)/.exec(url.pathname);
    return m ? { platform: "X", url: `https://x.com/${m[1]}/status/${m[2]}` } : null;
  }

  if (host === "tiktok.com") {
    const m = /^\/@([A-Za-z0-9._]{1,40})\/(?:video|photo)\/(\d{5,25})(?:\/|$)/.exec(url.pathname);
    return m ? { platform: "TikTok", url: `https://www.tiktok.com/@${m[1]}/video/${m[2]}` } : null;
  }
  if (host === "vm.tiktok.com" || host === "vt.tiktok.com") {
    const m = /^\/([A-Za-z0-9]{5,20})\/?$/.exec(url.pathname);
    return m ? { platform: "TikTok", url: `https://${host}/${m[1]}/` } : null;
  }
  return null;
}

export function buildOEmbedUrl(post: SocialPost): string {
  const target = encodeURIComponent(post.url);
  return post.platform === "X"
    ? `https://publish.twitter.com/oembed?url=${target}&omit_script=1&dnt=true`
    : `https://www.tiktok.com/oembed?url=${target}`;
}

export interface SocialCaption {
  text: string;
  author: string | null;
  thumbnailUrl: string | null;
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function httpUrl(value: unknown): string | null {
  const raw = str(value);
  const url = raw ? parse(raw) : null;
  return url ? url.toString() : null;
}

// Pulls the caption out of an oEmbed response. X returns the post as an
// HTML blockquote; TikTok returns the caption as `title`.
export function captionFromOEmbed(platform: CaptionPlatform, json: unknown): SocialCaption | null {
  if (typeof json !== "object" || json === null) return null;
  const data = json as Record<string, unknown>;
  const author = str(data.author_name);

  if (platform === "X") {
    const html = str(data.html);
    if (!html) return null;
    // Drop the trailing "— Name (@handle) date" attribution line.
    const body = html.replace(/&mdash;[\s\S]*$/i, "").replace(/—[\s\S]*$/, "");
    const text = htmlToReadableText(body);
    return text ? { text, author, thumbnailUrl: null } : null;
  }

  const text = str(data.title);
  return text ? { text, author, thumbnailUrl: httpUrl(data.thumbnail_url) } : null;
}

// Captions shorter than this can't hold a recipe ("so good 😋 #food").
export const MIN_RECIPE_CAPTION_CHARS = 60;

export function captionMayHoldRecipe(text: string): boolean {
  return text.replace(/\s+/g, " ").trim().length >= MIN_RECIPE_CAPTION_CHARS;
}

// Finds the first http(s) link in shared text, e.g. "Check this out!
// https://vm.tiktok.com/ZMabc/" from a phone's share sheet.
export function extractFirstUrl(text: string): string | null {
  const m = /https?:\/\/[^\s<>"']+/i.exec(text);
  return m ? m[0].replace(/[).,!?]+$/, "") : null;
}
