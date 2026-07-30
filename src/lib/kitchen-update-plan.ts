// Pure decision logic for the "Update Kitchen from purchased items" flow.
// Never touches Supabase or any I/O — takes plain arrays in, returns a plain
// decision per purchased item, and never mutates either input array/object.

export interface KitchenCandidate {
  id: string;
  name: string;
  status: string;
  storageLocation: string;
}

export interface ActiveKitchenItemInput {
  id: string;
  name: string;
  status: string;
  storageLocation: string;
  archivedAt?: string | null;
}

export interface PurchasedItemInput {
  id: string;
  displayName: string;
}

export type KitchenUpdateAction =
  | { kind: "create" }
  | { kind: "update"; target: KitchenCandidate }
  | { kind: "ambiguous"; candidates: KitchenCandidate[] };

export interface KitchenUpdateDecision {
  purchasedItemId: string;
  displayName: string;
  action: KitchenUpdateAction;
}

// Conservative normalization only — trim, lowercase, collapse repeated
// internal whitespace. No fuzzy matching, no stemming, no synonym tables.
export function normalizeKitchenCandidateName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function toCandidate(item: ActiveKitchenItemInput): KitchenCandidate {
  return { id: item.id, name: item.name, status: item.status, storageLocation: item.storageLocation };
}

// For each purchased item, classify the Kitchen-update action:
// - "create" when no active Kitchen row shares its normalized name
// - "update" when exactly one active Kitchen row matches
// - "ambiguous" when more than one active Kitchen row matches — the caller
//   (UI) must ask the user to pick one; this module never guesses.
// Archived Kitchen rows are excluded from matching entirely.
export function decideKitchenUpdateTargets(
  purchasedItems: readonly PurchasedItemInput[],
  activeKitchenItems: readonly ActiveKitchenItemInput[],
): KitchenUpdateDecision[] {
  const active = activeKitchenItems.filter((k) => !k.archivedAt);

  const byNormalizedName = new Map<string, ActiveKitchenItemInput[]>();
  for (const item of active) {
    const key = normalizeKitchenCandidateName(item.name);
    byNormalizedName.set(key, [...(byNormalizedName.get(key) ?? []), item]);
  }

  return purchasedItems.map((purchased) => {
    const key = normalizeKitchenCandidateName(purchased.displayName);
    const matches = byNormalizedName.get(key) ?? [];

    let action: KitchenUpdateAction;
    if (matches.length === 0) {
      action = { kind: "create" };
    } else if (matches.length === 1) {
      action = { kind: "update", target: toCandidate(matches[0]) };
    } else {
      action = { kind: "ambiguous", candidates: matches.map(toCandidate) };
    }

    return { purchasedItemId: purchased.id, displayName: purchased.displayName, action };
  });
}
