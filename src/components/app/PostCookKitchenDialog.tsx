import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { listKitchenItems, listRecipeIngredientsForRecipeIds, updateKitchenItem } from "@/lib/api";
import { getIngredientMatcher } from "@/lib/ingredients/use-ingredient-matcher";
import {
  buildPostCookRows,
  planPostCookUpdates,
  type PostCookChoice,
  type PostCookImportance,
  type PostCookSelection,
} from "@/lib/post-cook-kitchen";

const CHOICES: { value: PostCookChoice; label: string }[] = [
  { value: "keep", label: "Still have it" },
  { value: "running_low", label: "Running low" },
  { value: "out_of_stock", label: "Used up" },
];

const STATUS_LABEL: Record<string, string> = {
  available: "Available",
  running_low: "Running low",
  out_of_stock: "Out of stock",
  unknown: "Unknown",
};

interface PostCookKitchenDialogProps {
  recipeId: string;
  onClose: () => void;
}

// Optional follow-up after "Mark as cooked": lets the user record what they
// used up. Every row defaults to "Still have it", and nothing is written to
// Kitchen until the user presses Update — cooking never silently deducts
// inventory. Closes itself when none of the recipe's ingredients are in
// Kitchen, since there is nothing to ask.
export function PostCookKitchenDialog({ recipeId, onClose }: PostCookKitchenDialogProps) {
  const qc = useQueryClient();
  const [selections, setSelections] = useState<Map<string, PostCookSelection>>(new Map());
  const [submitting, setSubmitting] = useState(false);

  const dataQuery = useQuery({
    queryKey: ["post-cook-kitchen", recipeId],
    queryFn: async () => {
      const [ingredients, kitchen, keyOf] = await Promise.all([
        listRecipeIngredientsForRecipeIds([recipeId]),
        listKitchenItems(false),
        getIngredientMatcher(qc),
      ]);
      return buildPostCookRows(
        ingredients.map((i) => ({
          id: i.id,
          displayName: i.display_name,
          importance: i.importance as PostCookImportance,
        })),
        kitchen.map((k) => ({
          id: k.id,
          name: k.ingredient_name,
          status: k.status,
          storageLocation: k.storage_location,
          archivedAt: k.archived_at,
        })),
        keyOf,
      );
    },
    staleTime: 0,
  });

  const rows = useMemo(() => dataQuery.data ?? [], [dataQuery.data]);

  useEffect(() => {
    if (dataQuery.isSuccess && rows.length === 0) onClose();
  }, [dataQuery.isSuccess, rows.length, onClose]);

  const updates = useMemo(() => planPostCookUpdates(rows, selections), [rows, selections]);

  function select(key: string, patch: Partial<PostCookSelection>) {
    setSelections((prev) => {
      const next = new Map(prev);
      next.set(key, { choice: "keep", ...prev.get(key), ...patch });
      return next;
    });
  }

  async function handleSubmit() {
    if (submitting || updates.length === 0) return;
    setSubmitting(true);
    const outcomes = await Promise.allSettled(
      updates.map((u) => updateKitchenItem(u.kitchenItemId, { status: u.status })),
    );
    setSubmitting(false);

    const failed = outcomes.filter((o) => o.status === "rejected").length;
    const succeeded = outcomes.length - failed;
    qc.invalidateQueries({ queryKey: ["kitchen"] });
    qc.invalidateQueries({ queryKey: ["kitchen-items-active"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
    qc.invalidateQueries({ queryKey: ["recipe"] });
    qc.invalidateQueries({ queryKey: ["recipes-list"] });

    if (failed === 0) {
      toast.success(`Kitchen updated (${succeeded} item${succeeded === 1 ? "" : "s"}).`);
      onClose();
    } else if (succeeded > 0) {
      toast.warning(`Updated ${succeeded} item${succeeded === 1 ? "" : "s"}, ${failed} failed.`);
      onClose();
    } else {
      toast.error("Couldn't update Kitchen. Please try again.");
    }
  }

  // Nothing to show while loading or when the dialog is about to auto-close.
  if (dataQuery.isLoading || (dataQuery.isSuccess && rows.length === 0)) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="post-cook-kitchen-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-3xl bg-background p-6 shadow-[var(--shadow-paper)]">
        <h3
          id="post-cook-kitchen-title"
          className="mb-1 font-display text-lg font-semibold text-cocoa"
        >
          Update your Kitchen?
        </h3>
        <p className="mb-4 text-sm text-cocoa/70">
          Did you use anything up? Only what you change here is updated — everything else stays as
          it is.
        </p>

        {dataQuery.error && (
          <p className="text-sm text-terracotta">
            Couldn't load your Kitchen. You can update it later from the Kitchen page.
          </p>
        )}

        {dataQuery.isSuccess && (
          <ul className="flex flex-col gap-3 overflow-y-auto pr-1">
            {rows.map((row) => {
              const selection = selections.get(row.key) ?? { choice: "keep" as const };
              const ambiguous = row.candidates.length > 1;
              const single = row.candidates[0];
              return (
                <li key={row.key} className="rounded-xl border border-border/60 p-3">
                  <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-sm font-medium text-cocoa">{row.displayName}</p>
                    {!ambiguous && (
                      <span className="text-xs text-cocoa/60">
                        Now: {STATUS_LABEL[single.status] ?? single.status}
                      </span>
                    )}
                  </div>

                  {ambiguous && (
                    <select
                      value={selection.targetId ?? ""}
                      onChange={(e) => select(row.key, { targetId: e.target.value || null })}
                      aria-label={`Which Kitchen item is ${row.displayName}?`}
                      className="mb-2 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
                    >
                      <option value="">Several Kitchen items match — choose one</option>
                      {row.candidates.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({STATUS_LABEL[c.status] ?? c.status})
                        </option>
                      ))}
                    </select>
                  )}

                  <div
                    role="radiogroup"
                    aria-label={`${row.displayName} after cooking`}
                    className="flex flex-wrap gap-1.5"
                  >
                    {CHOICES.map((c) => {
                      const active = selection.choice === c.value;
                      return (
                        <button
                          key={c.value}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          onClick={() => select(row.key, { choice: c.value })}
                          className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                            active
                              ? "border-olive-deep bg-olive-deep text-primary-foreground"
                              : "border-border bg-background text-cocoa hover:bg-cream-deep/40"
                          }`}
                        >
                          {c.label}
                        </button>
                      );
                    })}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-border px-4 py-2 text-sm text-cocoa"
          >
            Skip
          </button>
          <button
            type="button"
            disabled={submitting || updates.length === 0}
            onClick={handleSubmit}
            className="rounded-full bg-olive-deep px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-olive disabled:opacity-60"
          >
            {submitting ? "Updating…" : updates.length > 0 ? `Update ${updates.length}` : "Update"}
          </button>
        </div>
      </div>
    </div>
  );
}
