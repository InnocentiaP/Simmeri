import { supabase } from "@/integrations/supabase/client";

export { extensionForMimeType, buildRecipeCoverPath, buildCookingPhotoPath } from "./path-utils";

export const RECIPE_MEDIA_BUCKET = "recipe-media";

export async function uploadRecipeMedia(path: string, blob: Blob, mimeType: string): Promise<void> {
  const { error } = await supabase.storage
    .from(RECIPE_MEDIA_BUCKET)
    .upload(path, blob, { contentType: mimeType, upsert: false });
  if (error) throw error;
}

// Best-effort removal — callers decide how to handle/report failure; this
// never silently swallows the error itself (that's a caller-level choice,
// e.g. a non-blocking toast for cleanup-only removals vs. a hard failure
// for a user-initiated "Remove cover" action).
export async function removeRecipeMedia(bucket: string, paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  const { error } = await supabase.storage.from(bucket).remove(paths);
  if (error) throw error;
}

// Returns null (never throws) on any failure, including a missing object —
// callers treat null as "show the fallback," not as an error to surface.
export async function createSignedRecipeMediaUrl(
  bucket: string,
  path: string,
  expiresInSeconds = 3600,
): Promise<string | null> {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresInSeconds);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}
