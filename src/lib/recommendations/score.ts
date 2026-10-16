// Deterministic, explainable recipe recommendations for Tonight's Deck and
// dashboard suggestions. Pure: plain data in, ranked list out — no Supabase,
// no randomness, no clock reads (callers pass `now`), so every ranking is
// reproducible and unit-testable. Weights are named constants so they can be
// tuned without touching the logic. Ranking is never done by AI.

import type { ReadinessLabel } from "../readiness.ts";
import type { CookingRating } from "../cooking-rating.ts";

export interface RecommendationInput {
  recipeId: string;
  readiness: ReadinessLabel;
  // Names from the readiness explanation, used for reasons and "use it up".
  runningLow: string[];
  needsCheck: string[];
  missing: string[];
  totalMinutes: number | null;
  favorite: boolean;
  timesCooked: number;
  lastCookedAt: string | null;
  lastRating: CookingRating | null;
  plannedSoon: boolean;
}

export type Mood = "any" | "quick" | "use_up" | "new" | "old_favorite";

export const MOODS: { value: Mood; label: string }[] = [
  { value: "any", label: "Surprise me" },
  { value: "quick", label: "Quick (≤ 30 min)" },
  { value: "use_up", label: "Use what's running low" },
  { value: "new", label: "Something new" },
  { value: "old_favorite", label: "An old favorite" },
];

export interface Recommendation {
  recipeId: string;
  score: number;
  // Most important first; reasons[0] is the headline shown on a card.
  reasons: string[];
}

export const WEIGHTS = {
  readiness: {
    ready_to_cook: 100,
    almost_ready: 60,
    check_first: 40,
    needs_shopping: 10,
    // Only reachable when the caller opts in (endless deck / planning ahead).
    not_ready: -20,
  },
  favorite: 25,
  rating: { loved: 15, good: 5, meh: -15 },
  neverCooked: 15,
  cookedWithin3Days: -40,
  cookedWithin7Days: -25,
  cookedWithin14Days: -10,
  // Already-planned recipes sink, so swiping to plan the week surfaces new ideas.
  plannedSoon: -10,
  quick: 10,
  moodMatch: 30,
} as const;

export const QUICK_MINUTES = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

// Recipes whose readiness puts them in the deck by default. "needs_shopping"
// and "not_ready" (a core ingredient is missing) only appear when the caller
// explicitly opts in — e.g. the endless deck, where planning a later day
// leaves time to shop. Their lower readiness weight keeps them after
// anything cookable right now.
export function isEligible(
  input: RecommendationInput,
  includeNeedsShopping: boolean,
  includeNotReady = false,
): boolean {
  if (input.readiness === "not_ready") return includeNotReady;
  if (input.readiness === "needs_shopping") return includeNeedsShopping;
  return true;
}

export function matchesMood(input: RecommendationInput, mood: Mood, now: Date): boolean {
  switch (mood) {
    case "any":
      return true;
    case "quick":
      return input.totalMinutes != null && input.totalMinutes <= QUICK_MINUTES;
    case "use_up":
      return input.runningLow.length > 0;
    case "new":
      return input.timesCooked === 0;
    case "old_favorite": {
      const loved = input.favorite || input.lastRating === "loved";
      const days = daysSince(input.lastCookedAt, now);
      // An "old" favorite: not cooked in the last two weeks.
      return loved && (days == null || days >= 14);
    }
  }
}

function daysSince(iso: string | null, now: Date): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((now.getTime() - t) / DAY_MS));
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

function listNames(names: string[], max = 2): string {
  if (names.length <= max) return names.join(" and ");
  return `${names.slice(0, max).join(", ")} and ${names.length - max} more`;
}

function readinessReason(input: RecommendationInput): string {
  switch (input.readiness) {
    case "ready_to_cook":
      return "You have everything you need.";
    case "almost_ready":
      return `Ready, but running low on ${listNames(input.runningLow)}.`;
    case "check_first":
      return `Check you still have ${listNames(input.needsCheck)}.`;
    case "needs_shopping":
      return `Needs a quick shop: ${listNames(input.missing)}.`;
    case "not_ready":
      return `Missing ${listNames(input.missing)}.`;
  }
}

export function scoreRecipe(
  input: RecommendationInput,
  mood: Mood,
  now: Date,
): { score: number; reasons: string[] } {
  let score: number = WEIGHTS.readiness[input.readiness];
  // Personal signals are collected separately, then put before the generic
  // readiness line so the headline is the most specific reason available.
  const personal: string[] = [];
  const extra: string[] = [];

  if (mood !== "any" && matchesMood(input, mood, now)) score += WEIGHTS.moodMatch;

  if (mood === "use_up" && input.runningLow.length > 0) {
    personal.push(`Uses up ${listNames(input.runningLow)} before it runs out.`);
  }

  if (input.favorite) {
    score += WEIGHTS.favorite;
    personal.push("One of your favorites.");
  }

  if (input.lastRating) {
    score += WEIGHTS.rating[input.lastRating];
    if (input.lastRating === "loved" && !input.favorite) personal.push("You loved it last time.");
  }

  const days = daysSince(input.lastCookedAt, now);
  if (input.timesCooked === 0) {
    score += WEIGHTS.neverCooked;
    extra.push("You haven't tried this one yet.");
  } else if (days != null) {
    if (days < 3) score += WEIGHTS.cookedWithin3Days;
    else if (days < 7) score += WEIGHTS.cookedWithin7Days;
    else if (days < 14) score += WEIGHTS.cookedWithin14Days;

    if (days >= 30) extra.push(`Last made ${Math.floor(days / 7)} weeks ago.`);
    else if (days === 0) extra.push("You made this today.");
    else extra.push(`Last made ${plural(days, "day")} ago.`);
  }

  if (input.plannedSoon) {
    score += WEIGHTS.plannedSoon;
    extra.push("Already planned this week.");
  }

  if (input.totalMinutes != null && input.totalMinutes <= QUICK_MINUTES) {
    score += WEIGHTS.quick;
    extra.push(`Quick: about ${input.totalMinutes} min.`);
  }

  return { score, reasons: [...personal, readinessReason(input), ...extra] };
}

