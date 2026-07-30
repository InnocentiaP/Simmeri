import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import { useAuth } from "@/lib/auth";
import {
  listShoppingLists,
  listShoppingListItems,
  listShoppingItemSourcesForItems,
  createShoppingList,
  generateShoppingListItems,
} from "@/lib/api";
import {
  isIncludedByDefault,
  detectAlreadyGenerated,
  buildGenerationPayload,
  type GeneratedCandidateItem,
  type SourceIdentity,
} from "@/lib/shopping-generate";

interface ShoppingGenerationReviewProps {
  candidates: GeneratedCandidateItem[];
  onClose: () => void;
}

const PRESENCE_LABEL: Record<GeneratedCandidateItem["presence"], string> = {
  missing: "Missing",
  needs_check: "Check first",
  running_low: "Running low",
};

const PRESENCE_TONE: Record<GeneratedCandidateItem["presence"], string> = {
  missing: "bg-terracotta/10 text-terracotta border-terracotta/30",
  needs_check: "bg-caramel/10 text-cocoa border-caramel/30",
  running_low: "bg-caramel/15 text-cocoa border-caramel/40",
};

function sourceLabel(source: GeneratedCandidateItem["sources"][number]): string {
  const { recipeTitle, plannedDate, mealType } = source.source;
  if (plannedDate && mealType) {
    const date = new Date(plannedDate + "T00:00:00").toLocaleDateString(undefined, {
      weekday: "long",
    });
    return `${recipeTitle} · ${date} ${mealType}`;
  }
  return recipeTitle;
}

function neededForLine(candidate: GeneratedCandidateItem): string {
  const labels = Array.from(new Set(candidate.sources.map((s) => s.source.recipeTitle)));
  if (labels.length === 1) return `Needed for ${sourceLabel(candidate.sources[0])}`;
  if (labels.length === 2) return `Needed for ${labels[0]} and ${labels[1]}`;
  return `Needed for ${labels.slice(0, -1).join(", ")}, and ${labels[labels.length - 1]}`;
}

