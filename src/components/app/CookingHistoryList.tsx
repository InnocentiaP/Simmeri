import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, Trash2, Image as ImageIcon, Star } from "lucide-react";
import {
  listCookingHistory,
  listCookingPhotosForHistoryIds,
  deleteCookingHistoryEntry,
  deleteCookingPhotoMetadata,
  setCookingPhotoAsCover,
  clearRecipeCoverIfMatchesCookingPhoto,
  type Recipe,
  type CookingHistory,
  type CookingPhoto,
} from "@/lib/api";
import { removeRecipeMedia } from "@/lib/media/storage";
import { RecipeCoverImage } from "@/components/app/RecipeCoverImage";
import { CookingHistoryForm } from "@/components/app/CookingHistoryForm";
import {
  decidePromoteToCoverCleanup,
  decideCookingPhotoDeletion,
  type CoverState,
} from "@/lib/media/cover-transition";

type CoverBearingRecipe = Pick<
  Recipe,
  "id" | "cover_storage_bucket" | "cover_storage_path" | "cover_source" | "cover_cooking_photo_id"
>;

interface CookingHistoryListProps {
  recipeId: string;
  recipe: CoverBearingRecipe;
}

function coverStateOf(recipe: CoverBearingRecipe): CoverState {
  return {
    bucket: recipe.cover_storage_bucket,
    path: recipe.cover_storage_path,
    source: recipe.cover_source as CoverState["source"],
    cookingPhotoId: recipe.cover_cooking_photo_id,
  };
}