export interface RecommendOptions {
  mood: Mood;
  now: Date;
  includeNeedsShopping?: boolean;
  includeNotReady?: boolean;
  // When true (the default), a non-"any" mood filters to matching recipes;
  // when false it only boosts them.
  strictMood?: boolean;
  // Optional shuffle seed (e.g. today's date). Adds a repeatable random
  // nudge of up to SHUFFLE_SPREAD points per recipe, so the order changes
  // from day to day instead of always surfacing the same recipes first.
  // Same seed, same order; no seed, no shuffle.
  seed?: string;
}

// Big enough to reorder recipes within a readiness tier (e.g. let a
// non-favorite beat a favorite some days). Deliberately smaller than the
// "cooked in the last 3 days" penalty, so a recipe cooked yesterday always
// sinks below an otherwise equal one.
export const SHUFFLE_SPREAD = 35;

// Readiness tiers are never mixed by shuffling: what can be cooked now
// always comes before what needs a shop, which comes before what is missing
// a core ingredient.
function readinessTier(label: RecommendationInput["readiness"]): number {
  if (label === "needs_shopping") return 1;
  if (label === "not_ready") return 2;
  return 0;
}

// FNV-1a: a tiny, stable string hash mapped to [0, 1). Not for security —
// only to make a repeatable per-day, per-recipe shuffle.
export function seededUnit(seed: string, key: string): number {
  let hash = 0x811c9dc5;
  const text = `${seed}:${key}`;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0) / 0x100000000;
}

// Ranks eligible recipes: by readiness tier, then by score (plus the seeded
// shuffle nudge, when a seed is given). Ties break on recipeId so the order
// is stable across renders.
export function recommend(
  inputs: readonly RecommendationInput[],
  {
    mood,
    now,
    includeNeedsShopping = false,
    includeNotReady = false,
    strictMood = true,
    seed,
  }: RecommendOptions,
): Recommendation[] {
  return inputs
    .filter((input) => isEligible(input, includeNeedsShopping, includeNotReady))
    .filter((input) => !strictMood || mood === "any" || matchesMood(input, mood, now))
    .map((input) => {
      const scored = scoreRecipe(input, mood, now);
      const nudge = seed ? seededUnit(seed, input.recipeId) * SHUFFLE_SPREAD : 0;
      return {
        rec: { recipeId: input.recipeId, ...scored } as Recommendation,
        tier: readinessTier(input.readiness),
        sortKey: scored.score + nudge,
      };
    })
    .sort(
      (a, b) =>
        a.tier - b.tier ||
        b.sortKey - a.sortKey ||
        (a.rec.recipeId < b.rec.recipeId ? -1 : a.rec.recipeId > b.rec.recipeId ? 1 : 0),
    )
    .map((x) => x.rec);
}

export interface CookingHistoryRowInput {
  recipe_id: string;
  cooked_at: string;
  rating: string | null;
}

export interface CookingSummary {
  timesCooked: number;
  lastCookedAt: string | null;
  lastRating: CookingRating | null;
}

// Collapses raw cooking_history rows (any order) into one summary per
// recipe. lastRating is the rating of the most recent cook, or null when
// that cook was not rated — an older rating is deliberately not carried
// forward, since tastes change.
export function summarizeCookingHistory(
  rows: readonly CookingHistoryRowInput[],
): Map<string, CookingSummary> {
  const byRecipe = new Map<string, CookingSummary>();
  for (const row of rows) {
    const prev = byRecipe.get(row.recipe_id);
    const rating =
      row.rating === "loved" || row.rating === "good" || row.rating === "meh" ? row.rating : null;
    if (!prev) {
      byRecipe.set(row.recipe_id, {
        timesCooked: 1,
        lastCookedAt: row.cooked_at,
        lastRating: rating,
      });
      continue;
    }
    const isNewer =
      prev.lastCookedAt == null || Date.parse(row.cooked_at) > Date.parse(prev.lastCookedAt);
    byRecipe.set(row.recipe_id, {
      timesCooked: prev.timesCooked + 1,
      lastCookedAt: isNewer ? row.cooked_at : prev.lastCookedAt,
      lastRating: isNewer ? rating : prev.lastRating,
    });
  }
  return byRecipe;
}
