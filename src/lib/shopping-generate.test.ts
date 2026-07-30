import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildCandidatesForSource,
  groupCandidates,
  generateCandidates,
  isIncludedByDefault,
  detectAlreadyGenerated,
  buildGenerationPayload,
  toGenerationIngredients,
  buildDirectRecipeContext,
  buildPlannerEntryContext,
  type GenerationRecipeIngredient,
  type GenerationSourceContext,
  type RawIngredientCandidate,
} from "./shopping-generate.ts";
import { buildKitchenPresenceIndex } from "./readiness.ts";
import type { ReadinessKitchenItem } from "./readiness.ts";

function ingredient(overrides: Partial<GenerationRecipeIngredient>): GenerationRecipeIngredient {
  return {
    displayName: "flour",
    importance: "core",
    quantityText: "1",
    unit: null,
    preparationNote: null,
    ...overrides,
  };
}

function context(overrides: Partial<GenerationSourceContext> = {}): GenerationSourceContext {
  return {
    recipeId: "recipe-1",
    recipeTitle: "Pasta Bake",
    mealPlanEntryId: null,
    plannedDate: null,
    mealType: null,
    recipeServings: null,
    entryServings: null,
    ...overrides,
  };
}

describe("buildCandidatesForSource — Kitchen inclusion defaults", () => {
  it("excludes an available ingredient entirely", () => {
    const kitchen = buildKitchenPresenceIndex([{ ingredient_name: "flour", status: "available" }]);
    const result = buildCandidatesForSource([ingredient({})], kitchen, context());
    assert.equal(result.length, 0);
  });

  it("includes a missing ingredient", () => {
    const kitchen = buildKitchenPresenceIndex([]);
    const result = buildCandidatesForSource([ingredient({})], kitchen, context());
    assert.equal(result.length, 1);
    assert.equal(result[0].presence, "missing");
  });

  it("produces a needs_check candidate, separately selectable, not silently missing", () => {
    const kitchen = buildKitchenPresenceIndex([{ ingredient_name: "flour", status: "unknown" }]);
    const result = buildCandidatesForSource([ingredient({})], kitchen, context());
    assert.equal(result[0].presence, "needs_check");
  });

  it("produces a running_low candidate", () => {
    const kitchen = buildKitchenPresenceIndex([{ ingredient_name: "flour", status: "running_low" }]);
    const result = buildCandidatesForSource([ingredient({})], kitchen, context());
    assert.equal(result[0].presence, "running_low");
  });

  it("excludes optional ingredients entirely, regardless of Kitchen state", () => {
    const kitchen = buildKitchenPresenceIndex([]);
    const result = buildCandidatesForSource(
      [ingredient({ displayName: "chives", importance: "optional" })],
      kitchen,
      context(),
    );
    assert.equal(result.length, 0);
  });
});

describe("isIncludedByDefault", () => {
  it("includes missing by default", () => {
    assert.equal(isIncludedByDefault("missing", { includeRunningLow: false, includeNeedsCheck: false }), true);
  });

  it("excludes running_low by default", () => {
    assert.equal(isIncludedByDefault("running_low", { includeRunningLow: false, includeNeedsCheck: false }), false);
  });

  it("includes running_low when explicitly enabled", () => {
    assert.equal(isIncludedByDefault("running_low", { includeRunningLow: true, includeNeedsCheck: false }), true);
  });

  it("excludes needs_check by default", () => {
    assert.equal(isIncludedByDefault("needs_check", { includeRunningLow: false, includeNeedsCheck: false }), false);
  });

  it("includes needs_check when explicitly enabled", () => {
    assert.equal(isIncludedByDefault("needs_check", { includeRunningLow: false, includeNeedsCheck: true }), true);
  });
});

