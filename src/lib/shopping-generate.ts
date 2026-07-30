// Pure, dependency-free shopping-generation pipeline: recipe ingredients +
// current Kitchen state -> a reviewable, conservatively-merged candidate
// list, with full source provenance. No database access, no AI, no
// canonical-ingredient model. Reuses readiness.ts's Kitchen-matching
// primitives and shopping-merge.ts's normalization/quantity primitives —
// this module only orchestrates them (classification defaults, servings
// scaling, grouping, duplicate detection, and RPC-payload shaping).

import {
  buildKitchenPresenceIndex,
  classifyIngredientPresence,
  type IngredientPresence,
  type KitchenStatus,
  type ReadinessKitchenItem,
} from "./readiness.ts";
import {
  canonicalUnit,
  combineQuantityTexts,
  computeMergeKey,
  formatQuantityValue,
  isUnitMergeEligible,
  parseQuantityValue,
} from "./shopping-merge.ts";

export type GenerationImportance = "core" | "supporting" | "seasoning" | "optional";

export interface GenerationRecipeIngredient {
  displayName: string;
  importance: GenerationImportance;
  quantityText: string | null;
  unit: string | null;
  preparationNote: string | null;
}

// mealPlanEntryId/plannedDate/mealType/entryServings are all null for
// direct recipe generation (Recipe Detail / My Recipes multi-select) — only
// planner-driven generation (day/week) sets them.
export interface GenerationSourceContext {
  recipeId: string;
  recipeTitle: string;
  mealPlanEntryId: string | null;
  plannedDate: string | null;
  mealType: string | null;
  recipeServings: number | null;
  entryServings: number | null;
}

export interface RawIngredientCandidate {
  displayName: string;
  unit: string | null;
  preparationNote: string | null;
  presence: Exclude<IngredientPresence, "available">;
  rawQuantityText: string | null;
  scaledQuantityText: string | null;
  scalingApplied: boolean;
  scalingWarning: string | null;
  source: GenerationSourceContext;
}

// Builds one raw candidate per non-optional, non-available ingredient for a
// single recipe/context pair. Optional ingredients and anything already
// "available" in Kitchen are excluded entirely — they never become
// candidates at all, matching computeReadiness's own treatment of optional
// ingredients as ignored.
export function buildCandidatesForSource(
  ingredients: readonly GenerationRecipeIngredient[],
  kitchenIndex: Map<string, KitchenStatus>,
  context: GenerationSourceContext,
): RawIngredientCandidate[] {
  const candidates: RawIngredientCandidate[] = [];

  for (const ingredient of ingredients) {
    if (ingredient.importance === "optional") continue;

    const presence = classifyIngredientPresence(ingredient.displayName, kitchenIndex);
    if (presence === "available") continue;

    let scaledQuantityText = ingredient.quantityText;
    let scalingApplied = false;
    let scalingWarning: string | null = null;

    const { recipeServings, entryServings } = context;
    if (
      recipeServings !== null &&
      entryServings !== null &&
      recipeServings > 0 &&
      entryServings > 0 &&
      entryServings !== recipeServings
    ) {
      const parsedValue = parseQuantityValue(ingredient.quantityText);
      if (parsedValue !== null) {
        scaledQuantityText = formatQuantityValue(parsedValue * (entryServings / recipeServings));
        scalingApplied = true;
      } else if (ingredient.quantityText) {
        scalingWarning =
          "Couldn't safely scale this amount for the planned servings — showing the original quantity.";
      }
    }

    candidates.push({
      displayName: ingredient.displayName,
      unit: ingredient.unit,
      preparationNote: ingredient.preparationNote,
      presence,
      rawQuantityText: ingredient.quantityText,
      scaledQuantityText,
      scalingApplied,
      scalingWarning,
      source: context,
    });
  }

  return candidates;
}

export interface GeneratedCandidateItem {
  mergeKey: string;
  displayName: string;
  unit: string | null;
  presence: Exclude<IngredientPresence, "available">;
  combinable: boolean;
  quantityText: string | null;
  sources: RawIngredientCandidate[];
}

const PRESENCE_PRIORITY: Record<Exclude<IngredientPresence, "available">, number> = {
  missing: 3,
  needs_check: 2,
  running_low: 1,
};

function composeUncombinedQuantityText(members: readonly RawIngredientCandidate[]): string | null {
  const parts = members
    .map((m) => [m.scaledQuantityText, m.unit].filter(Boolean).join(" ").trim())
    .filter((p) => p.length > 0);
  return parts.length > 0 ? parts.join(" + ") : null;
}

