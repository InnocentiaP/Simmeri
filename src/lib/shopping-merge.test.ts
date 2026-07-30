import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeIngredientName,
  canonicalUnit,
  isUnitMergeEligible,
  computeMergeKey,
  parseQuantityValue,
  formatQuantityValue,
  combineQuantityTexts,
} from "./shopping-merge.ts";

describe("normalizeIngredientName", () => {
  it("trims and lowercases", () => {
    assert.equal(normalizeIngredientName("  Baking Powder  "), "baking powder");
  });

  it("collapses repeated internal whitespace", () => {
    assert.equal(normalizeIngredientName("olive   oil"), "olive oil");
  });

  it("keeps materially different names separate", () => {
    assert.notEqual(normalizeIngredientName("tomatoes"), normalizeIngredientName("canned tomatoes"));
    assert.notEqual(normalizeIngredientName("milk"), normalizeIngredientName("coconut milk"));
  });
});

describe("canonicalUnit — every required alias family", () => {
  const cases: Array<[string[], string]> = [
    [["tsp", "teaspoon", "teaspoons"], "teaspoon"],
    [["tbsp", "tablespoon", "tablespoons"], "tablespoon"],
    [["cup", "cups"], "cup"],
    [["g", "gram", "grams"], "g"],
    [["kg", "kilogram", "kilograms"], "kg"],
    [["ml", "milliliter", "milliliters"], "ml"],
    [["l", "liter", "liters"], "l"],
    [["oz", "ounce", "ounces"], "oz"],
    [["lb", "pound", "pounds"], "lb"],
    [["clove", "cloves"], "clove"],
    [["can", "cans"], "can"],
    [["piece", "pieces"], "piece"],
  ];

  for (const [aliases, canonical] of cases) {
    it(`maps ${aliases.join("/")} to "${canonical}"`, () => {
      for (const alias of aliases) {
        assert.equal(canonicalUnit(alias), canonical);
        assert.equal(canonicalUnit(alias.toUpperCase()), canonical);
      }
    });
  }

  it("returns null for no unit", () => {
    assert.equal(canonicalUnit(null), null);
    assert.equal(canonicalUnit(undefined), null);
    assert.equal(canonicalUnit(""), null);
  });

  it("does not cross-convert g and kg", () => {
    assert.notEqual(canonicalUnit("g"), canonicalUnit("kg"));
  });

  it("does not cross-convert cup and ml", () => {
    assert.notEqual(canonicalUnit("cup"), canonicalUnit("ml"));
  });

  it("does not cross-convert piece and g", () => {
    assert.notEqual(canonicalUnit("piece"), canonicalUnit("g"));
  });

  it("returns null for any unrecognized unit, regardless of the literal text", () => {
    assert.equal(canonicalUnit("sprig"), null);
    assert.equal(canonicalUnit("dash"), null);
    assert.equal(canonicalUnit("scoop"), null);
  });
});

describe("isUnitMergeEligible", () => {
  it("is eligible when there is no unit at all", () => {
    assert.equal(isUnitMergeEligible(null), true);
    assert.equal(isUnitMergeEligible(undefined), true);
    assert.equal(isUnitMergeEligible(""), true);
    assert.equal(isUnitMergeEligible("   "), true);
  });

  it("is eligible for every recognized alias", () => {
    assert.equal(isUnitMergeEligible("tsp"), true);
    assert.equal(isUnitMergeEligible("g"), true);
    assert.equal(isUnitMergeEligible("piece"), true);
  });

  it("is never eligible for an unrecognized, non-empty unit", () => {
    assert.equal(isUnitMergeEligible("scoop"), false);
    assert.equal(isUnitMergeEligible("packet"), false);
    assert.equal(isUnitMergeEligible("sprig"), false);
  });

  it("is case-insensitive when checking recognized aliases", () => {
    assert.equal(isUnitMergeEligible("TSP"), true);
  });
});

