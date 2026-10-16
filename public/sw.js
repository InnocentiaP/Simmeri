// Simmeri service worker — share target only.
//
// When Simmeri is installed as an app (Android), it appears in the phone's
// Share menu. Sharing a link, text, photo, or video sends a POST to
// /share-target; this worker catches it, keeps the shared items in a
// private cache for a moment, and opens the Import page, which picks them
// up (src/lib/import/share-target.ts). It does not cache pages or work
// offline: every other request goes to the network untouched.

const SHARE_CACHE = "simmeri-share-target";
const SHARE_PREFIX = "/__share__/";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "POST" || url.origin !== self.location.origin) return;
  if (url.pathname !== "/share-target") return;
  event.respondWith(handleShare(event.request));
});

async function handleShare(request) {
  try {
    const form = await request.formData();
    const cache = await caches.open(SHARE_CACHE);
    // Only the latest share is kept.
    for (const key of await cache.keys()) await cache.delete(key);

    const files = form.getAll("media").filter((item) => typeof item !== "string");
    const meta = {
      title: String(form.get("title") || ""),
      text: String(form.get("text") || ""),
      url: String(form.get("url") || ""),
      files: files.map((file, i) => ({
        key: `${SHARE_PREFIX}file-${i}`,
        name: file.name,
        type: file.type,
      })),
      sharedAt: Date.now(),
    };
    await Promise.all(
      files.map((file, i) =>
        cache.put(
          `${SHARE_PREFIX}file-${i}`,
          new Response(file, { headers: { "content-type": file.type } }),
        ),
      ),
    );
    await cache.put(
      `${SHARE_PREFIX}meta`,
      new Response(JSON.stringify(meta), { headers: { "content-type": "application/json" } }),
    );
  } catch {
    // Fall through: the Import page opens without a shared item.
  }
  return Response.redirect("/app/recipes/import?shared=1", 303);
}
