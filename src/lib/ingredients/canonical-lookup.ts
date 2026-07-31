// Pure canonical-ingredient lookup for Wave 3 Checkpoint 3.1 (see
// docs/plans/WAVE_3_CANONICAL_INGREDIENTS_AND_RECOMMENDATIONS_PLAN.md,
// section E, steps 1-2). Operates only on an already-fetched array of alias
// rows — never queries Supabase itself, matching the "pure, dependency-free
// module" convention used throughout src/lib (e.g. shopping-merge.ts,
// kitchen-update-plan.ts). Nothing in the running app calls this yet; it
// exists and is tested ahead of Checkpoint 3.2's actual wiring into recipe
// ingredients and Kitchen items.
import { normalizeForCanonicalMatch } from "./normalize.ts";

export interface AliasLookupRow {
  canonical_ingredient_id: string;
  normalized_alias: string;
  owner_user_id: string | null;
}

// Looks up displayName's canonical ingredient id among the given alias
// rows, preferring a row owned by currentUserId over a global
// (owner_user_id === null) row when both match the same normalized text —
// a personal correction always overrides the shared default (plan section
// D/E). Returns null when no row's normalized_alias matches the normalized
// displayName — the safe "unmatched" default (plan section E step 7), which
// is also what a genuinely ambiguous term (never seeded as a global alias
// at all — plan section D) naturally falls into.
export function findCanonicalMatch(
  displayName: string,
  aliasRows: readonly AliasLookupRow[],
  currentUserId: string | null,
): string | null {
  const target = normalizeForCanonicalMatch(displayName);
  if (!target) return null;

  let globalHit: string | null = null;
  for (const row of aliasRows) {
    if (normalizeForCanonicalMatch(row.normalized_alias) !== target) continue;
    if (currentUserId !== null && row.owner_user_id === currentUserId) {
      return row.canonical_ingredient_id;
    }
    if (row.owner_user_id === null && globalHit === null) {
      globalHit = row.canonical_ingredient_id;
    }
  }
  return globalHit;
}
