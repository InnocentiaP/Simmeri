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

// Always {user_id}/cooking-history/{cooking_history_id}/{uuid}.{ext} — the
// same owner-first-segment shape as buildRecipeCoverPath above, so the
// existing recipe-media Storage policies (which key only on path segment 1)
// cover this path too without any new policy. Added narrowly alongside the
// existing cover path builder rather than generalizing it into one
// parameterized function, so recipe-cover uploads are untouched.
export function buildCookingPhotoPath(
  userId: string,
  cookingHistoryId: string,
  uuid: string,
  mimeType: string,
): string {
  const ext = extensionForMimeType(mimeType);
  return `${userId}/cooking-history/${cookingHistoryId}/${uuid}.${ext}`;
}
