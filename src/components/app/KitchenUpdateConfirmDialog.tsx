import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { listKitchenItems, createKitchenItem, updateKitchenItem, type ShoppingListItem } from "@/lib/api";
import { decideKitchenUpdateTargets, type KitchenUpdateDecision } from "@/lib/kitchen-update-plan";

const STATUSES = [
  { value: "available", label: "Available" },
  { value: "running_low", label: "Running low" },
  { value: "out_of_stock", label: "Out of stock" },
  { value: "unknown", label: "Unknown" },
] as const;

const LOCATIONS = [
  { value: "pantry", label: "Pantry" },
  { value: "refrigerator", label: "Refrigerator" },
  { value: "freezer", label: "Freezer" },
  { value: "spice_rack", label: "Spice rack" },
  { value: "other", label: "Other" },
] as const;

interface KitchenUpdateConfirmDialogProps {
  purchasedItems: ShoppingListItem[];
  onClose: () => void;
}

interface RowUIState {
  // "skip" | "create" | `update:${kitchenItemId}`
  selection: string;
  status: string;
  location: string;
}

type RowResult = { kind: "success" } | { kind: "error"; message: string } | { kind: "skipped" };

function locationForSelection(decision: KitchenUpdateDecision, selection: string): string {
  if (selection.startsWith("update:")) {
    const id = selection.slice("update:".length);
    const candidates =
      decision.action.kind === "update"
        ? [decision.action.target]
        : decision.action.kind === "ambiguous"
          ? decision.action.candidates
          : [];
    return candidates.find((c) => c.id === id)?.storageLocation ?? "pantry";
  }
  return "pantry";
}

function initialSelection(decision: KitchenUpdateDecision): string {
  if (decision.action.kind === "create") return "create";
  if (decision.action.kind === "update") return `update:${decision.action.target.id}`;
  // Ambiguous: never guess which existing row to update — default to Skip
  // until the user explicitly picks a target or chooses "Create new".
  return "skip";
}

