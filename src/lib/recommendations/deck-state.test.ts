import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  deckReducer,
  countDecisions,
  EMPTY_DECK,
  parseStoredDeck,
  remainingCards,
  shortlistIds,
  type DeckDecision,
  type DeckState,
} from "./deck-state.ts";

const decide = (state: DeckState, recipeId: string, decision: DeckDecision) =>
  deckReducer(state, { type: "decide", recipeId, decision });

describe("deckReducer", () => {
  it("records decisions in order and undoes the most recent one", () => {
    let s = decide(EMPTY_DECK, "a", "skip");
    s = decide(s, "b", "shortlist");
    assert.deepEqual(shortlistIds(s), ["b"]);
    s = deckReducer(s, { type: "undo" });
    assert.deepEqual(s.history, [{ recipeId: "a", decision: "skip" }]);
  });

  it("undo on an empty deck is a no-op", () => {
    assert.deepEqual(deckReducer(EMPTY_DECK, { type: "undo" }), EMPTY_DECK);
  });

  it("replaces an earlier decision on the same recipe", () => {
    let s = decide(EMPTY_DECK, "a", "skip");
    s = decide(s, "a", "shortlist");
    assert.deepEqual(s.history, [{ recipeId: "a", decision: "shortlist" }]);
  });

  it("removes a recipe from the shortlist and returns it to the deck", () => {
    let s = decide(EMPTY_DECK, "a", "shortlist");
    s = deckReducer(s, { type: "unshortlist", recipeId: "a" });
    assert.deepEqual(remainingCards(["a", "b"], s), ["a", "b"]);
  });

  it("resets everything", () => {
    const s = decide(EMPTY_DECK, "a", "skip");
    assert.deepEqual(deckReducer(s, { type: "reset" }), EMPTY_DECK);
  });
});

describe("remainingCards", () => {
  it("shows every ranked card that is still undecided, in order", () => {
    let s = decide(EMPTY_DECK, "a", "skip");
    s = decide(s, "c", "planned");
    assert.deepEqual(remainingCards(["a", "b", "c", "d"], s), ["b", "d"]);
  });
});

describe("planned and clearSkips", () => {
  it("removes a planned recipe from the shortlist", () => {
    let s = decide(EMPTY_DECK, "a", "shortlist");
    s = decide(s, "a", "planned");
    assert.deepEqual(shortlistIds(s), []);
    assert.equal(countDecisions(s, "planned"), 1);
  });

  it("brings skipped cards back but keeps shortlist and planned decisions", () => {
    let s = decide(EMPTY_DECK, "a", "skip");
    s = decide(s, "b", "shortlist");
    s = decide(s, "c", "planned");
    s = decide(s, "d", "skip");
    s = deckReducer(s, { type: "clearSkips" });
    assert.deepEqual(remainingCards(["a", "b", "c", "d"], s), ["a", "d"]);
    assert.deepEqual(shortlistIds(s), ["b"]);
  });
});

describe("parseStoredDeck", () => {
  it("round-trips a valid stored deck", () => {
    const s = decide(EMPTY_DECK, "a", "shortlist");
    assert.deepEqual(parseStoredDeck(JSON.stringify(s)), s);
  });

  it("falls back to an empty deck for missing, corrupt, or malformed data", () => {
    assert.deepEqual(parseStoredDeck(null), EMPTY_DECK);
    assert.deepEqual(parseStoredDeck("{not json"), EMPTY_DECK);
    assert.deepEqual(parseStoredDeck(JSON.stringify({ history: [{ recipeId: 1 }] })), EMPTY_DECK);
    assert.deepEqual(
      parseStoredDeck(JSON.stringify({ history: [{ recipeId: "a", decision: "love" }] })),
      EMPTY_DECK,
    );
  });
});
