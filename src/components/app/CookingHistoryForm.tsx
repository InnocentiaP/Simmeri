import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { X } from "lucide-react";
import { useAuth } from "@/lib/auth";
import {
  createCookingHistoryEntry,
  updateCookingHistoryEntry,
  addCookingPhoto,
  type CookingHistory,
} from "@/lib/api";
import { prepareImageForUpload, ImagePrepError } from "@/lib/media/image-compress";
import { buildCookingPhotoPath, uploadRecipeMedia, RECIPE_MEDIA_BUCKET } from "@/lib/media/storage";

// UI-safety cap only (no DB constraint) — prevents someone from selecting an
// unreasonable number of files and hanging the browser on compression.
const MAX_PHOTOS_PER_ENTRY = 6;

const cookingHistorySchema = z.object({
  cookedAt: z.string().min(1, "Date is required"),
  servingsMade: z.number().int().positive().nullable(),
  notes: z.string().trim().max(4000, "Keep notes under 4000 characters").nullable(),
});
type CookingHistoryFormValues = z.infer<typeof cookingHistorySchema>;

function toLocalDatetimeInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

interface CookingHistoryFormProps {
  mode: "create" | "edit";
  recipeId: string;
  entry?: CookingHistory;
  onDone: () => void;
  onClose: () => void;
}

// Handles both "Mark as cooked" (create, with optional photo attachment)
// and editing an existing entry's text fields. Photo attachment only
// appears in create mode — adding/removing photos on an existing entry is a
// separate action (CookingHistoryList's per-photo controls), not part of
// editing cooked_at/servings/notes.
export function CookingHistoryForm({
  mode,
  recipeId,
  entry,
  onDone,
  onClose,
}: CookingHistoryFormProps) {
  const { user } = useAuth();
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CookingHistoryFormValues>({
    resolver: zodResolver(cookingHistorySchema),
    defaultValues: {
      cookedAt: entry ? toLocalDatetimeInputValue(new Date(entry.cooked_at)) : toLocalDatetimeInputValue(new Date()),
      servingsMade: entry?.servings_made ?? null,
      notes: entry?.notes ?? null,
    },
  });

  function handleFilesSelected(selected: FileList | null) {
    const list = Array.from(selected ?? []);
    if (list.length > MAX_PHOTOS_PER_ENTRY) {
      toast.warning(`You can attach up to ${MAX_PHOTOS_PER_ENTRY} photos — the rest were skipped.`);
    }
    setFiles(list.slice(0, MAX_PHOTOS_PER_ENTRY));
  }

  async function onSubmit(values: CookingHistoryFormValues) {
    if (submitting || !user) return;
    setSubmitting(true);
    try {
      const cookedAtIso = new Date(values.cookedAt).toISOString();
      const notes = values.notes?.trim() || null;

      if (mode === "edit" && entry) {
        await updateCookingHistoryEntry(entry.id, {
          cookedAt: cookedAtIso,
          servingsMade: values.servingsMade,
          notes,
        });
        toast.success("Cooking entry updated");
        onDone();
        return;
      }

      // 1. create the cooking_history row first — this is the record that
      // must survive even if photo uploads below partially fail.
      const historyId = await createCookingHistoryEntry({
        recipeId,
        userId: user.id,
        cookedAt: cookedAtIso,
        servingsMade: values.servingsMade,
        notes,
      });

      let failedCount = 0;
      for (const file of files) {
        try {
          // 2. prepare/compress, 3. upload, 4. record metadata — per file.
          const prepared = await prepareImageForUpload(file);
          const uuid = crypto.randomUUID();
          const path = buildCookingPhotoPath(user.id, historyId, uuid, prepared.mimeType);
          await uploadRecipeMedia(path, prepared.blob, prepared.mimeType);
          await addCookingPhoto(user.id, historyId, RECIPE_MEDIA_BUCKET, path);
        } catch (photoError) {
          failedCount += 1;
          if (photoError instanceof ImagePrepError) {
            toast.error(`${file.name}: ${photoError.message}`);
          }
        }
      }

      // 5. report partial photo failures without touching the already-saved
      // cooking-history entry — it stays saved regardless.
      if (failedCount > 0) {
        toast.warning(
          `Marked as cooked, but ${failedCount} photo${failedCount === 1 ? "" : "s"} couldn't be uploaded.`,
        );
      } else {
        toast.success("Marked as cooked");
      }
      onDone();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't save this cooking entry.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={mode === "create" ? "Mark as cooked" : "Edit cooking entry"}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <div className="w-full max-w-md rounded-3xl bg-background p-6 shadow-[var(--shadow-paper)]">
        <h3 className="mb-4 font-display text-lg font-semibold text-cocoa">
          {mode === "create" ? "Mark as cooked" : "Edit cooking entry"}
        </h3>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-cocoa">Cooked on</span>
            <input
              type="datetime-local"
              {...register("cookedAt")}
              className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
            />
            {errors.cookedAt && (
              <span className="text-xs text-terracotta">{errors.cookedAt.message}</span>
            )}
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-cocoa">Servings made (optional)</span>
            <input
              type="number"
              min={1}
              {...register("servingsMade", {
                setValueAs: (v) => (v === "" || v == null ? null : Number(v)),
              })}
              className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
            />
            {errors.servingsMade && (
              <span className="text-xs text-terracotta">{errors.servingsMade.message}</span>
            )}
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-cocoa">Notes (optional)</span>
            <textarea
              rows={3}
              {...register("notes", { setValueAs: (v) => (v === "" ? null : v) })}
              className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
              placeholder="How did it turn out? Any changes you made…"
            />
            {errors.notes && <span className="text-xs text-terracotta">{errors.notes.message}</span>}
          </label>

          {mode === "create" && (
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-cocoa">Photos (optional)</span>
              <input
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => handleFilesSelected(e.target.files)}
                className="text-sm"
              />
              {files.length > 0 && (
                <ul className="mt-1 flex flex-wrap gap-2">
                  {files.map((f, idx) => (
                    <li
                      key={`${f.name}-${idx}`}
                      className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-1 text-xs text-cocoa"
                    >
                      {f.name}
                      <button
                        type="button"
                        aria-label={`Remove ${f.name}`}
                        onClick={() => setFiles((prev) => prev.filter((_, i) => i !== idx))}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </label>
          )}

          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-border px-4 py-2 text-sm text-cocoa"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-full bg-olive-deep px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-olive disabled:opacity-60"
            >
              {submitting ? "Saving…" : mode === "create" ? "Save" : "Save changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