export function CookingHistoryList({ recipeId, recipe }: CookingHistoryListProps) {
  const qc = useQueryClient();
  const [editingEntry, setEditingEntry] = useState<CookingHistory | null>(null);
  const [confirmDeleteEntry, setConfirmDeleteEntry] = useState<CookingHistory | null>(null);

  const historyQuery = useQuery({
    queryKey: ["cooking-history", recipeId],
    queryFn: () => listCookingHistory(recipeId),
  });

  const historyIds = useMemo(() => (historyQuery.data ?? []).map((h) => h.id), [historyQuery.data]);

  const photosQuery = useQuery({
    queryKey: ["cooking-photos", recipeId, historyIds],
    queryFn: () => listCookingPhotosForHistoryIds(historyIds),
    enabled: historyIds.length > 0,
  });

  const photosByEntry = useMemo(() => {
    const map = new Map<string, CookingPhoto[]>();
    for (const p of photosQuery.data ?? []) {
      map.set(p.cooking_history_id, [...(map.get(p.cooking_history_id) ?? []), p]);
    }
    return map;
  }, [photosQuery.data]);

  function invalidateRecipeEverywhere() {
    qc.invalidateQueries({ queryKey: ["recipe", recipeId] });
    qc.invalidateQueries({ queryKey: ["recipes-list"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  }

  const deleteEntryMut = useMutation({
    mutationFn: async (entry: CookingHistory) => {
      const photos = photosByEntry.get(entry.id) ?? [];
      const cover = coverStateOf(recipe);
      const coverPhoto = photos.find((p) => p.id === cover.cookingPhotoId);

      // 1-3. determine + clear the recipe cover first when necessary.
      if (coverPhoto) {
        await clearRecipeCoverIfMatchesCookingPhoto(coverPhoto.id);
        invalidateRecipeEverywhere();
      }

      // 4. best-effort delete every attached Storage object.
      let anyStorageFailed = false;
      const byBucket = new Map<string, string[]>();
      for (const p of photos) {
        byBucket.set(p.storage_bucket, [...(byBucket.get(p.storage_bucket) ?? []), p.storage_path]);
      }
      for (const [bucket, paths] of byBucket) {
        await removeRecipeMedia(bucket, paths).catch(() => {
          anyStorageFailed = true;
        });
      }

      // 5. delete the history row — cooking_photos metadata cascades at the
      // DB level.
      await deleteCookingHistoryEntry(entry.id);

      return { anyStorageFailed };
    },
    onSuccess: ({ anyStorageFailed }) => {
      toast.success("Cooking history entry deleted");
      if (anyStorageFailed) {
        toast.warning("Some photos couldn't be fully cleaned up from storage.");
      }
      setConfirmDeleteEntry(null);
      qc.invalidateQueries({ queryKey: ["cooking-history", recipeId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deletePhotoMut = useMutation({
    mutationFn: async (photo: CookingPhoto) => {
      const decision = decideCookingPhotoDeletion(coverStateOf(recipe), photo.id);

      // 1-2. clear the recipe cover first if this photo is the active cover.
      if (decision.shouldClearRecipeCover) {
        await clearRecipeCoverIfMatchesCookingPhoto(photo.id);
        invalidateRecipeEverywhere();
      }

      // 3. delete the Storage object (best-effort).
      let storageFailed = false;
      await removeRecipeMedia(photo.storage_bucket, [photo.storage_path]).catch(() => {
        storageFailed = true;
      });

      // 4. delete the metadata row.
      await deleteCookingPhotoMetadata(photo.id);

      return { storageFailed };
    },
    onSuccess: ({ storageFailed }) => {
      toast.success("Photo removed");
      if (storageFailed) {
        toast.warning("Removed, but the file couldn't be fully cleaned up from storage.");
      }
      qc.invalidateQueries({ queryKey: ["cooking-photos", recipeId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const useAsCoverMut = useMutation({
    mutationFn: async (photo: CookingPhoto) => {
      const decision = decidePromoteToCoverCleanup(coverStateOf(recipe), {
        id: photo.id,
        bucket: photo.storage_bucket,
        path: photo.storage_path,
      });

      // Switch metadata to the cooking photo first — never copies the file.
      await setCookingPhotoAsCover(recipeId, photo);
      invalidateRecipeEverywhere();

      // Only a previous direct-upload cover is ever cleanup-eligible; two
      // cooking photos never delete each other's object.
      if (decision.cleanupEligible) {
        removeRecipeMedia(decision.cleanupEligible.bucket, [decision.cleanupEligible.path]).catch(
          () => {
            toast.warning("Cover updated, but the previous photo couldn't be fully cleaned up.");
          },
        );
      }
    },
    onSuccess: () => toast.success("Cover photo updated"),
    onError: (error: Error) => toast.error(error.message),
  });

  const history = historyQuery.data ?? [];

  if (historyQuery.isLoading) {
    return <p className="text-sm text-cocoa/70">Loading cooking history…</p>;
  }

  if (historyQuery.error) {
    return (
      <div className="rounded-xl border border-terracotta/40 bg-terracotta/5 p-4 text-terracotta">
        Failed to load cooking history.
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-cream/40 p-6 text-center">
        <p className="text-sm text-cocoa/70">You haven't marked this recipe as cooked yet.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {history.map((entry) => {
        const photos = photosByEntry.get(entry.id) ?? [];
        const cover = coverStateOf(recipe);
        return (
          <div key={entry.id} className="rounded-2xl border border-border/70 bg-background p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-cocoa">
                  {new Date(entry.cooked_at).toLocaleString(undefined, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </p>
                {entry.servings_made != null && (
                  <p className="text-xs text-cocoa/60">Servings made: {entry.servings_made}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditingEntry(entry)}
                  className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs text-cocoa hover:bg-cream-deep/40"
                >
                  <Pencil className="h-3 w-3" /> Edit
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDeleteEntry(entry)}
                  className="inline-flex items-center gap-1 rounded-full border border-terracotta/40 px-2.5 py-1 text-xs text-terracotta hover:bg-terracotta/10"
                >
                  <Trash2 className="h-3 w-3" /> Delete
                </button>
              </div>
            </div>

            {entry.notes && <p className="mt-2 whitespace-pre-wrap text-sm text-cocoa/80">{entry.notes}</p>}

            {photosQuery.isLoading && photos.length === 0 && (
              <p className="mt-2 text-xs text-cocoa/60">Loading photos…</p>
            )}

            {photos.length > 0 && (
              <ul className="mt-3 flex flex-wrap gap-2">
                {photos.map((photo) => {
                  const isCover = cover.cookingPhotoId === photo.id;
                  return (
                    <li key={photo.id} className="flex flex-col items-center gap-1">
                      <div className="relative h-20 w-20 overflow-hidden rounded-xl border border-border/70">
                        <RecipeCoverImage
                          bucket={photo.storage_bucket}
                          path={photo.storage_path}
                          alt="Cooking photo"
                          className="h-20 w-20"
                        />
                        {isCover && (
                          <span className="absolute right-1 top-1 rounded-full bg-olive-deep/90 p-0.5 text-primary-foreground">
                            <Star className="h-3 w-3" aria-label="Current cover" />
                          </span>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          disabled={useAsCoverMut.isPending || isCover}
                          onClick={() => useAsCoverMut.mutate(photo)}
                          className="rounded-full border border-border p-1 text-cocoa hover:bg-cream-deep/40 disabled:opacity-40"
                          aria-label="Use as recipe cover"
                          title="Use as cover"
                        >
                          <ImageIcon className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          disabled={deletePhotoMut.isPending}
                          onClick={() => deletePhotoMut.mutate(photo)}
                          className="rounded-full border border-terracotta/40 p-1 text-terracotta hover:bg-terracotta/10 disabled:opacity-40"
                          aria-label="Delete photo"
                          title="Delete photo"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}

      {editingEntry && (
        <CookingHistoryForm
          mode="edit"
          recipeId={recipeId}
          entry={editingEntry}
          onDone={() => {
            setEditingEntry(null);
            qc.invalidateQueries({ queryKey: ["cooking-history", recipeId] });
          }}
          onClose={() => setEditingEntry(null)}
        />
      )}

      {confirmDeleteEntry && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        >
          <div className="w-full max-w-sm rounded-3xl bg-background p-6 shadow-[var(--shadow-paper)]">
            <h3 className="font-display text-lg font-semibold text-cocoa">Delete this entry?</h3>
            <p className="mt-1 text-sm text-cocoa/70">
              This removes the cooking entry and any attached photos.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteEntry(null)}
                className="rounded-full border border-border px-4 py-2 text-sm text-cocoa"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteEntryMut.isPending}
                onClick={() => deleteEntryMut.mutate(confirmDeleteEntry)}
                className="rounded-full bg-terracotta px-4 py-2 text-sm font-medium text-white hover:bg-terracotta/90 disabled:opacity-60"
              >
                {deleteEntryMut.isPending ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
