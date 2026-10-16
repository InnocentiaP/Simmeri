// Browser-only: reads (once) whatever was shared to Simmeri from the phone's
// Share menu. public/sw.js stores it in a private cache before opening the
// Import page with ?shared=1. Items older than 10 minutes are ignored, and
// the cache is always cleared after reading.
const SHARE_CACHE = "simmeri-share-target";
const MAX_AGE_MS = 10 * 60 * 1000;

export interface SharedPayload {
  title: string;
  text: string;
  url: string;
  files: File[];
}

interface StoredMeta {
  title: string;
  text: string;
  url: string;
  files: { key: string; name: string; type: string }[];
  sharedAt: number;
}

export async function takeSharedPayload(): Promise<SharedPayload | null> {
  if (typeof caches === "undefined") return null;
  try {
    const cache = await caches.open(SHARE_CACHE);
    const metaResponse = await cache.match("/__share__/meta");
    if (!metaResponse) return null;
    const meta = (await metaResponse.json()) as StoredMeta;

    const files: File[] = [];
    if (Date.now() - meta.sharedAt <= MAX_AGE_MS) {
      for (const entry of meta.files) {
        const res = await cache.match(entry.key);
        if (res)
          files.push(new File([await res.blob()], entry.name || "shared", { type: entry.type }));
      }
    }
    for (const key of await cache.keys()) await cache.delete(key);

    if (Date.now() - meta.sharedAt > MAX_AGE_MS) return null;
    return { title: meta.title, text: meta.text, url: meta.url, files };
  } catch {
    return null;
  }
}

// Registers the share-target worker. Safe to call on every page load.
export function registerShareTargetWorker(): void {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  if (!window.isSecureContext) return;
  navigator.serviceWorker.register("/sw.js").catch(() => {
    // Sharing into Simmeri just won't be available; nothing else depends on it.
  });
}
