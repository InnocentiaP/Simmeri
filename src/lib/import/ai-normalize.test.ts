import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { normalizeAiDraftToFormValues } from "./ai-normalize.ts";
import type { AiRecipeDraft } from "./ai-draft-schema.ts";

function makeDraft(overrides: Partial<AiRecipeDraft> = {}): AiRecipeDraft {
  return {
    title: "  Pancakes  ",
    description: null,
    servings: 4,
    prep_time_minutes: 10,
    cook_time_minutes: 15,
    personal_notes: null,
    ingredients: [
      {
        raw_text: "2 cups flour",
        display_name: "  flour  ",
        quantity_text: "2",
        unit: "cup",
        preparation_note: null,
        importance: "core",
        position: 0,
      },
      {
        raw_text: "1 egg",
        display_name: "egg",
        quantity_text: "1",
        unit: null,
        preparation_note: null,
        importance: null,
        position: 1,
      },
    ],
    steps: [
      { instruction: "Mix.", position: 0 },
      { instruction: "Cook.", position: 1 },
    ],
    ...overrides,
  };
}

describe("normalizeAiDraftToFormValues", () => {
  it("sorts ingredients and steps by position and drops the position field", () => {
    const draft = makeDraft({
      ingredients: [
        { raw_text: null, display_name: "second", quantity_text: null, unit: null, preparation_note: null, importance: null, position: 1 },
        { raw_text: null, display_name: "first", quantity_text: null, unit: null, preparation_note: null, importance: null, position: 0 },
      ],
      steps: [
        { instruction: "second step", position: 1 },
        { instruction: "first step", position: 0 },
      ],
    });
    const result = normalizeAiDraftToFormValues(draft);
    assert.equal(result.ingredients[0].display_name, "first");
    assert.equal(result.ingredients[1].display_name, "second");
    assert.equal(result.steps[0].instruction, "first step");
    assert.equal(result.steps[1].instruction, "second step");
    assert.equal("position" in result.ingredients[0], false);
    assert.equal("position" in result.steps[0], false);
  });

  it("maps every null field to an empty string", () => {
    const result = normalizeAiDraftToFormValues(makeDraft());
    assert.equal(result.description, "");
    assert.equal(result.notes, "");
    assert.equal(result.ingredients[1].unit, "");
    assert.equal(result.ingredients[1].preparation_note, "");
  });

  it("defaults a null importance to core", () => {
    const result = normalizeAiDraftToFormValues(makeDraft());
    assert.equal(result.ingredients[1].importance, "core");
  });

  it("preserves a non-null importance", () => {
    const draft = makeDraft({
      ingredients: [
        { raw_text: null, display_name: "salt", quantity_text: null, unit: null, preparation_note: null, importance: "seasoning", position: 0 },
      ],
    });
    const result = normalizeAiDraftToFormValues(draft);
    assert.equal(result.ingredients[0].importance, "seasoning");
  });

  it("maps personal_notes to notes", () => {
    const draft = makeDraft({ personal_notes: "Great with syrup" });
    const result = normalizeAiDraftToFormValues(draft);
    assert.equal(result.notes, "Great with syrup");
  });

  it("trims whitespace defensively on every string field", () => {
    const result = normalizeAiDraftToFormValues(makeDraft());
    assert.equal(result.title, "Pancakes");
    assert.equal(result.ingredients[0].display_name, "flour");
  });

  it("preserves numeric fields (including null) unchanged", () => {
    const result = normalizeAiDraftToFormValues(makeDraft({ servings: null }));
    assert.equal(result.servings, null);
    assert.equal(result.prep_time_minutes, 10);
  });

  it("does not mutate the input draft", () => {
    const draft = makeDraft();
    const snapshotIngredients = JSON.stringify(draft.ingredients);
    const snapshotSteps = JSON.stringify(draft.steps);
    normalizeAiDraftToFormValues(draft);
    assert.equal(JSON.stringify(draft.ingredients), snapshotIngredients);
    assert.equal(JSON.stringify(draft.steps), snapshotSteps);
  });
});
