// Pure decision logic for the trickiest part of cooking-photo covers: which
// (if any) previously-referenced Storage object becomes safe to best-effort
// delete when a recipe's cover changes, and whether deleting a specific
// cooking photo requires clearing the recipe's cover reference first. No I/O
// here — callers (CookingHistoryList) perform the actual DB/Storage calls
// based on what these functions decide, so the decision itself stays
// directly unit-testable.

export interface CoverState {
  bucket: string | null;
  path: string | null;
  source: "direct_upload" | "cooking_photo" | null;
  cookingPhotoId: string | null;
}

export interface CleanupTarget {
  bucket: string;
  path: string;
}

export interface PromoteToCoverResult {
  cleanupEligible: CleanupTarget | null;
}

// Decides what to best-effort delete after promoting `newPhoto` to be the
// recipe's cover. The new cover's own object is never cleanup-eligible.
// Switching between two cooking photos (or re-promoting the same one) never
// marks anything for cleanup — each cooking photo's Storage object stays
// referenced by its own cooking_photos row regardless of which one is
// currently the cover. Only a previous DIRECT-UPLOAD cover, which has no
// other row referencing it, becomes cleanup-eligible.
export function decidePromoteToCoverCleanup(
  currentCover: CoverState,
  newPhoto: { id: string; bucket: string; path: string },
): PromoteToCoverResult {
  if (currentCover.cookingPhotoId === newPhoto.id) {
    return { cleanupEligible: null };
  }
  if (currentCover.source === "direct_upload" && currentCover.bucket && currentCover.path) {
    return { cleanupEligible: { bucket: currentCover.bucket, path: currentCover.path } };
  }
  return { cleanupEligible: null };
}

export interface DeleteCookingPhotoDecision {
  isActiveCover: boolean;
  shouldClearRecipeCover: boolean;
}

// Decides whether deleting `photoId` requires clearing the recipe's cover
// reference first — true only when this exact photo is the current cover.
export function decideCookingPhotoDeletion(
  currentCover: CoverState,
  photoId: string,
): DeleteCookingPhotoDecision {
  const isActiveCover = currentCover.cookingPhotoId === photoId;
  return { isActiveCover, shouldClearRecipeCover: isActiveCover };
}
