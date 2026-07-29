import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseIngredientLine } from "./ingredient-parse.ts";

describe("parseIngredientLine", () => {
  it("parses teaspoons", () => {
    const r = parseIngredientLine("4 teaspoons baking powder");
    assert.equal(r.quantity_text, "4");
    assert.equal(r.unit, "teaspoon");
    assert.equal(r.display_name, "baking powder");
    assert.equal(r.raw_text, "4 teaspoons baking powder");
  });

  it("parses cups (with a mixed fraction quantity)", () => {
    const r = parseIngredientLine("1 3/4 cups milk");
    assert.equal(r.quantity_text, "1 3/4");
    assert.equal(r.unit, "cup");
    assert.equal(r.display_name, "milk");
  });

  it("normalizes gram aliases, including a glued quantity+unit", () => {
    const r = parseIngredientLine("500g flour");
    assert.equal(r.quantity_text, "500");
    assert.equal(r.unit, "g");
    assert.equal(r.display_name, "flour");
  });

  it("normalizes milliliter aliases", () => {
    const r = parseIngredientLine("250 milliliters water");
    assert.equal(r.quantity_text, "250");
    assert.equal(r.unit, "ml");
    assert.equal(r.display_name, "water");
  });

  it("parses mixed fractions written as two tokens", () => {
    const r = parseIngredientLine("1 1/2 cups sugar");
    assert.equal(r.quantity_text, "1 1/2");
    assert.equal(r.unit, "cup");
    assert.equal(r.display_name, "sugar");
  });

  it("parses a standalone unicode fraction", () => {
    const r = parseIngredientLine("½ cup sugar");
    assert.equal(r.quantity_text, "1/2");
    assert.equal(r.unit, "cup");
    assert.equal(r.display_name, "sugar");
  });

  it("parses a unicode fraction glued to a leading integer", () => {
    const r = parseIngredientLine("1½ cups flour");
    assert.equal(r.quantity_text, "1 1/2");
    assert.equal(r.unit, "cup");
    assert.equal(r.display_name, "flour");
  });

  it("parses a hyphen quantity range", () => {
    const r = parseIngredientLine("2-3 apples, sliced");
    assert.equal(r.quantity_text, "2-3");
    assert.equal(r.display_name, "apples");
    assert.equal(r.preparation_note, "sliced");
  });

  it("parses an en-dash quantity range, normalized to a hyphen", () => {
    const r = parseIngredientLine("2–3 tbsp olive oil");
    assert.equal(r.quantity_text, "2-3");
    assert.equal(r.unit, "tablespoon");
    assert.equal(r.display_name, "olive oil");
  });

  it("extracts a preparation note after a comma", () => {
    const r = parseIngredientLine("2 cloves garlic, minced");
    assert.equal(r.quantity_text, "2");
    assert.equal(r.unit, "clove");
    assert.equal(r.display_name, "garlic");
    assert.equal(r.preparation_note, "minced");
  });

  it("leaves quantity/unit empty for a no-quantity line", () => {
    const r = parseIngredientLine("Salt and pepper to taste");
    assert.equal(r.quantity_text, "");
    assert.equal(r.unit, "");
    assert.equal(r.display_name, "Salt and pepper to taste");
    assert.equal(r.raw_text, "Salt and pepper to taste");
  });

  it("falls back conservatively for an unrecognized unit word", () => {
    const r = parseIngredientLine("3 large eggs");
    assert.equal(r.quantity_text, "3");
    assert.equal(r.unit, "", "unrecognized unit words must not be guessed");
    assert.equal(r.display_name, "large eggs");
  });

  it("preserves raw_text exactly (outer-trimmed, not rewritten)", () => {
    const r = parseIngredientLine("  2 cups   flour  ");
    assert.equal(r.raw_text, "2 cups   flour");
  });

  it("returns an empty parse for a blank line", () => {
    const r = parseIngredientLine("   ");
    assert.equal(r.raw_text, "");
    assert.equal(r.display_name, "");
  });
});