// Reviewable, explicit confirmation dialog for turning purchased shopping
// items into Kitchen Inventory changes. Nothing here runs until the user
// presses Submit — checking an item as purchased (elsewhere) never reaches
// Kitchen on its own.
export function KitchenUpdateConfirmDialog({ purchasedItems, onClose }: KitchenUpdateConfirmDialogProps) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState<Map<string, RowResult> | null>(null);

  const kitchenQuery = useQuery({
    queryKey: ["kitchen-items-active"],
    queryFn: () => listKitchenItems(false),
  });

  const decisions = useMemo(() => {
    if (!kitchenQuery.data) return [];
    return decideKitchenUpdateTargets(
      purchasedItems.map((item) => ({ id: item.id, displayName: item.display_name })),
      kitchenQuery.data.map((k) => ({
        id: k.id,
        name: k.ingredient_name,
        status: k.status,
        storageLocation: k.storage_location,
        archivedAt: k.archived_at,
      })),
    );
  }, [purchasedItems, kitchenQuery.data]);

  const [rowState, setRowState] = useState<Map<string, RowUIState>>(new Map());

  // Lazily initialize each row's editable state the first time its decision
  // becomes available (kitchenQuery resolves after the dialog first mounts).
  const rows = decisions.map((decision) => {
    let state = rowState.get(decision.purchasedItemId);
    if (!state) {
      const selection = initialSelection(decision);
      state = {
        selection,
        status: "available",
        location: locationForSelection(decision, selection),
      };
    }
    return { decision, state };
  });

  function updateRow(purchasedItemId: string, patch: Partial<RowUIState>) {
    setRowState((prev) => {
      const next = new Map(prev);
      const existing =
        next.get(purchasedItemId) ??
        rows.find((r) => r.decision.purchasedItemId === purchasedItemId)?.state;
      if (!existing) return prev;
      next.set(purchasedItemId, { ...existing, ...patch });
      return next;
    });
  }

  function handleSelectionChange(decision: KitchenUpdateDecision, selection: string) {
    updateRow(decision.purchasedItemId, {
      selection,
      status: "available",
      location: locationForSelection(decision, selection),
    });
  }

  const submittableCount = rows.filter((r) => r.state.selection !== "skip").length;

  async function handleSubmit() {
    if (!user || submitting) return;
    setSubmitting(true);

    const outcomes = await Promise.allSettled(
      rows.map(async ({ decision, state }) => {
        if (state.selection === "skip") {
          return { purchasedItemId: decision.purchasedItemId, kind: "skipped" as const };
        }
        if (state.selection === "create") {
          await createKitchenItem({
            userId: user.id,
            ingredientName: decision.displayName,
            status: state.status,
            storageLocation: state.location,
          });
        } else {
          const targetId = state.selection.slice("update:".length);
          await updateKitchenItem(targetId, { status: state.status, storageLocation: state.location });
        }
        return { purchasedItemId: decision.purchasedItemId, kind: "success" as const };
      }),
    );

    const nextResults = new Map<string, RowResult>();
    let successCount = 0;
    let failureCount = 0;
    outcomes.forEach((outcome, idx) => {
      const purchasedItemId = rows[idx].decision.purchasedItemId;
      if (outcome.status === "fulfilled") {
        nextResults.set(purchasedItemId, outcome.value.kind === "skipped" ? { kind: "skipped" } : { kind: "success" });
        if (outcome.value.kind === "success") successCount += 1;
      } else {
        const message = outcome.reason instanceof Error ? outcome.reason.message : "Failed to update Kitchen.";
        nextResults.set(purchasedItemId, { kind: "error", message });
        failureCount += 1;
      }
    });

    setResults(nextResults);
    setSubmitting(false);
    qc.invalidateQueries({ queryKey: ["kitchen"] });
    qc.invalidateQueries({ queryKey: ["kitchen-items-active"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });

    if (failureCount === 0 && successCount > 0) {
      toast.success(`Kitchen updated (${successCount} item${successCount === 1 ? "" : "s"}).`);
    } else if (failureCount > 0 && successCount > 0) {
      toast.warning(`Updated ${successCount} item${successCount === 1 ? "" : "s"}, ${failureCount} failed.`);
    } else if (failureCount > 0) {
      toast.error(`${failureCount} Kitchen update${failureCount === 1 ? "" : "s"} failed.`);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Update Kitchen from purchased items"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-3xl bg-background p-6 shadow-[var(--shadow-paper)]">
        <h3 className="mb-1 font-display text-lg font-semibold text-cocoa">Update Kitchen from purchased items</h3>
        <p className="mb-4 text-sm text-cocoa/70">
          Review each item below, then confirm. Nothing changes in Kitchen until you submit.
        </p>

        {kitchenQuery.isLoading && <p className="text-sm text-cocoa/70">Loading Kitchen…</p>}
        {kitchenQuery.error && (
          <p className="text-sm text-terracotta">Couldn't load Kitchen items for matching.</p>
        )}

        {!kitchenQuery.isLoading && !kitchenQuery.error && (
          <ul className="flex flex-col gap-3 overflow-y-auto pr-1">
            {rows.map(({ decision, state }) => {
              const result = results?.get(decision.purchasedItemId);
              const candidates =
                decision.action.kind === "update"
                  ? [decision.action.target]
                  : decision.action.kind === "ambiguous"
                    ? decision.action.candidates
                    : [];
              return (
                <li key={decision.purchasedItemId} className="rounded-xl border border-border/60 p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-cocoa">{decision.displayName}</p>
                    {decision.action.kind === "ambiguous" && !result && (
                      <span className="rounded-full border border-caramel/40 bg-caramel/10 px-2 py-0.5 text-xs text-cocoa">
                        Multiple matches — choose one
                      </span>
                    )}
                    {result?.kind === "success" && (
                      <span className="rounded-full border border-olive-deep/30 bg-olive-deep/10 px-2 py-0.5 text-xs text-olive-deep">
                        Done
                      </span>
                    )}
                    {result?.kind === "skipped" && (
                      <span className="rounded-full border border-border px-2 py-0.5 text-xs text-cocoa/60">
                        Skipped
                      </span>
                    )}
                    {result?.kind === "error" && (
                      <span className="rounded-full border border-terracotta/40 bg-terracotta/10 px-2 py-0.5 text-xs text-terracotta">
                        Failed
                      </span>
                    )}
                  </div>

                  {result?.kind === "error" && (
                    <p className="mb-2 text-xs text-terracotta">{result.message}</p>
                  )}

                  {!results && (
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={state.selection}
                        onChange={(e) => handleSelectionChange(decision, e.target.value)}
                        className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
                      >
                        <option value="skip">Skip</option>
                        <option value="create">Create new Kitchen item</option>
                        {candidates.map((c) => (
                          <option key={c.id} value={`update:${c.id}`}>
                            Update "{c.name}"
                          </option>
                        ))}
                      </select>

                      {state.selection !== "skip" && (
                        <>
                          <select
                            value={state.status}
                            onChange={(e) => updateRow(decision.purchasedItemId, { status: e.target.value })}
                            className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
                          >
                            {STATUSES.map((s) => (
                              <option key={s.value} value={s.value}>
                                {s.label}
                              </option>
                            ))}
                          </select>
                          <select
                            value={state.location}
                            onChange={(e) => updateRow(decision.purchasedItemId, { location: e.target.value })}
                            className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
                          >
                            {LOCATIONS.map((l) => (
                              <option key={l.value} value={l.value}>
                                {l.label}
                              </option>
                            ))}
                          </select>
                        </>
                      )}
                    </div>
                  )}
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
            {results ? "Close" : "Cancel"}
          </button>
          {!results && (
            <button
              type="button"
              disabled={submitting || kitchenQuery.isLoading || submittableCount === 0}
              onClick={handleSubmit}
              className="rounded-full bg-olive-deep px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-olive disabled:opacity-60"
            >
              {submitting ? "Updating…" : `Submit (${submittableCount})`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
