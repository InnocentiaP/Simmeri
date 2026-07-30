import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Upload, RefreshCw, Trash2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { setRecipeCover, removeRecipeCover, type Recipe } from "@/lib/api";
import { prepareImageForUpload, ImagePrepError } from "@/lib/media/image-compress";
import {
  RECIPE_MEDIA_BUCKET,
  buildRecipeCoverPath,
  uploadRecipeMedia,
  removeRecipeMedia,
} from "@/lib/media/storage";

interface CoverPhotoUploaderProps {
  recipe: Pick<Recipe, "id" | "cover_storage_bucket" | "cover_storage_path">;
}

// Lives on Recipe Detail only. Upload/replace order: upload the new object
// first, then point the recipe at it, then (only after that succeeds)
// clean up the old object last — so a failure at any step never leaves the
// recipe pointing at a missing file, and a failed replacement never touches
// the still-good existing cover. Remove order: clear the recipe's cover
// metadata first, then best-effort delete the Storage object — Postgres and
// Storage are two separate systems with no shared transaction, so this
// ordering is chosen deliberately rather than attempting fake atomicity.
export function CoverPhotoUploader({ recipe }: CoverPhotoUploaderProps) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const hasCover = Boolean(recipe.cover_storage_bucket && recipe.cover_storage_path);

  function invalidateEverywhereRecipeCoversAppear() {
    qc.invalidateQueries({ queryKey: ["recipe", recipe.id] });
    qc.invalidateQueries({ queryKey: ["recipes-list"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  }

  async function handleFileSelected(file: File) {
    if (busy || !user) return;
    setBusy(true);
    const previousBucket = recipe.cover_storage_bucket;
    const previousPath = recipe.cover_storage_path;

    try {
      let prepared;
      try {
        prepared = await prepareImageForUpload(file);
      } catch (error) {
        if (error instanceof ImagePrepError) {
          toast.error(error.message);
          return;
        }
        throw error;
      }

      const uuid = crypto.randomUUID();
      const path = buildRecipeCoverPath(user.id, recipe.id, uuid, prepared.mimeType);

      // 1. upload the new object
      await uploadRecipeMedia(path, prepared.blob, prepared.mimeType);

      // 2. point the recipe at it
      try {
        await setRecipeCover(recipe.id, {
          bucket: RECIPE_MEDIA_BUCKET,
          path,
          source: "direct_upload",
        });
      } catch (metadataError) {
        // Metadata update failed: the recipe's existing cover reference (if
        // any) was never touched. Best-effort clean up the now-orphaned
        // upload, but never let that cleanup attempt mask the real error.
        removeRecipeMedia(RECIPE_MEDIA_BUCKET, [path]).catch(() => {});
        throw metadataError;
      }

      toast.success(hasCover ? "Cover photo replaced" : "Cover photo added");
      invalidateEverywhereRecipeCoversAppear();

      // 3. only now delete the old object — nothing references it any more
      if (previousBucket && previousPath) {
        removeRecipeMedia(previousBucket, [previousPath]).catch(() => {
          toast.warning("Saved, but the previous photo couldn't be fully removed.");
        });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't save that photo. Please try again.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleRemove() {
    if (busy || !hasCover) return;
    setBusy(true);
    const bucket = recipe.cover_storage_bucket as string;
    const path = recipe.cover_storage_path as string;

    try {
      // 1. clear the recipe's cover metadata first
      await removeRecipeCover(recipe.id);
      toast.success("Cover photo removed");
      invalidateEverywhereRecipeCoversAppear();

      // 2. best-effort delete the now-unreferenced Storage object
      removeRecipeMedia(bucket, [path]).catch(() => {
        toast.warning("Removed, but the photo couldn't be fully cleaned up.");
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't remove the cover photo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        aria-label="Choose a cover photo"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFileSelected(file);
        }}
      />
      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-sm text-cocoa hover:bg-cream-deep/40 disabled:opacity-60"
      >
        {hasCover ? <RefreshCw className="h-3.5 w-3.5" /> : <Upload className="h-3.5 w-3.5" />}
        {busy ? "Saving…" : hasCover ? "Replace cover" : "Add cover photo"}
      </button>
      {hasCover && (
        <button
          type="button"
          disabled={busy}
          onClick={handleRemove}
          className="inline-flex items-center gap-1.5 rounded-full border border-terracotta/40 bg-background px-3 py-1.5 text-sm text-terracotta hover:bg-terracotta/10 disabled:opacity-60"
        >
          <Trash2 className="h-3.5 w-3.5" /> Remove
        </button>
      )}
    </div>
  );
}
