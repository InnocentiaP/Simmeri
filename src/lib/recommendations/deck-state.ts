// Session-only state for Tonight's Deck. "Not tonight" is never a permanent
// dislike: this state lives in memory (and sessionStorage for the current
// day only, so viewing a recipe and coming back doesn't lose your place) and
// is never written to the database.

// "planned" = put on the meal plan from the deck; it leaves the deck and the
// shortlist so swiping can continue for the next day.
export type DeckDecision = "skip" | "shortlist" | "planned";

export interface DeckState {
  // Ordered oldest → newest, so undo pops the last entry.
  history: { recipeId: string; decision: DeckDecision }[];
}

export type DeckAction =
  | { type: "decide"; recipeId: string; decision: DeckDecision }
  | { type: "undo" }
  | { type: "unshortlist"; recipeId: string }
  // Brings every skipped card back while keeping shortlist and planned picks.
  | { type: "clearSkips" }
  | { type: "reset" };

export const EMPTY_DECK: DeckState = { history: [] };

export function deckReducer(state: DeckState, action: DeckAction): DeckState {
  switch (action.type) {
    case "decide":
      // Deciding twice on the same card replaces the earlier decision.
      return {
        history: [
          ...state.history.filter((h) => h.recipeId !== action.recipeId),
          { recipeId: action.recipeId, decision: action.decision },
        ],
      };
    case "undo":
      return { history: state.history.slice(0, -1) };
    case "unshortlist":
      return { history: state.history.filter((h) => h.recipeId !== action.recipeId) };
    case "clearSkips":
      return { history: state.history.filter((h) => h.decision !== "skip") };
    case "reset":
      return EMPTY_DECK;
  }
}

export function decidedIds(state: DeckState): Set<string> {
  return new Set(state.history.map((h) => h.recipeId));
}

export function shortlistIds(state: DeckState): string[] {
  return state.history.filter((h) => h.decision === "shortlist").map((h) => h.recipeId);
}

export function countDecisions(state: DeckState, decision: DeckDecision): number {
  return state.history.filter((h) => h.decision === decision).length;
}

// The cards still to show, in ranked order: every ranked recipe the user
// hasn't decided on yet. The deck is endless within the user's own
// collection — it ends only when every recipe has been seen.
export function remainingCards(rankedIds: readonly string[], state: DeckState): string[] {
  const decided = decidedIds(state);
  return rankedIds.filter((id) => !decided.has(id));
}

export function parseStoredDeck(raw: string | null): DeckState {
  if (!raw) return EMPTY_DECK;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      Array.isArray((parsed as DeckState).history) &&
      (parsed as DeckState).history.every(
        (h) =>
          typeof h?.recipeId === "string" &&
          (h.decision === "skip" || h.decision === "shortlist" || h.decision === "planned"),
      )
    ) {
      return { history: (parsed as DeckState).history };
    }
  } catch {
    // Corrupt storage falls through to a fresh deck.
  }
  return EMPTY_DECK;
}