describe("buildCandidatesForSource — servings scaling", () => {
  const kitchen = buildKitchenPresenceIndex([]);

  it("preserves quantity when servings are equal", () => {
    const [c] = buildCandidatesForSource(
      [ingredient({ quantityText: "2" })],
      kitchen,
      context({ recipeServings: 4, entryServings: 4 }),
    );
    assert.equal(c.scaledQuantityText, "2");
    assert.equal(c.scalingApplied, false);
  });

  it("doubles a safe numeric quantity when entry servings double the recipe default", () => {
    const [c] = buildCandidatesForSource(
      [ingredient({ quantityText: "2" })],
      kitchen,
      context({ recipeServings: 4, entryServings: 8 }),
    );
    assert.equal(c.scaledQuantityText, "4");
    assert.equal(c.scalingApplied, true);
  });

  it("halves a safe numeric quantity when entry servings are half the recipe default", () => {
    const [c] = buildCandidatesForSource(
      [ingredient({ quantityText: "2" })],
      kitchen,
      context({ recipeServings: 4, entryServings: 2 }),
    );
    assert.equal(c.scaledQuantityText, "1");
    assert.equal(c.scalingApplied, true);
  });

  it("does not scale when recipe servings is null", () => {
    const [c] = buildCandidatesForSource(
      [ingredient({ quantityText: "2" })],
      kitchen,
      context({ recipeServings: null, entryServings: 8 }),
    );
    assert.equal(c.scaledQuantityText, "2");
    assert.equal(c.scalingApplied, false);
  });

  it("does not scale when entry servings is null", () => {
    const [c] = buildCandidatesForSource(
      [ingredient({ quantityText: "2" })],
      kitchen,
      context({ recipeServings: 4, entryServings: null }),
    );
    assert.equal(c.scaledQuantityText, "2");
    assert.equal(c.scalingApplied, false);
  });

  it("does not scale when recipe servings is zero", () => {
    const [c] = buildCandidatesForSource(
      [ingredient({ quantityText: "2" })],
      kitchen,
      context({ recipeServings: 0, entryServings: 8 }),
    );
    assert.equal(c.scalingApplied, false);
  });

  it("leaves an ambiguous quantity unchanged and attaches a scaling warning", () => {
    const [c] = buildCandidatesForSource(
      [ingredient({ quantityText: "to taste" })],
      kitchen,
      context({ recipeServings: 4, entryServings: 8 }),
    );
    assert.equal(c.scaledQuantityText, "to taste");
    assert.equal(c.scalingApplied, false);
    assert.ok(c.scalingWarning);
  });
});