// Shared review-before-write UI for every generation entry point (Recipe
// Detail, My Recipes multi-select, Planner day/week). Nothing is written to
// Shopping until the user explicitly confirms — this component only ever
// calls generateShoppingListItems() from its own confirm handler.
export function ShoppingGenerationReview({ candidates, onClose }: ShoppingGenerationReviewProps) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const [includeRunningLow, setIncludeRunningLow] = useState(false);
  const [includeNeedsCheck, setIncludeNeedsCheck] = useState(false);
  const [overrides, setOverrides] = useState<Map<string, boolean>>(new Map());
  const [targetListId, setTargetListId] = useState<string>("new");
  const [newListName, setNewListName] = useState("Shopping List");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<
    { kind: "success"; listId: string; count: number } | { kind: "error"; message: string } | null
  >(null);

  const listsQuery = useQuery({
    queryKey: ["shopping-lists", false],
    queryFn: () => listShoppingLists(false),
  });

  const existingSourcesQuery = useQuery({
    queryKey: ["shopping-item-sources-for-list", targetListId],
    queryFn: async (): Promise<SourceIdentity[]> => {
      if (targetListId === "new") return [];
      const items = await listShoppingListItems(targetListId);
      const sources = await listShoppingItemSourcesForItems(items.map((i) => i.id));
      return sources.map((s) => ({ recipeId: s.recipe_id, mealPlanEntryId: s.meal_plan_entry_id }));
    },
  });

  const alreadyGeneratedFlags = useMemo(
    () => detectAlreadyGenerated(candidates, existingSourcesQuery.data ?? []),
    [candidates, existingSourcesQuery.data],
  );

  function isIncluded(candidate: GeneratedCandidateItem, index: number): boolean {
    const override = overrides.get(candidate.mergeKey);
    if (override !== undefined) return override;
    if (alreadyGeneratedFlags[index]) return false;
    return isIncludedByDefault(candidate.presence, { includeRunningLow, includeNeedsCheck });
  }

  function toggleCandidate(mergeKey: string, checked: boolean) {
    setOverrides((prev) => {
      const next = new Map(prev);
      next.set(mergeKey, checked);
      return next;
    });
  }

  function toggleGlobalOption(kind: "running_low" | "needs_check", checked: boolean) {
    if (kind === "running_low") setIncludeRunningLow(checked);
    else setIncludeNeedsCheck(checked);
    // Resetting only the affected presence class's per-item overrides lets
    // the newly-changed global default take effect for items the user
    // hasn't manually touched a second time, without discarding overrides
    // on unrelated items.
    setOverrides((prev) => {
      const next = new Map(prev);
      for (const candidate of candidates) {
        if (candidate.presence === kind) next.delete(candidate.mergeKey);
      }
      return next;
    });
  }

  const approvedCandidates = candidates.filter((c, idx) => isIncluded(c, idx));

  async function handleConfirm() {
    if (!user || submitting || approvedCandidates.length === 0) return;
    setSubmitting(true);
    setResult(null);
    try {
      let listId = targetListId;
      if (listId === "new") {
        const trimmedName = newListName.trim() || "Shopping List";
        listId = await createShoppingList(user.id, trimmedName);
      }

      const payload = buildGenerationPayload(approvedCandidates);
      const insertedIds = await generateShoppingListItems(listId, payload);

      qc.invalidateQueries({ queryKey: ["shopping-lists"] });
      qc.invalidateQueries({ queryKey: ["shopping-list-items", listId] });
      qc.invalidateQueries({ queryKey: ["shopping-list-item-states"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });

      setResult({ kind: "success", listId, count: insertedIds.length });
      toast.success(`Added ${insertedIds.length} item${insertedIds.length === 1 ? "" : "s"} to Shopping.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Couldn't generate shopping items.";
      setResult({ kind: "error", message });
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Review generated shopping items"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-3xl bg-background p-6 shadow-[var(--shadow-paper)]">
        <h3 className="mb-1 font-display text-lg font-semibold text-cocoa">Review shopping needs</h3>
        <p className="mb-4 text-sm text-cocoa/70">
          Nothing is added to Shopping until you confirm below.
        </p>

        {result?.kind === "success" ? (
          <div className="flex flex-col gap-4">
            <div className="rounded-xl border border-olive-deep/30 bg-olive-deep/10 p-4 text-sm text-cocoa">
              Added {result.count} item{result.count === 1 ? "" : "s"} to Shopping.
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border border-border px-4 py-2 text-sm text-cocoa"
              >
                Close
              </button>
              <Link
                to="/app/shopping/$shoppingListId"
                params={{ shoppingListId: result.listId }}
                onClick={onClose}
                className="rounded-full bg-olive-deep px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-olive"
              >
                View list
              </Link>
            </div>
          </div>
        ) : candidates.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-cream/40 p-6 text-center text-sm text-cocoa/70">
            Nothing to add — everything is already available in Kitchen.
          </div>
        ) : (
          <>
            <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
              <label className="flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 text-cocoa">
                <input
                  type="checkbox"
                  checked={includeRunningLow}
                  onChange={(e) => toggleGlobalOption("running_low", e.target.checked)}
                />
                Include running-low items
              </label>
              <label className="flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 text-cocoa">
                <input
                  type="checkbox"
                  checked={includeNeedsCheck}
                  onChange={(e) => toggleGlobalOption("needs_check", e.target.checked)}
                />
                Include needs-checking items
              </label>
            </div>

            <ul className="flex flex-col gap-2 overflow-y-auto pr-1">
              {candidates.map((candidate, idx) => {
                const included = isIncluded(candidate, idx);
                const alreadyGenerated = alreadyGeneratedFlags[idx];
                const scalingWarning = candidate.sources.find((s) => s.scalingWarning)?.scalingWarning;
                return (
                  <li key={candidate.mergeKey} className="rounded-xl border border-border/60 p-3">
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={included}
                        onChange={(e) => toggleCandidate(candidate.mergeKey, e.target.checked)}
                        className="mt-1 h-4 w-4"
                        aria-label={`Include ${candidate.displayName}`}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-medium text-cocoa">
                            {candidate.displayName}
                            {candidate.quantityText && (
                              <span className="font-normal text-cocoa/60">
                                {" — "}
                                {candidate.quantityText}
                              </span>
                            )}
                          </p>
                          <span
                            className={`rounded-full border px-2 py-0.5 text-xs ${PRESENCE_TONE[candidate.presence]}`}
                          >
                            {PRESENCE_LABEL[candidate.presence]}
                          </span>
                          {!candidate.combinable && candidate.sources.length > 1 && (
                            <span className="rounded-full border border-border px-2 py-0.5 text-xs text-cocoa/60">
                              Kept separate
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-cocoa/60">{neededForLine(candidate)}</p>
                        {scalingWarning && (
                          <p className="mt-1 flex items-center gap-1 text-xs text-caramel">
                            <AlertTriangle className="h-3 w-3" /> {scalingWarning}
                          </p>
                        )}
                        {alreadyGenerated && (
                          <p className="mt-1 text-xs text-terracotta">
                            Already added to this list — check the box above to include it again.
                          </p>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>

            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border/50 pt-4">
              <label className="text-sm font-medium text-cocoa" htmlFor="target-list-select">
                Add to
              </label>
              <select
                id="target-list-select"
                value={targetListId}
                onChange={(e) => setTargetListId(e.target.value)}
                className="rounded-full border border-border bg-background px-3 py-1.5 text-sm"
              >
                <option value="new">Create a new list</option>
                {(listsQuery.data ?? []).map((list) => (
                  <option key={list.id} value={list.id}>
                    {list.name}
                  </option>
                ))}
              </select>
              {targetListId === "new" && (
                <input
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                  placeholder="List name"
                  className="rounded-full border border-border bg-background px-3 py-1.5 text-sm"
                />
              )}
            </div>

            {result?.kind === "error" && (
              <div className="mt-3 rounded-xl border border-terracotta/40 bg-terracotta/5 p-3 text-sm text-terracotta">
                {result.message}
              </div>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border border-border px-4 py-2 text-sm text-cocoa"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submitting || approvedCandidates.length === 0}
                onClick={handleConfirm}
                className="rounded-full bg-olive-deep px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-olive disabled:opacity-60"
              >
                {submitting ? "Adding…" : `Add ${approvedCandidates.length} item${approvedCandidates.length === 1 ? "" : "s"}`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
