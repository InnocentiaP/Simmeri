import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createIngredientMatcher, pluralInsensitiveKey, type MatcherAliasRow } from "./matcher.ts";

const USER = "user-1";

const aliases: MatcherAliasRow[] = [
  { canonical_ingredient_id: "rice_raw", normalized_alias: "beras", owner_user_id: null },
  { canonical_ingredient_id: "rice_raw", normalized_alias: "white rice", owner_user_id: null },
  { canonical_ingredient_id: "rice_cooked", normalized_alias: "nasi", owner_user_id: null },
  { canonical_ingredient_id: "green_onion", normalized_alias: "scallion", owner_user_id: null },
  { canonical_ingredient_id: "green_onion", normalized_alias: "daun bawang", owner_user_id: null },
  { canonical_ingredient_id: "tomato_fresh", normalized_alias: "tomato", owner_user_id: null },
  {
    canonical_ingredient_id: "tomato_paste",
    normalized_alias: "tomato paste",
    owner_user_id: null,
  },
  { canonical_ingredient_id: "garlic", normalized_alias: "garlic", owner_user_id: null },
  {
    canonical_ingredient_id: "garlic_powder",
    normalized_alias: "garlic powder",
    owner_user_id: null,
  },
  // A personal alias that overrides nothing global, and one owned by someone else.
  { canonical_ingredient_id: "garlic", normalized_alias: "bawput", owner_user_id: USER },
  {
    canonical_ingredient_id: "rice_cooked",
    normalized_alias: "beras",
    owner_user_id: "other-user",
  },
];

const keyOf = createIngredientMatcher({ aliases, links: [], userId: USER });
const same = (a: string, b: string) => keyOf(a) === keyOf(b);

describe("pluralInsensitiveKey", () => {
  it("gives singular and plural forms the same key", () => {
    for (const [a, b] of [
      ["tomato", "tomatoes"],
      ["cherry tomato", "cherry tomatoes"],
      ["chili", "chilies"],
      ["chilli", "chillies"],
      ["berry", "berries"],
      ["cookie", "cookies"],
      ["carrot", "carrots"],
      ["peach", "peaches"],
      ["egg", "eggs"],
      ["curry", "curries"],
    ]) {
      assert.equal(pluralInsensitiveKey(a), pluralInsensitiveKey(b), `${a} / ${b}`);
    }
  });

  it("leaves non-plurals, short words, and Indonesian words alone", () => {
    for (const word of [
      "molasses",
      "asparagus",
      "hummus",
      "couscous",
      "greens",
      "peas",
      "gas",
      "lemongrass",
      "bawang",
      "kemiri",
      "soy",
      "honey",
    ]) {
      assert.equal(pluralInsensitiveKey(word), word);
    }
  });
});

describe("createIngredientMatcher", () => {
  it("matches across languages through the catalog", () => {
    assert.ok(same("beras", "white rice"));
    assert.ok(same("Daun Bawang", "scallions"));
  });

  it("matches plural and singular forms, with or without a catalog entry", () => {
    assert.ok(same("tomatoes", "Tomato"));
    assert.ok(same("carrots", "carrot"));
    assert.ok(same("chilies", "chili"));
    assert.ok(same("scallion", "SCALLIONS"));
  });

  it("drops a plural stem shared by two different catalog ingredients", () => {
    const tricky = createIngredientMatcher({
      aliases: [
        { canonical_ingredient_id: "a", normalized_alias: "date", owner_user_id: null },
        { canonical_ingredient_id: "b", normalized_alias: "dates", owner_user_id: null },
      ],
      links: [],
      userId: null,
    });
    // Exact aliases still resolve; neither claims the other's spelling.
    assert.equal(tricky("date"), "c:a");
    assert.equal(tricky("dates"), "c:b");
  });

  it("keeps distinct ingredients apart", () => {
    assert.ok(!same("nasi", "beras"));
    assert.ok(!same("tomato", "tomato paste"));
    assert.ok(!same("garlic", "garlic powder"));
  });

  it("uses the user's own aliases but never someone else's", () => {
    assert.ok(same("bawput", "garlic"));
    assert.ok(!same("beras", "nasi"));
  });

  it("follows the user's personal links before the catalog", () => {
    const withLinks = createIngredientMatcher({
      aliases,
      links: [
        { alias_normalized: "cabe", target_normalized: "cabai merah" },
        { alias_normalized: "nasi putih", target_normalized: "nasi" },
      ],
      userId: USER,
    });
    assert.equal(withLinks("Cabe"), withLinks("cabai merah"));
    assert.equal(withLinks("nasi putih"), withLinks("nasi"));
    assert.notEqual(withLinks("cabe"), withLinks("cabai rawit"));
  });

  it("ignores accents, case, spacing, and trailing punctuation", () => {
    assert.ok(same("  Jalapeño  ", "jalapeno"));
    assert.ok(same("Garlic.", "garlic"));
  });

  it("falls back to text matching with an empty catalog", () => {
    const bare = createIngredientMatcher({ aliases: [], links: [], userId: null });
    assert.equal(bare("Onions"), bare("onion"));
    assert.notEqual(bare("onion"), bare("onion powder"));
  });
});
