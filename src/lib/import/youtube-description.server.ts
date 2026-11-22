// Fetches a public YouTube video's written description through the official
// YouTube Data API v3 (videos.list, 1 quota unit per call). Many recipe
// videos keep the exact ingredient amounts only in the description, which
// AI can't see when it watches the video. Optional: without YOUTUBE_API_KEY
// (or on any error) this returns null and import falls back to the video,
// plus whatever the user pasted.
const ENDPOINT = "https://www.googleapis.com/youtube/v3/videos";
const TIMEOUT_MS = 8000;

const isDev = process.env.NODE_ENV !== "production";
function devLog(...args: unknown[]) {
  if (isDev) console.error("[recipe-import:youtube]", ...args);
}

export function isYouTubeDescriptionConfigured(): boolean {
  return Boolean(process.env.YOUTUBE_API_KEY);
}

export async function fetchYouTubeDescription(videoId: string): Promise<string | null> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey || !/^[A-Za-z0-9_-]{11}$/.test(videoId)) return null;
  try {
    const res = await fetch(`${ENDPOINT}?part=snippet&id=${videoId}`, {
      // Key in a header, not the URL, so it never lands in request logs.
      headers: { "X-Goog-Api-Key": apiKey },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      devLog("videos.list failed", { status: res.status });
      return null;
    }
    const json = (await res.json()) as {
      items?: Array<{ snippet?: { description?: unknown } }>;
    };
    const description = json.items?.[0]?.snippet?.description;
    return typeof description === "string" ? description : null;
  } catch (err) {
    devLog("videos.list error", err instanceof Error ? err.message : String(err));
    return null;
  }
}