describe("computeMergeKey", () => {
  it("combines normalized name and canonical unit", () => {
    assert.equal(computeMergeKey("Baking Powder", "tsp"), computeMergeKey("baking powder", "teaspoon"));
  });

  it("differs when units are incompatible", () => {
    assert.notEqual(computeMergeKey("flour", "g"), computeMergeKey("flour", "kg"));
  });

  it("differs when names are materially different", () => {
    assert.notEqual(computeMergeKey("tomatoes", "piece"), computeMergeKey("canned tomatoes", "piece"));
  });
});

describe("parseQuantityValue", () => {
  it("parses a plain integer", () => {
    assert.equal(parseQuantityValue("4"), 4);
  });

  it("parses a safe decimal", () => {
    assert.equal(parseQuantityValue("1.5"), 1.5);
  });

  it("parses a simple fraction", () => {
    assert.equal(parseQuantityValue("3/4"), 0.75);
  });

  it("parses a mixed number", () => {
    assert.equal(parseQuantityValue("1 3/4"), 1.75);
  });

  it("returns null for a range", () => {
    assert.equal(parseQuantityValue("2-3"), null);
    assert.equal(parseQuantityValue("2.5–3"), null);
  });

  it('returns null for "to taste"', () => {
    assert.equal(parseQuantityValue("to taste"), null);
  });

  it('returns null for "as needed"', () => {
    assert.equal(parseQuantityValue("as needed"), null);
  });

  it('returns null for "a handful"', () => {
    assert.equal(parseQuantityValue("a handful"), null);
  });

  it("returns null for empty/null/undefined", () => {
    assert.equal(parseQuantityValue(""), null);
    assert.equal(parseQuantityValue(null), null);
    assert.equal(parseQuantityValue(undefined), null);
  });

  it("returns null for unrecognized text", () => {
    assert.equal(parseQuantityValue("some"), null);
  });
});

describe("formatQuantityValue", () => {
  it("formats whole numbers without a decimal point", () => {
    assert.equal(formatQuantityValue(3), "3");
  });

  it("trims trailing zeros from decimals", () => {
    assert.equal(formatQuantityValue(1.5), "1.5");
    assert.equal(formatQuantityValue(1.25), "1.25");
  });
});

describe("combineQuantityTexts", () => {
  it("combines 1 teaspoon + 2 tsp into 3 (as values; unit combined separately by the caller)", () => {
    const result = combineQuantityTexts(["1", "2"]);
    assert.deepEqual(result, { combinable: true, combinedValue: 3, combinedText: "3" });
  });

  it("adds integers and safe decimals", () => {
    const result = combineQuantityTexts(["1", "1.5"]);
    assert.equal(result.combinable, true);
    if (result.combinable) assert.equal(result.combinedText, "2.5");
  });

  it("adds safe fractions", () => {
    const result = combineQuantityTexts(["1/2", "1/4"]);
    assert.equal(result.combinable, true);
    if (result.combinable) assert.equal(result.combinedText, "0.75");
  });

  it("does not combine when any quantity is a range", () => {
    const result = combineQuantityTexts(["1", "2-3"]);
    assert.equal(result.combinable, false);
  });

  it('does not combine when any quantity is "to taste"', () => {
    const result = combineQuantityTexts(["1", "to taste"]);
    assert.equal(result.combinable, false);
  });

  it('does not combine when any quantity is "as needed"', () => {
    const result = combineQuantityTexts(["1", "as needed"]);
    assert.equal(result.combinable, false);
  });

  it("does not combine when any quantity is unparseable text", () => {
    const result = combineQuantityTexts(["1", "a pinch of something"]);
    assert.equal(result.combinable, false);
  });

  it("does not mutate the input array", () => {
    const texts = ["1", "2"];
    const snapshot = [...texts];
    Object.freeze(texts);
    combineQuantityTexts(texts);
    assert.deepEqual(texts, snapshot);
  });
});
