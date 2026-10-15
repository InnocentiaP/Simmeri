// Pure planning logic for the optional "Update Kitchen?" step after a recipe
// is marked as cooked. Never touches Supabase or any I/O, and never decides
// a change on its own: every row defaults to "keep", and the UI only writes
// what the user explicitly picks (product rule: cooking never silently
// deducts inventory).

import {
  decideKitchenUpdateTargets,
  normalizeKitchenCandidateName,
  type ActiveKitchenItemInput,
  type KitchenCandidate,
} from "./kitchen-update-plan.ts";

export type PostCookImportance = "core" | "supporting" | "seasoning" | "optional";

export interface PostCookIngredientInput {
  id: string;
  displayName: string;
  importance: PostCookImportance;
}

// What the user can do to a Kitchen item after cooking. Cooking only ever
// uses things up, so "available"/"unknown" are deliberately not offered.
export type PostCookChoice = "keep" | "running_low" | "out_of_stock";

export interface PostCookRow {
  // Stable key: the first contributing recipe-ingredient id.
  key: string;
  displayName: string;
  importance: PostCookImportance;
  // One candidate = a clear match; several = the user must pick (never guessed).
  candidates: KitchenCandidate[];
}

const IMPORTANCE_ORDER: Record<PostCookImportance, number> = {
  core: 0,
  supporting: 1,
  seasoning: 2,
  optional: 3,
};

// Builds one row per distinct recipe ingredient that matches at least one
// active Kitchen item by normalized name. Ingredients with no Kitchen match
// are omitted: there is nothing in Kitchen to update. Optional ingredients
// are included (they may well have been used), but sorted last. Items
// already out of stock are omitted, since cooking cannot use them up further.
export function buildPostCookRows(
  ingredients: readonly PostCookIngredientInput[],
  activeKitchenItems: readonly ActiveKitchenItemInput[],
): PostCookRow[] {
  const firstByName = new Map<string, PostCookIngredientInput>();
  for (const ing of ingredients) {
    const key = normalizeKitchenCandidateName(ing.displayName);
    if (!key) continue;
    const existing = firstByName.get(key);
    // Keep the most important classification when a name appears twice.
    if (!existing || IMPORTANCE_ORDER[ing.importance] < IMPORTANCE_ORDER[existing.importance]) {
      firstByName.set(key, existing ? { ...existing, importance: ing.importance } : ing);
    }
  }

  const unique = [...firstByName.values()];
  const decisions = decideKitchenUpdateTargets(
    unique.map((ing) => ({ id: ing.id, displayName: ing.displayName })),
    activeKitchenItems,
  );

  const rows: PostCookRow[] = [];
  decisions.forEach((decision, idx) => {
    const candidates =
      decision.action.kind === "update"
        ? [decision.action.target]
        : decision.action.kind === "ambiguous"
          ? decision.action.candidates
          : [];
    const usable = candidates.filter((c) => c.status !== "out_of_stock");
    if (usable.length === 0) return;
    rows.push({
      key: unique[idx].id,
      displayName: unique[idx].displayName,
      importance: unique[idx].importance,
      candidates: usable,
    });
  });

  return rows.sort((a, b) => IMPORTANCE_ORDER[a.importance] - IMPORTANCE_ORDER[b.importance]);
}

export interface PostCookSelection {
  choice: PostCookChoice;
  // Required when the row has several candidates; ignored otherwise.
  targetId?: string | null;
}

export interface PostCookUpdate {
  kitchenItemId: string;
  status: Exclude<PostCookChoice, "keep">;
}

// Turns the user's explicit selections into Kitchen status updates. Rows left
// on "keep", rows with an unresolved ambiguous target, and no-op changes
// (status already equal) produce nothing. Two rows pointing at the same
// Kitchen item collapse to the most severe status.
export function planPostCookUpdates(
  rows: readonly PostCookRow[],
  selections: ReadonlyMap<string, PostCookSelection>,
): PostCookUpdate[] {
  const byItem = new Map<string, PostCookUpdate>();
  for (const row of rows) {
    const selection = selections.get(row.key);
    if (!selection || selection.choice === "keep") continue;

    const target =
      row.candidates.length === 1
        ? row.candidates[0]
        : row.candidates.find((c) => c.id === selection.targetId);
    if (!target || target.status === selection.choice) continue;

    const previous = byItem.get(target.id);
    if (!previous || selection.choice === "out_of_stock") {
      byItem.set(target.id, { kitchenItemId: target.id, status: selection.choice });
    }
  }
  return [...byItem.values()];
}