// Groups raw candidates sharing a merge key (normalized name + canonical
// unit family). Within a group, quantities are only ever numerically
// combined when every member's (scaled) quantity parses safely, the unit is
// actually merge-eligible (absent, or a recognized alias — never a
// non-empty unrecognized unit), AND no two members have materially
// conflicting, non-empty preparation notes (e.g. "diced" vs "whole") —
// otherwise each contribution is preserved separately in the displayed
// quantity text, never inventing a total.
//
// A non-empty unrecognized unit is never merge-eligible, and critically,
// not even against another candidate carrying the exact same literal unit
// text ("scoop" + "scoop" must not merge just because the strings match —
// only the explicitly supported alias families, or the complete absence of
// a unit, are ever treated as compatible). Since canonicalUnit() is a pure
// function of the unit text alone, two unrecognized-unit candidates would
// otherwise land in the same computeMergeKey group; disambiguating them
// requires the candidate's position in this array, not just its unit text,
// so ineligible-unit candidates are each given their own singleton group
// here instead of being grouped by the shared (but merge-ineligible) key.
export function groupCandidates(raw: readonly RawIngredientCandidate[]): GeneratedCandidateItem[] {
  const order: string[] = [];
  const groups = new Map<string, RawIngredientCandidate[]>();

  raw.forEach((candidate, index) => {
    const baseKey = computeMergeKey(candidate.displayName, candidate.unit);
    const key = isUnitMergeEligible(candidate.unit) ? baseKey : `${baseKey}#unsupported-unit-${index}`;
    if (!groups.has(key)) {
      groups.set(key, []);
      order.push(key);
    }
    groups.get(key)!.push(candidate);
  });

  return order.map((key) => {
    const members = groups.get(key)!;
    const presence = members.reduce<Exclude<IngredientPresence, "available">>(
      (worst, m) => (PRESENCE_PRIORITY[m.presence] > PRESENCE_PRIORITY[worst] ? m.presence : worst),
      members[0].presence,
    );

    const distinctPrepNotes = new Set(
      members
        .map((m) => (m.preparationNote ? m.preparationNote.trim().toLowerCase() : ""))
        .filter((n) => n !== ""),
    );
    const prepConflict = distinctPrepNotes.size > 1;
    const unitEligible = isUnitMergeEligible(members[0].unit);

    const combineResult =
      prepConflict || !unitEligible
        ? ({ combinable: false } as const)
        : combineQuantityTexts(members.map((m) => m.scaledQuantityText));

    return {
      mergeKey: key,
      displayName: members[0].displayName,
      unit: combineResult.combinable ? canonicalUnit(members[0].unit) : null,
      presence,
      combinable: combineResult.combinable,
      quantityText: combineResult.combinable
        ? combineResult.combinedText
        : composeUncombinedQuantityText(members),
      sources: members,
    };
  });
}

// Top-level pure entry point: recipe ingredients (grouped by source
// context) + current active Kitchen items -> the reviewable candidate list.
export function generateCandidates(
  sources: ReadonlyArray<{
    context: GenerationSourceContext;
    ingredients: readonly GenerationRecipeIngredient[];
  }>,
  activeKitchenItems: readonly ReadinessKitchenItem[],
): GeneratedCandidateItem[] {
  const kitchenIndex = buildKitchenPresenceIndex(activeKitchenItems.filter((k) => !k.archived_at));
  const raw: RawIngredientCandidate[] = [];
  for (const { context, ingredients } of sources) {
    raw.push(...buildCandidatesForSource(ingredients, kitchenIndex, context));
  }
  return groupCandidates(raw);
}

export interface InclusionOptions {
  includeRunningLow: boolean;
  includeNeedsCheck: boolean;
}

// Default generation behavior: missing is always included; running_low and
// needs_check are excluded unless the user has explicitly opted in via the
// corresponding toggle. Optional ingredients and available ingredients
// never reach this function at all (excluded upstream).
export function isIncludedByDefault(
  presence: Exclude<IngredientPresence, "available">,
  options: InclusionOptions,
): boolean {
  if (presence === "missing") return true;
  if (presence === "running_low") return options.includeRunningLow;
  return options.includeNeedsCheck;
}

export interface SourceIdentity {
  recipeId: string | null;
  mealPlanEntryId: string | null;
}

function sourceIdentityKey(identity: SourceIdentity): string {
  return `${identity.recipeId ?? ""}::${identity.mealPlanEntryId ?? ""}`;
}

