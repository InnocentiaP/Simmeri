import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { normalizeAiDraftToFormValues, buildAiEditRequestPayload } from "./ai-normalize.ts";
import type { AiRecipeDraft } from "./ai-draft-schema.ts";
import type { NormalizedRecipeDraft } from "./ai-normalize.ts";

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

function makeFormValues(overrides: Partial<NormalizedRecipeDraft> = {}): NormalizedRecipeDraft {
  return {
    title: "  Fried Rice  ",
    description: "",
    servings: 2,
    prep_time_minutes: 10,
    cook_time_minutes: 15,
    notes: "",
    ingredients: [
      {
        display_name: "cooked rice",
        raw_text: "2 cups cooked rice",
        quantity_text: "2",
        unit: "cup",
        preparation_note: "",
        importance: "core",
      },
      {
        display_name: "egg",
        raw_text: "1 egg",
        quantity_text: "1",
        unit: "",
        preparation_note: "beaten",
        importance: "supporting",
      },
    ],
    steps: [{ instruction: "Mix everything together." }, { instruction: "Cook until done." }],
    ...overrides,
  };
}

describe("buildAiEditRequestPayload", () => {
  it("serializes the current recipe with explicit 0-based positions", () => {
    const payload = buildAiEditRequestPayload(makeFormValues());
    assert.equal(payload.ingredients[0].position, 0);
    assert.equal(payload.ingredients[1].position, 1);
    assert.equal(payload.steps[0].position, 0);
    assert.equal(payload.steps[1].position, 1);
  });

  it("maps empty strings to null for optional fields", () => {
    const payload = buildAiEditRequestPayload(makeFormValues());
    assert.equal(payload.description, null);
    assert.equal(payload.personal_notes, null);
    assert.equal(payload.ingredients[1].unit, null);
    assert.equal(payload.ingredients[0].preparation_note, null);
  });

  it("trims the title and every ingredient/step field", () => {
    const payload = buildAiEditRequestPayload(makeFormValues());
    assert.equal(payload.title, "Fried Rice");
  });

  it("drops blank ingredient/step rows and reassigns position over the filtered list", () => {
    const values = makeFormValues({
      ingredients: [
        { display_name: "", raw_text: "", quantity_text: "", unit: "", preparation_note: "", importance: "core" },
        { display_name: "salt", raw_text: "", quantity_text: "", unit: "", preparation_note: "", importance: "seasoning" },
      ],
      steps: [{ instruction: "  " }, { instruction: "Season to taste." }],
    });
    const payload = buildAiEditRequestPayload(values);
    assert.equal(payload.ingredients.length, 1);
    assert.equal(payload.ingredients[0].display_name, "salt");
    assert.equal(payload.ingredients[0].position, 0);
    assert.equal(payload.steps.length, 1);
    assert.equal(payload.steps[0].instruction, "Season to taste.");
    assert.equal(payload.steps[0].position, 0);
  });

  it("preserves numeric fields including null", () => {
    const payload = buildAiEditRequestPayload(makeFormValues({ servings: null }));
    assert.equal(payload.servings, null);
    assert.equal(payload.prep_time_minutes, 10);
  });

  it("does not mutate the input", () => {
    const values = makeFormValues();
    const snapshot = JSON.stringify(values);
    buildAiEditRequestPayload(values);
    assert.equal(JSON.stringify(values), snapshot);
  });

  it("round-trips through normalizeAiDraftToFormValues without losing ingredients/steps", () => {
    const values = makeFormValues();
    const payload = buildAiEditRequestPayload(values);
    // The payload is exactly what a well-behaved Gemini response would echo
    // back unchanged — normalizing it again should reproduce the same
    // ingredient/step content (modulo the trim/null-vs-"" normalization
    // both functions already apply consistently).
    const roundTripped = normalizeAiDraftToFormValues({
      title: payload.title,
      description: payload.description,
      servings: payload.servings,
      prep_time_minutes: payload.prep_time_minutes,
      cook_time_minutes: payload.cook_time_minutes,
      personal_notes: payload.personal_notes,
      ingredients: payload.ingredients,
      steps: payload.steps,
    });
    assert.equal(roundTripped.ingredients.length, values.ingredients.length);
    assert.equal(roundTripped.ingredients[0].display_name, "cooked rice");
    assert.equal(roundTripped.steps.length, values.steps.length);
  });
});
