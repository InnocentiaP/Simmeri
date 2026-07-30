import { useQuery } from "@tanstack/react-query";
import { createSignedRecipeMediaUrl } from "./storage";

const SIGNED_URL_TTL_SECONDS = 3600; // ~1 hour
const SIGNED_URL_STALE_MS = 50 * 60 * 1000; // 50 min — under the expiry above

// Never persisted to Postgres — regenerated on render, short-lived by design.
// Returns null (not undefined) whenever bucket/path are absent, still
// loading, or resolution failed (e.g. a missing Storage object), so callers
// can treat "no signed URL" uniformly as "show the fallback."
export function useSignedRecipeMediaUrl(bucket: string | null | undefined, path: string | null | undefined) {
  const enabled = Boolean(bucket && path);
  const query = useQuery({
    queryKey: ["signed-recipe-media-url", bucket, path],
    queryFn: () => createSignedRecipeMediaUrl(bucket as string, path as string, SIGNED_URL_TTL_SECONDS),
    enabled,
    staleTime: SIGNED_URL_STALE_MS,
  });

  return { ...query, data: enabled ? (query.data ?? null) : null };
}