// Flags each candidate that shares at least one source's (recipe_id,
// meal_plan_entry_id) identity with something already generated into the
// target list — direct-recipe sources have mealPlanEntryId === null, so
// they're only ever flagged against other direct-recipe generations of the
// same recipe, never against a planner-generated source for that recipe
// (and vice versa).
export function detectAlreadyGenerated(
  candidates: readonly GeneratedCandidateItem[],
  existingSources: ReadonlyArray<SourceIdentity>,
): boolean[] {
  const existingKeys = new Set(existingSources.map(sourceIdentityKey));
  return candidates.map((candidate) =>
    candidate.sources.some((s) =>
      existingKeys.has(
        sourceIdentityKey({ recipeId: s.source.recipeId, mealPlanEntryId: s.source.mealPlanEntryId }),
      ),
    ),
  );
}

export interface GenerationPayloadSource {
  recipe_id: string | null;
  recipe_title_snapshot: string | null;
  meal_plan_entry_id: string | null;
  planned_date_snapshot: string | null;
  meal_type_snapshot: string | null;
  raw_quantity_text: string | null;
}

export interface GenerationPayloadItem {
  display_name: string;
  quantity_text: string | null;
  unit: string | null;
  note: string | null;
  sources: GenerationPayloadSource[];
}

// Structural (not imported) shapes matching the recipe_ingredients/recipes/
// meal_plan_entries DB rows, so this module never depends on api.ts or the
// Supabase client — kept fully dependency-free per this checkpoint's
// requirement, while still giving every UI entry point one shared,
// consistent way to build generation inputs from real data.
export interface DbRecipeIngredientLike {
  display_name: string;
  importance: string;
  quantity_text: string | null;
  unit: string | null;
  preparation_note: string | null;
}

const KNOWN_IMPORTANCE: readonly GenerationImportance[] = ["core", "supporting", "seasoning", "optional"];

export function toGenerationIngredients(
  rows: readonly DbRecipeIngredientLike[],
): GenerationRecipeIngredient[] {
  return rows.map((r) => ({
    displayName: r.display_name,
    importance: (KNOWN_IMPORTANCE as readonly string[]).includes(r.importance)
      ? (r.importance as GenerationImportance)
      : "supporting",
    quantityText: r.quantity_text,
    unit: r.unit,
    preparationNote: r.preparation_note,
  }));
}

export interface DbRecipeLike {
  id: string;
  title: string;
  servings: number | null;
}

export function buildDirectRecipeContext(recipe: DbRecipeLike): GenerationSourceContext {
  return {
    recipeId: recipe.id,
    recipeTitle: recipe.title,
    mealPlanEntryId: null,
    plannedDate: null,
    mealType: null,
    recipeServings: recipe.servings,
    entryServings: null,
  };
}

export interface DbMealPlanEntryLike {
  id: string;
  planned_date: string;
  meal_type: string;
  servings: number | null;
}

// entryServings falls back to the recipe's own default when the entry
// didn't set one explicitly — a null entry.servings means "use the
// recipe's default," not "unknown," so it must resolve to a 1:1 ratio
// (no scaling), never a scaling attempt against null.
export function buildPlannerEntryContext(
  entry: DbMealPlanEntryLike,
  recipe: DbRecipeLike,
): GenerationSourceContext {
  return {
    recipeId: recipe.id,
    recipeTitle: recipe.title,
    mealPlanEntryId: entry.id,
    plannedDate: entry.planned_date,
    mealType: entry.meal_type,
    recipeServings: recipe.servings,
    entryServings: entry.servings ?? recipe.servings,
  };
}

// Shapes only the caller-approved candidates into the exact JSONB payload
// generate_shopping_list_items expects. Performs no merge/business logic of
// its own — that already happened in groupCandidates/generateCandidates.
export function buildGenerationPayload(
  candidates: readonly GeneratedCandidateItem[],
): GenerationPayloadItem[] {
  return candidates.map((candidate) => ({
    display_name: candidate.displayName,
    quantity_text: candidate.quantityText,
    unit: candidate.unit,
    note: null,
    sources: candidate.sources.map((s) => ({
      recipe_id: s.source.recipeId,
      recipe_title_snapshot: s.source.recipeTitle,
      meal_plan_entry_id: s.source.mealPlanEntryId,
      planned_date_snapshot: s.source.plannedDate,
      meal_type_snapshot: s.source.mealType,
      raw_quantity_text: s.rawQuantityText,
    })),
  }));
}
