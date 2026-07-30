import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  computeReadiness,
  readinessDisplay,
  buildKitchenPresenceIndex,
  classifyIngredientPresence,
  type ReadinessIngredient,
  type ReadinessKitchenItem,
} from "./readiness.ts";

// Regression suite for computeReadiness's existing label/explanation
// behavior, written as part of the Wave 2 Checkpoint 3 additive extraction
// of buildKitchenPresenceIndex/classifyIngredientPresence — proves the
// extraction did not change any observable behavior.
describe("computeReadiness (regression)", () => {
  it("labels not_ready when any core ingredient is missing", () => {
    const ingredients: ReadinessIngredient[] = [
      { display_name: "chicken", importance: "core" },
      { display_name: "salt", importance: "seasoning" },
    ];
    const kitchen: ReadinessKitchenItem[] = [
      { ingredient_name: "salt", status: "available" },
    ];
    const result = computeReadiness(ingredients, kitchen);
    assert.equal(result.label, "not_ready");
    assert.deepEqual(result.explanation.missing_core, ["chicken"]);
  });

  it("labels needs_shopping when only supporting/seasoning ingredients are missing", () => {
    const ingredients: ReadinessIngredient[] = [
      { display_name: "chicken", importance: "core" },
      { display_name: "paprika", importance: "seasoning" },
    ];
    const kitchen: ReadinessKitchenItem[] = [
      { ingredient_name: "chicken", status: "available" },
    ];
    const result = computeReadiness(ingredients, kitchen);
    assert.equal(result.label, "needs_shopping");
    assert.deepEqual(result.explanation.missing_seasoning, ["paprika"]);
  });

  it("labels check_first when an ingredient's Kitchen status is unknown", () => {
    const ingredients: ReadinessIngredient[] = [{ display_name: "flour", importance: "core" }];
    const kitchen: ReadinessKitchenItem[] = [{ ingredient_name: "flour", status: "unknown" }];
    const result = computeReadiness(ingredients, kitchen);
    assert.equal(result.label, "check_first");
    assert.deepEqual(result.explanation.needs_check, ["flour"]);
  });

  it("labels almost_ready when an ingredient is running low", () => {
    const ingredients: ReadinessIngredient[] = [{ display_name: "eggs", importance: "core" }];
    const kitchen: ReadinessKitchenItem[] = [{ ingredient_name: "eggs", status: "running_low" }];
    const result = computeReadiness(ingredients, kitchen);
    assert.equal(result.label, "almost_ready");
    assert.deepEqual(result.explanation.running_low, ["eggs"]);
  });

  it("labels ready_to_cook when everything is available", () => {
    const ingredients: ReadinessIngredient[] = [{ display_name: "eggs", importance: "core" }];
    const kitchen: ReadinessKitchenItem[] = [{ ingredient_name: "eggs", status: "available" }];
    const result = computeReadiness(ingredients, kitchen);
    assert.equal(result.label, "ready_to_cook");
    assert.equal(readinessDisplay(result.label), "Ready to cook");
  });

  it("ignores optional ingredients entirely, regardless of Kitchen state", () => {
    const ingredients: ReadinessIngredient[] = [
      { display_name: "eggs", importance: "core" },
      { display_name: "chives", importance: "optional" },
    ];
    const kitchen: ReadinessKitchenItem[] = [{ ingredient_name: "eggs", status: "available" }];
    const result = computeReadiness(ingredients, kitchen);
    assert.equal(result.label, "ready_to_cook");
    assert.deepEqual(result.explanation.ignored_optional, ["chives"]);
  });

  it("ignores archived Kitchen rows when computing readiness", () => {
    const ingredients: ReadinessIngredient[] = [{ display_name: "eggs", importance: "core" }];
    const kitchen: ReadinessKitchenItem[] = [
      { ingredient_name: "eggs", status: "available", archived_at: "2026-01-01T00:00:00.000Z" },
    ];
    const result = computeReadiness(ingredients, kitchen);
    assert.equal(result.label, "not_ready");
  });

  it("matches ingredient names case-insensitively and trims whitespace", () => {
    const ingredients: ReadinessIngredient[] = [{ display_name: "  Eggs ", importance: "core" }];
    const kitchen: ReadinessKitchenItem[] = [{ ingredient_name: "eggs", status: "available" }];
    const result = computeReadiness(ingredients, kitchen);
    assert.equal(result.label, "ready_to_cook");
  });
});

describe("buildKitchenPresenceIndex", () => {
  it("keeps the highest-priority status among duplicate normalized names", () => {
    const index = buildKitchenPresenceIndex([
      { ingredient_name: "flour", status: "available" },
      { ingredient_name: "Flour", status: "unknown" },
    ]);
    assert.equal(index.get("flour"), "unknown");
  });

  it("coerces an unrecognized status value to unknown", () => {
    const index = buildKitchenPresenceIndex([
      { ingredient_name: "flour", status: "some_future_status" },
    ]);
    assert.equal(index.get("flour"), "unknown");
  });
});

describe("classifyIngredientPresence", () => {
  it("classifies available", () => {
    const index = buildKitchenPresenceIndex([{ ingredient_name: "eggs", status: "available" }]);
    assert.equal(classifyIngredientPresence("eggs", index), "available");
  });

  it("classifies missing when no Kitchen row matches", () => {
    const index = buildKitchenPresenceIndex([]);
    assert.equal(classifyIngredientPresence("eggs", index), "missing");
  });

  it("classifies missing when the matching row is out_of_stock", () => {
    const index = buildKitchenPresenceIndex([{ ingredient_name: "eggs", status: "out_of_stock" }]);
    assert.equal(classifyIngredientPresence("eggs", index), "missing");
  });

  it("classifies needs_check for an unknown-status match, never silently as missing", () => {
    const index = buildKitchenPresenceIndex([{ ingredient_name: "eggs", status: "unknown" }]);
    assert.equal(classifyIngredientPresence("eggs", index), "needs_check");
  });

  it("classifies running_low", () => {
    const index = buildKitchenPresenceIndex([{ ingredient_name: "eggs", status: "running_low" }]);
    assert.equal(classifyIngredientPresence("eggs", index), "running_low");
  });
});