describe("groupCandidates — conservative merge rules", () => {
  function candidate(overrides: Partial<RawIngredientCandidate>): RawIngredientCandidate {
    return {
      displayName: "baking powder",
      unit: "teaspoon",
      preparationNote: null,
      presence: "missing",
      rawQuantityText: "1",
      scaledQuantityText: "1",
      scalingApplied: false,
      scalingWarning: null,
      source: context(),
      ...overrides,
    };
  }

  it("merges equivalent names/units: baking powder 1 teaspoon + 2 tsp = 3 teaspoon", () => {
    const [item] = groupCandidates([
      candidate({ scaledQuantityText: "1", unit: "teaspoon" }),
      candidate({ displayName: "Baking Powder", scaledQuantityText: "2", unit: "tsp" }),
    ]);
    assert.equal(item.combinable, true);
    assert.equal(item.quantityText, "3");
    assert.equal(item.unit, "teaspoon");
    assert.equal(item.sources.length, 2);
  });

  it("does not force-merge tomatoes 2 pieces with canned tomatoes 400 g", () => {
    const items = groupCandidates([
      candidate({ displayName: "tomatoes", unit: "piece", scaledQuantityText: "2" }),
      candidate({ displayName: "canned tomatoes", unit: "g", scaledQuantityText: "400" }),
    ]);
    assert.equal(items.length, 2);
  });

  it("does not force-merge milk 1 cup with milk 200 g (incompatible unit families)", () => {
    // Two distinct merge keys (milk::cup vs milk::g) -> not merged into one item.
    const grouped = groupCandidates([
      candidate({ displayName: "milk", unit: "cup", scaledQuantityText: "1" }),
      candidate({ displayName: "milk", unit: "g", scaledQuantityText: "200" }),
    ]);
    assert.equal(grouped.length, 2);
  });

  it("does not force-merge onion 1 piece diced with onion 1 piece whole (preparation conflict)", () => {
    const [item] = groupCandidates([
      candidate({ displayName: "onion", unit: "piece", scaledQuantityText: "1", preparationNote: "diced" }),
      candidate({ displayName: "onion", unit: "piece", scaledQuantityText: "1", preparationNote: "whole" }),
    ]);
    assert.equal(item.combinable, false);
    assert.equal(item.sources.length, 2);
    assert.ok(item.quantityText?.includes("+"));
  });

  it("preserves separate contributions without inventing a total when a quantity is ambiguous", () => {
    const [item] = groupCandidates([
      candidate({ scaledQuantityText: "1", unit: "teaspoon" }),
      candidate({ scaledQuantityText: "to taste", unit: "teaspoon" }),
    ]);
    assert.equal(item.combinable, false);
    assert.equal(item.sources.length, 2);
    assert.doesNotMatch(item.quantityText ?? "", /NaN/);
  });

  it("keeps rice 1 scoop and rice 2 scoop separate — identical unrecognized unit text never merges", () => {
    const items = groupCandidates([
      candidate({ displayName: "rice", unit: "scoop", scaledQuantityText: "1" }),
      candidate({ displayName: "rice", unit: "scoop", scaledQuantityText: "2" }),
    ]);
    assert.equal(items.length, 2);
    assert.equal(items.every((i) => i.combinable === false), true);
    assert.equal(
      items.every((i) => i.sources.length === 1),
      true,
    );
  });

  it("keeps spice 1 packet and spice 2 packet separate (packet is deliberately not a supported alias)", () => {
    const items = groupCandidates([
      candidate({ displayName: "spice", unit: "packet", scaledQuantityText: "1" }),
      candidate({ displayName: "spice", unit: "packet", scaledQuantityText: "2" }),
    ]);
    assert.equal(items.length, 2);
  });

  it("merges rice with no unit + rice with no unit when quantities are safely parseable", () => {
    const [item] = groupCandidates([
      candidate({ displayName: "rice", unit: null, scaledQuantityText: "1" }),
      candidate({ displayName: "rice", unit: null, scaledQuantityText: "2" }),
    ]);
    assert.equal(item.combinable, true);
    assert.equal(item.quantityText, "3");
    assert.equal(item.unit, null);
  });

  it("still merges baking powder 1 teaspoon + 2 tsp into 3 teaspoon after the unknown-unit fix", () => {
    const [item] = groupCandidates([
      candidate({ scaledQuantityText: "1", unit: "teaspoon" }),
      candidate({ scaledQuantityText: "2", unit: "tsp" }),
    ]);
    assert.equal(item.combinable, true);
    assert.equal(item.quantityText, "3");
    assert.equal(item.unit, "teaspoon");
  });

  it("keeps incompatible supported units separate (g vs kg) after the unknown-unit fix", () => {
    const items = groupCandidates([
      candidate({ displayName: "flour", unit: "g", scaledQuantityText: "500" }),
      candidate({ displayName: "flour", unit: "kg", scaledQuantityText: "1" }),
    ]);
    assert.equal(items.length, 2);
  });

  it("does not mutate the input candidates array", () => {
    const raw = [
      candidate({ displayName: "rice", unit: "scoop", scaledQuantityText: "1" }),
      candidate({ displayName: "rice", unit: "scoop", scaledQuantityText: "2" }),
    ];
    const snapshot = JSON.parse(JSON.stringify(raw));
    groupCandidates(raw);
    assert.deepEqual(raw, snapshot);
  });

  it("retains every contributing source on a merged item", () => {
    const [item] = groupCandidates([
      candidate({ source: context({ recipeId: "r1", recipeTitle: "Pasta Bake" }) }),
      candidate({ source: context({ recipeId: "r2", recipeTitle: "Tomato Soup" }) }),
    ]);
    assert.equal(item.sources.length, 2);
    const titles = item.sources.map((s) => s.source.recipeTitle).sort();
    assert.deepEqual(titles, ["Pasta Bake", "Tomato Soup"]);
  });
});

