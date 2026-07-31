import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { findCanonicalMatch, type AliasLookupRow } from "./canonical-lookup.ts";

const RICE_RAW = "rice-raw-id";
const RICE_COOKED = "rice-cooked-id";
const TOMATO_FRESH = "tomato-fresh-id";
const TOMATO_PASTE = "tomato-paste-id";
const TOMATO_CANNED = "tomato-canned-id";
const MILK = "milk-id";
const COCONUT_MILK = "coconut-milk-id";
const BUTTER = "butter-id";
const MARGARINE = "margarine-id";
const ONION = "onion-id";
const ONION_POWDER = "onion-powder-id";
const GARLIC = "garlic-id";
const GARLIC_POWDER = "garlic-powder-id";
const FLOUR = "flour-id";
const ALMOND_FLOUR = "almond-flour-id";
const GREEN_ONION = "green-onion-id";

// Mirrors the checkpoint's real seed data closely enough to exercise every
// non-equivalence pair named in the plan's section D, without depending on
// a live database.
const GLOBAL_FIXTURE: AliasLookupRow[] = [
  { canonical_ingredient_id: RICE_RAW, normalized_alias: "beras", owner_user_id: null },
  { canonical_ingredient_id: RICE_RAW, normalized_alias: "uncooked rice", owner_user_id: null },
  { canonical_ingredient_id: RICE_RAW, normalized_alias: "white rice", owner_user_id: null },
  { canonical_ingredient_id: RICE_COOKED, normalized_alias: "nasi", owner_user_id: null },
  { canonical_ingredient_id: RICE_COOKED, normalized_alias: "cooked rice", owner_user_id: null },
  { canonical_ingredient_id: RICE_COOKED, normalized_alias: "steamed rice", owner_user_id: null },
  { canonical_ingredient_id: TOMATO_FRESH, normalized_alias: "tomato", owner_user_id: null },
  { canonical_ingredient_id: TOMATO_FRESH, normalized_alias: "tomatoes", owner_user_id: null },
  { canonical_ingredient_id: TOMATO_PASTE, normalized_alias: "tomato paste", owner_user_id: null },
  { canonical_ingredient_id: TOMATO_CANNED, normalized_alias: "canned tomatoes", owner_user_id: null },
  { canonical_ingredient_id: MILK, normalized_alias: "milk", owner_user_id: null },
  { canonical_ingredient_id: COCONUT_MILK, normalized_alias: "coconut milk", owner_user_id: null },
  { canonical_ingredient_id: BUTTER, normalized_alias: "butter", owner_user_id: null },
  { canonical_ingredient_id: MARGARINE, normalized_alias: "margarine", owner_user_id: null },
  { canonical_ingredient_id: ONION, normalized_alias: "onion", owner_user_id: null },
  { canonical_ingredient_id: ONION, normalized_alias: "onions", owner_user_id: null },
  { canonical_ingredient_id: ONION_POWDER, normalized_alias: "onion powder", owner_user_id: null },
  { canonical_ingredient_id: GARLIC, normalized_alias: "garlic", owner_user_id: null },
  { canonical_ingredient_id: GARLIC_POWDER, normalized_alias: "garlic powder", owner_user_id: null },
  { canonical_ingredient_id: FLOUR, normalized_alias: "flour", owner_user_id: null },
  { canonical_ingredient_id: FLOUR, normalized_alias: "all-purpose flour", owner_user_id: null },
  { canonical_ingredient_id: FLOUR, normalized_alias: "plain flour", owner_user_id: null },
  { canonical_ingredient_id: ALMOND_FLOUR, normalized_alias: "almond flour", owner_user_id: null },
  { canonical_ingredient_id: GREEN_ONION, normalized_alias: "green onion", owner_user_id: null },
  { canonical_ingredient_id: GREEN_ONION, normalized_alias: "scallion", owner_user_id: null },
  { canonical_ingredient_id: GREEN_ONION, normalized_alias: "spring onion", owner_user_id: null },
];

describe("findCanonicalMatch — basic matching", () => {
  it("matches an exact global alias", () => {
    assert.equal(findCanonicalMatch("beras", GLOBAL_FIXTURE, null), RICE_RAW);
    assert.equal(findCanonicalMatch("nasi", GLOBAL_FIXTURE, null), RICE_COOKED);
  });

  it("is case- and whitespace-insensitive (reuses normalizeForCanonicalMatch)", () => {
    assert.equal(findCanonicalMatch("  BERAS  ", GLOBAL_FIXTURE, null), RICE_RAW);
    assert.equal(findCanonicalMatch("Green   Onion", GLOBAL_FIXTURE, null), GREEN_ONION);
  });

  it("returns null for an unmatched term", () => {
    assert.equal(findCanonicalMatch("leek", GLOBAL_FIXTURE, null), null);
    assert.equal(findCanonicalMatch("durian", GLOBAL_FIXTURE, null), null);
  });

  it("returns null for empty input", () => {
    assert.equal(findCanonicalMatch("", GLOBAL_FIXTURE, null), null);
    assert.equal(findCanonicalMatch("   ", GLOBAL_FIXTURE, null), null);
  });

  it("matches multilingual and regional synonyms to the same canonical id", () => {
    assert.equal(findCanonicalMatch("scallion", GLOBAL_FIXTURE, null), GREEN_ONION);
    assert.equal(findCanonicalMatch("spring onion", GLOBAL_FIXTURE, null), GREEN_ONION);
    assert.equal(findCanonicalMatch("all-purpose flour", GLOBAL_FIXTURE, null), FLOUR);
    assert.equal(findCanonicalMatch("plain flour", GLOBAL_FIXTURE, null), FLOUR);
  });

  it("matches safe plural forms via their own explicit alias row", () => {
    assert.equal(findCanonicalMatch("onions", GLOBAL_FIXTURE, null), ONION);
    assert.equal(findCanonicalMatch("tomatoes", GLOBAL_FIXTURE, null), TOMATO_FRESH);
  });
});

