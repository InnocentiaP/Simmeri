// End-to-end checks that the ingredient matcher fixes the real symptoms:
// readiness, shopping-list merging, and Kitchen updates — while every
// function keeps its old exact-text behaviour when no matcher is passed.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createIngredientMatcher } from "./matcher.ts";
import { computeReadiness } from "../readiness.ts";
import { generateCandidates } from "../shopping-generate.ts";
import { decideKitchenUpdateTargets } from "../kitchen-update-plan.ts";
import { buildPostCookRows } from "../post-cook-kitchen.ts";

const keyOf = createIngredientMatcher({
  aliases: [
    { canonical_ingredient_id: "rice_raw", normalized_alias: "beras", owner_user_id: null },
    { canonical_ingredient_id: "rice_raw", normalized_alias: "white rice", owner_user_id: null },
    { canonical_ingredient_id: "green_onion", normalized_alias: "scallion", owner_user_id: null },
    {
      canonical_ingredient_id: "green_onion",
      normalized_alias: "spring onion",
      owner_user_id: null,
    },
    { canonical_ingredient_id: "garlic", normalized_alias: "garlic", owner_user_id: null },
    { canonical_ingredient_id: "garlic", normalized_alias: "bawang putih", owner_user_id: null },
  ],
  links: [{ alias_normalized: "cabe", target_normalized: "cabai merah" }],
  userId: "u1",
});

const kitchen = [
  { ingredient_name: "Tomato", status: "available" },
  { ingredient_name: "white rice", status: "available" },
  { ingredient_name: "Bawang putih", status: "running_low" },
  { ingredient_name: "cabai merah", status: "available" },
];

describe("readiness with the matcher", () => {
  const recipe = [
    { display_name: "tomatoes", importance: "core" as const },
    { display_name: "beras", importance: "core" as const },
    { display_name: "garlic", importance: "supporting" as const },
    { display_name: "cabe", importance: "seasoning" as const },
  ];

  it("recognises plurals, other languages, and personal links as present", () => {
    const r = computeReadiness(recipe, kitchen, keyOf);
    assert.equal(r.label, "almost_ready");
    assert.deepEqual(r.explanation.running_low, ["garlic"]);
    assert.deepEqual(r.explanation.missing_core, []);
  });

  it("keeps the old exact-text result without a matcher", () => {
    const r = computeReadiness(recipe, kitchen);
    assert.equal(r.label, "not_ready");
    assert.deepEqual(r.explanation.missing_core, ["tomatoes", "beras"]);
  });
});

describe("shopping list with the matcher", () => {
  const ingredient = (displayName: string) => ({
    displayName,
    quantityText: "2",
    unit: null,
    preparationNote: null,
    importance: "core" as const,
  });
  const source = (id: string, name: string) => ({
    context: {
      recipeId: id,
      recipeTitle: id,
      recipeServings: null,
      entryServings: null,
      mealPlanEntryId: null,
      plannedDate: null,
      mealType: null,
    },
    ingredients: [ingredient(name)],
  });

  it("merges the same ingredient written two ways into one line", () => {
    const items = generateCandidates(
      [source("A", "scallion"), source("B", "spring onions")],
      [],
      keyOf,
    );
    assert.equal(items.length, 1);
    assert.equal(items[0].quantityText, "4");
  });

  it("does not add what Kitchen already has under another name", () => {
    assert.equal(generateCandidates([source("A", "beras")], kitchen, keyOf).length, 0);
  });
});

describe("Kitchen updates with the matcher", () => {
  const active = [
    { id: "k1", name: "white rice", status: "out_of_stock", storageLocation: "pantry" },
  ];

  it("updates the existing Kitchen item after buying it under another name", () => {
    const [decision] = decideKitchenUpdateTargets(
      [{ id: "p1", displayName: "Beras" }],
      active,
      keyOf,
    );
    assert.equal(decision.action.kind, "update");
  });

  it("offers the matching Kitchen item after cooking", () => {
    const rows = buildPostCookRows(
      [{ id: "i1", displayName: "beras", importance: "core" }],
      [{ id: "k1", name: "white rice", status: "available", storageLocation: "pantry" }],
      keyOf,
    );
    assert.equal(rows.length, 1);
  });
});