describe("generateCandidates — end-to-end pipeline across multiple recipes", () => {
  it("classifies, scales, and groups across two recipes sharing an ingredient", () => {
    const kitchen: ReadinessKitchenItem[] = [{ ingredient_name: "garlic", status: "available" }];
    const candidates = generateCandidates(
      [
        {
          context: context({ recipeId: "r1", recipeTitle: "Pasta Bake" }),
          ingredients: [
            ingredient({ displayName: "garlic", quantityText: "2" }),
            ingredient({ displayName: "flour", quantityText: "1", unit: "cup" }),
          ],
        },
        {
          context: context({ recipeId: "r2", recipeTitle: "Tomato Soup" }),
          ingredients: [ingredient({ displayName: "flour", quantityText: "0.5", unit: "cup" })],
        },
      ],
      kitchen,
    );
    // garlic is available -> excluded entirely.
    assert.equal(candidates.some((c) => c.displayName === "garlic"), false);
    const flour = candidates.find((c) => c.displayName === "flour");
    assert.ok(flour);
    assert.equal(flour!.combinable, true);
    assert.equal(flour!.quantityText, "1.5");
    assert.equal(flour!.sources.length, 2);
  });
});

describe("detectAlreadyGenerated", () => {
  it("flags a direct-recipe candidate already generated from the same recipe with no meal-plan entry", () => {
    const [item] = groupCandidates([
      { ...baseCandidate(), source: context({ recipeId: "r1", mealPlanEntryId: null }) },
    ]);
    const flags = detectAlreadyGenerated([item], [{ recipeId: "r1", mealPlanEntryId: null }]);
    assert.deepEqual(flags, [true]);
  });

  it("flags a planner-generated candidate already generated from the same meal-plan entry", () => {
    const [item] = groupCandidates([
      { ...baseCandidate(), source: context({ recipeId: "r1", mealPlanEntryId: "entry-1" }) },
    ]);
    const flags = detectAlreadyGenerated([item], [{ recipeId: "r1", mealPlanEntryId: "entry-1" }]);
    assert.deepEqual(flags, [true]);
  });

  it("does not flag a direct-recipe candidate against a planner source for the same recipe", () => {
    const [item] = groupCandidates([
      { ...baseCandidate(), source: context({ recipeId: "r1", mealPlanEntryId: null }) },
    ]);
    const flags = detectAlreadyGenerated([item], [{ recipeId: "r1", mealPlanEntryId: "entry-1" }]);
    assert.deepEqual(flags, [false]);
  });

  it("allows intentional include-again — detection only flags, never removes the candidate", () => {
    const [item] = groupCandidates([
      { ...baseCandidate(), source: context({ recipeId: "r1", mealPlanEntryId: null }) },
    ]);
    const flags = detectAlreadyGenerated([item], [{ recipeId: "r1", mealPlanEntryId: null }]);
    assert.equal(flags[0], true);
    // The candidate itself is still present and payload-buildable regardless.
    const payload = buildGenerationPayload([item]);
    assert.equal(payload.length, 1);
  });

  function baseCandidate(): RawIngredientCandidate {
    return {
      displayName: "flour",
      unit: "cup",
      preparationNote: null,
      presence: "missing",
      rawQuantityText: "1",
      scaledQuantityText: "1",
      scalingApplied: false,
      scalingWarning: null,
      source: context(),
    };
  }
});

describe("DB-row-shape conversion helpers", () => {
  it("maps recipe_ingredients rows to generation ingredient inputs", () => {
    const [mapped] = toGenerationIngredients([
      { display_name: "flour", importance: "core", quantity_text: "1", unit: "cup", preparation_note: null },
    ]);
    assert.deepEqual(mapped, {
      displayName: "flour",
      importance: "core",
      quantityText: "1",
      unit: "cup",
      preparationNote: null,
    });
  });

  it("falls back to supporting for an unrecognized importance value", () => {
    const [mapped] = toGenerationIngredients([
      { display_name: "flour", importance: "bogus", quantity_text: null, unit: null, preparation_note: null },
    ]);
    assert.equal(mapped.importance, "supporting");
  });

  it("buildDirectRecipeContext has no planner fields", () => {
    const ctx = buildDirectRecipeContext({ id: "r1", title: "Pasta Bake", servings: 4 });
    assert.equal(ctx.mealPlanEntryId, null);
    assert.equal(ctx.plannedDate, null);
    assert.equal(ctx.mealType, null);
    assert.equal(ctx.entryServings, null);
  });

  it("buildPlannerEntryContext falls back to the recipe's servings when the entry didn't set one", () => {
    const ctx = buildPlannerEntryContext(
      { id: "entry-1", planned_date: "2026-08-04", meal_type: "dinner", servings: null },
      { id: "r1", title: "Pasta Bake", servings: 4 },
    );
    assert.equal(ctx.entryServings, 4);
    assert.equal(ctx.recipeServings, 4);
  });

  it("buildPlannerEntryContext uses the entry's own servings when set", () => {
    const ctx = buildPlannerEntryContext(
      { id: "entry-1", planned_date: "2026-08-04", meal_type: "dinner", servings: 8 },
      { id: "r1", title: "Pasta Bake", servings: 4 },
    );
    assert.equal(ctx.entryServings, 8);
  });
});

