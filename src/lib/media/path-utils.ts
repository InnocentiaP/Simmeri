// Pure, dependency-free helpers (no Supabase import) so they're directly
// testable with Node's built-in test runner, independent of storage.ts's
// Supabase-client import chain.

const EXTENSION_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export function extensionForMimeType(mimeType: string): string {
  return EXTENSION_BY_MIME[mimeType] ?? "jpg";
}

// Always {user_id}/recipes/{recipe_id}/cover/{uuid}.{ext}. userId must be
// sourced by the caller from the authenticated session (e.g. useAuth()'s
// user.id), never from arbitrary caller-provided text — this function only
// assembles the path, it does not derive or validate the identity itself.
export function buildRecipeCoverPath(
  userId: string,
  recipeId: string,
  uuid: string,
  mimeType: string,
): string {
  const ext = extensionForMimeType(mimeType);
  return `${userId}/recipes/${recipeId}/cover/${uuid}.${ext}`;
}
