import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  convertAmount,
  convertTemperaturesInText,
  detectMeasurementSystem,
  formatFraction,
  parseAmount,
  parseQuantity,
} from "./convert.ts";

const amount = (quantityText: string, unit: string, gramsPerCup: number | null = null) => ({
  quantityText,
  unit,
  gramsPerCup,
});

describe("parsing", () => {
  it("reads whole numbers, decimals, fractions, and unicode fractions", () => {
    assert.equal(parseAmount("2"), 2);
    assert.equal(parseAmount("1.5"), 1.5);
    assert.equal(parseAmount("1,5"), 1.5);
    assert.equal(parseAmount("1/2"), 0.5);
    assert.equal(parseAmount("1 1/2"), 1.5);
    assert.equal(parseAmount("½"), 0.5);
    assert.equal(parseAmount("1½"), 1.5);
    assert.equal(parseAmount("a pinch"), null);
  });

  it("reads ranges", () => {
    assert.deepEqual(parseQuantity("2-3"), { low: 2, high: 3 });
    assert.deepEqual(parseQuantity("1 to 2"), { low: 1, high: 2 });
    assert.equal(parseQuantity("3-2"), null);
  });

  it("formats kitchen fractions", () => {
    assert.equal(formatFraction(1.5), "1 ½");
    assert.equal(formatFraction(0.33), "⅓");
    assert.equal(formatFraction(2.97), "3");
    assert.equal(formatFraction(0.74), "¾");
  });
});

describe("convertAmount → metric", () => {
  it("turns liquid cups into millilitres", () => {
    assert.deepEqual(convertAmount(amount("1", "cup"), "metric"), {
      quantityText: "235",
      unit: "ml",
      changed: true,
      approximate: false,
    });
  });

  it("turns dry cups into approximate grams when the ingredient's weight is known", () => {
    const r = convertAmount(amount("2", "cups", 120), "metric");
    assert.equal(r.quantityText, "240");
    assert.equal(r.unit, "g");
    assert.equal(r.approximate, true);
  });

  it("converts ounces and pounds to grams and kilograms", () => {
    assert.equal(convertAmount(amount("8", "oz"), "metric").quantityText, "225");
    const kg = convertAmount(amount("3", "lb"), "metric");
    assert.equal(kg.quantityText, "1.4");
    assert.equal(kg.unit, "kg");
  });

  it("converts ranges and reads a unit hidden in the quantity", () => {
    assert.equal(convertAmount(amount("1-2", "cups"), "metric").quantityText, "235–475");
    const hidden = convertAmount(amount("2 cups", ""), "metric");
    assert.equal(hidden.unit, "ml");
  });

  it("keeps spoons, metric amounts, counts, and vague amounts as they are", () => {
    for (const a of [
      amount("2", "tbsp"),
      amount("1", "sdm"),
      amount("200", "g"),
      amount("3", ""),
      amount("secukupnya", ""),
    ]) {
      assert.equal(convertAmount(a, "metric").changed, false);
    }
  });
});

describe("convertAmount → US", () => {
  it("turns millilitres into cups, tablespoons, or teaspoons", () => {
    assert.deepEqual(
      [
        convertAmount(amount("250", "ml"), "us"),
        convertAmount(amount("30", "ml"), "us"),
        convertAmount(amount("5", "ml"), "us"),
      ].map((r) => `${r.quantityText} ${r.unit}`),
      ["1 cup", "2 tbsp", "1 tsp"],
    );
  });

  it("turns grams of a dry ingredient into approximate cups, others into ounces", () => {
    const flour = convertAmount(amount("240", "g", 120), "us");
    assert.equal(`${flour.quantityText} ${flour.unit}`, "2 cups");
    assert.equal(flour.approximate, true);
    const chicken = convertAmount(amount("500", "g"), "us");
    assert.equal(`${chicken.quantityText} ${chicken.unit}`, "1 lb");
    assert.equal(convertAmount(amount("100", "gr"), "us").unit, "oz");
  });

  it("leaves US amounts unchanged", () => {
    assert.equal(convertAmount(amount("1", "cup"), "us").changed, false);
  });

  it("returns the original for the original system", () => {
    assert.equal(convertAmount(amount("1", "cup"), "original").changed, false);
  });
});

describe("detectMeasurementSystem", () => {
  it("classifies a recipe by its units", () => {
    assert.equal(
      detectMeasurementSystem([
        { quantityText: "2", unit: "cups" },
        { quantityText: "1", unit: "tsp" },
      ]),
      "us",
    );
    assert.equal(detectMeasurementSystem([{ quantityText: "200", unit: "g" }]), "metric");
    assert.equal(
      detectMeasurementSystem([
        { quantityText: "1", unit: "cup" },
        { quantityText: "200", unit: "g" },
      ]),
      "mixed",
    );
    assert.equal(
      detectMeasurementSystem([
        { quantityText: "2", unit: "sdm" },
        { quantityText: "3", unit: "" },
      ]),
      "none",
    );
  });
});

describe("convertTemperaturesInText", () => {
  it("converts oven temperatures and keeps the original", () => {
    assert.equal(
      convertTemperaturesInText("Bake at 350°F for 20 minutes.", "metric"),
      "Bake at 175°C (350°F) for 20 minutes.",
    );
    assert.equal(
      convertTemperaturesInText("Panggang 180°C selama 20 menit", "us"),
      "Panggang 355°F (180°C) selama 20 menit",
    );
    assert.equal(
      convertTemperaturesInText("Preheat to 400 degrees F.", "metric"),
      "Preheat to 205°C (400 degrees F).",
    );
  });

  it("leaves text in the target system or without temperatures alone", () => {
    assert.equal(convertTemperaturesInText("Bake at 180°C", "metric"), "Bake at 180°C");
    assert.equal(convertTemperaturesInText("Add 2 cups of rice", "metric"), "Add 2 cups of rice");
    assert.equal(convertTemperaturesInText("Bake at 350°F", "original"), "Bake at 350°F");
  });
});