describe("findCanonicalMatch — user alias priority (plan section E)", () => {
  it("prefers a user-owned alias over a global one for the same text", () => {
    const withOverride: AliasLookupRow[] = [
      ...GLOBAL_FIXTURE,
      { canonical_ingredient_id: TOMATO_PASTE, normalized_alias: "tomato", owner_user_id: "user-1" },
    ];
    assert.equal(findCanonicalMatch("tomato", withOverride, "user-1"), TOMATO_PASTE);
    // A different user, or no signed-in user, still gets the global default.
    assert.equal(findCanonicalMatch("tomato", withOverride, "user-2"), TOMATO_FRESH);
    assert.equal(findCanonicalMatch("tomato", withOverride, null), TOMATO_FRESH);
  });

  it("never leaks one user's private alias into another user's lookup", () => {
    const privateOnly: AliasLookupRow[] = [
      { canonical_ingredient_id: GREEN_ONION, normalized_alias: "leek", owner_user_id: "user-1" },
    ];
    assert.equal(findCanonicalMatch("leek", privateOnly, "user-2"), null);
    assert.equal(findCanonicalMatch("leek", privateOnly, null), null);
    assert.equal(findCanonicalMatch("leek", privateOnly, "user-1"), GREEN_ONION);
  });
});

describe("findCanonicalMatch — explicit non-equivalences (plan section D)", () => {
  it("beras (raw) and nasi (cooked) resolve to different canonical ids", () => {
    assert.notEqual(
      findCanonicalMatch("beras", GLOBAL_FIXTURE, null),
      findCanonicalMatch("nasi", GLOBAL_FIXTURE, null),
    );
  });

  it("tomato, tomato paste, and canned tomatoes all resolve to different canonical ids", () => {
    const fresh = findCanonicalMatch("tomato", GLOBAL_FIXTURE, null);
    const paste = findCanonicalMatch("tomato paste", GLOBAL_FIXTURE, null);
    const canned = findCanonicalMatch("canned tomatoes", GLOBAL_FIXTURE, null);
    assert.notEqual(fresh, paste);
    assert.notEqual(fresh, canned);
    assert.notEqual(paste, canned);
  });

  it("milk and coconut milk resolve to different canonical ids", () => {
    assert.notEqual(
      findCanonicalMatch("milk", GLOBAL_FIXTURE, null),
      findCanonicalMatch("coconut milk", GLOBAL_FIXTURE, null),
    );
  });

  it("butter and margarine resolve to different canonical ids", () => {
    assert.notEqual(
      findCanonicalMatch("butter", GLOBAL_FIXTURE, null),
      findCanonicalMatch("margarine", GLOBAL_FIXTURE, null),
    );
  });

  it("onion and onion powder resolve to different canonical ids", () => {
    assert.notEqual(
      findCanonicalMatch("onion", GLOBAL_FIXTURE, null),
      findCanonicalMatch("onion powder", GLOBAL_FIXTURE, null),
    );
  });

  it("garlic and garlic powder resolve to different canonical ids", () => {
    assert.notEqual(
      findCanonicalMatch("garlic", GLOBAL_FIXTURE, null),
      findCanonicalMatch("garlic powder", GLOBAL_FIXTURE, null),
    );
  });

  it("flour and almond flour resolve to different canonical ids", () => {
    assert.notEqual(
      findCanonicalMatch("flour", GLOBAL_FIXTURE, null),
      findCanonicalMatch("almond flour", GLOBAL_FIXTURE, null),
    );
  });

  it("green onion and leek are never linked by any global alias", () => {
    assert.equal(findCanonicalMatch("leek", GLOBAL_FIXTURE, null), null);
  });

  it("bare 'rice' has no global alias at all (deliberately unseeded — plan section P, open question 1)", () => {
    assert.equal(findCanonicalMatch("rice", GLOBAL_FIXTURE, null), null);
  });
});

describe("findCanonicalMatch — does not mutate its inputs", () => {
  it("leaves the alias rows array and its rows untouched", () => {
    const snapshot = JSON.stringify(GLOBAL_FIXTURE);
    findCanonicalMatch("beras", GLOBAL_FIXTURE, null);
    findCanonicalMatch("unknown-term", GLOBAL_FIXTURE, "some-user");
    assert.equal(JSON.stringify(GLOBAL_FIXTURE), snapshot);
  });
});
