import type { SocialPlatform } from "@/lib/import/video-source";

// How to get a social-media recipe video onto your own device so it can be
// uploaded. Only built-in, platform-sanctioned options are suggested
// (the app's own Save button, or the phone's screen recorder) — no
// third-party downloader sites.
export function SaveVideoHelp({ platform }: { platform: SocialPlatform | null }) {
  return (
    <details className="rounded-2xl border border-border/70 bg-background p-3 text-sm text-cocoa">
      <summary className="cursor-pointer font-medium">
        How do I save a {platform ?? "TikTok or Instagram"} video?
      </summary>
      <ul className="mt-2 list-disc space-y-1.5 pl-5 text-cocoa/80">
        {(platform === null || platform === "TikTok") && (
          <li>
            <strong>TikTok:</strong> tap <em>Share</em> → <em>Save video</em>. If it isn't there,
            the creator turned saving off — use screen recording instead.
          </li>
        )}
        {(platform === null || platform === "Instagram") && (
          <li>
            <strong>Instagram:</strong> other people's Reels can't be downloaded in the app. Use
            screen recording while the Reel plays.
          </li>
        )}
        {(platform === "Facebook" || platform === "X" || platform === "Threads") && (
          <li>
            <strong>{platform}:</strong> there's no download option for other people's videos. Use
            screen recording while the video plays.
          </li>
        )}
        <li>
          <strong>Screen recording:</strong> on iPhone, open Control Center → Screen Recording; on
          Android, open Quick Settings → Screen record (choose to record media sound so Meri can
          hear the recipe). Trim the clip to the recipe if you like, then choose it below.
        </li>
        <li>
          <strong>Faster:</strong> if the caption already has the whole recipe, a screenshot of the
          caption in “Photo / screenshot” works too — no video needed.
        </li>
      </ul>
      <p className="mt-2 text-xs text-cocoa/60">
        Saved videos are for your own cooking reference. Keep the original link above so the creator
        is credited as the recipe's source.
      </p>
    </details>
  );
}