describe("buildGenerationPayload", () => {
  it("shapes an item with multiple sources into the exact RPC payload", () => {
    const raw: RawIngredientCandidate[] = [
      {
        displayName: "flour",
        unit: "cup",
        preparationNote: null,
        presence: "missing",
        rawQuantityText: "1",
        scaledQuantityText: "1",
        scalingApplied: false,
        scalingWarning: null,
        source: context({ recipeId: "r1", recipeTitle: "Pasta Bake" }),
      },
      {
        displayName: "flour",
        unit: "cup",
        preparationNote: null,
        presence: "missing",
        rawQuantityText: "0.5",
        scaledQuantityText: "0.5",
        scalingApplied: false,
        scalingWarning: null,
        source: context({
          recipeId: "r2",
          recipeTitle: "Tomato Soup",
          mealPlanEntryId: "entry-1",
          plannedDate: "2026-08-04",
          mealType: "dinner",
        }),
      },
    ];
    const [item] = groupCandidates(raw);
    const [payloadItem] = buildGenerationPayload([item]);
    assert.equal(payloadItem.display_name, "flour");
    assert.equal(payloadItem.quantity_text, "1.5");
    assert.equal(payloadItem.unit, "cup");
    assert.equal(payloadItem.sources.length, 2);
    assert.equal(payloadItem.sources[1].meal_plan_entry_id, "entry-1");
    assert.equal(payloadItem.sources[1].planned_date_snapshot, "2026-08-04");
    assert.equal(payloadItem.sources[1].meal_type_snapshot, "dinner");
    assert.equal(payloadItem.sources[1].raw_quantity_text, "0.5");
  });

  it("does not mutate the input candidates array", () => {
    const raw: RawIngredientCandidate[] = [
      {
        displayName: "flour",
        unit: "cup",
        preparationNote: null,
        presence: "missing",
        rawQuantityText: "1",
        scaledQuantityText: "1",
        scalingApplied: false,
        scalingWarning: null,
        source: context(),
      },
    ];
    const grouped = groupCandidates(raw);
    const snapshot = JSON.parse(JSON.stringify(grouped));
    buildGenerationPayload(grouped);
    assert.deepEqual(grouped, snapshot);
  });

  // Mirrors the DB-level requirement (shopping_item_sources.recipe_title_
  // snapshot is NOT NULL with a non-blank CHECK, added after the migration
  // fix): every source built from a real GenerationSourceContext always
  // carries a non-blank recipe_title_snapshot, for both direct-recipe and
  // planner-generated sources, since recipeTitle is a required (non-null)
  // field on GenerationSourceContext itself.
  it("always includes a non-blank recipe_title_snapshot on every source", () => {
    const [directItem] = groupCandidates([
      {
        displayName: "flour",
        unit: "cup",
        preparationNote: null,
        presence: "missing",
        rawQuantityText: "1",
        scaledQuantityText: "1",
        scalingApplied: false,
        scalingWarning: null,
        source: context({ recipeId: "r1", recipeTitle: "Pasta Bake", mealPlanEntryId: null }),
      },
      {
        displayName: "flour",
        unit: "cup",
        preparationNote: null,
        presence: "missing",
        rawQuantityText: "1",
        scaledQuantityText: "1",
        scalingApplied: false,
        scalingWarning: null,
        source: context({
          recipeId: "r2",
          recipeTitle: "Tomato Soup",
          mealPlanEntryId: "entry-1",
          plannedDate: "2026-08-04",
          mealType: "dinner",
        }),
      },
    ]);
    const [payloadItem] = buildGenerationPayload([directItem]);
    for (const source of payloadItem.sources) {
      assert.equal(typeof source.recipe_title_snapshot, "string");
      assert.notEqual(source.recipe_title_snapshot?.trim(), "");
    }
  });
});
