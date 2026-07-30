import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { aiRecipeDraftSchema, parseAiRecipeDraft, MAX_AI_INGREDIENTS } from "./ai-draft-schema.ts";

const validDraft = {
  title: "Simple Pancakes",
  description: null,
  servings: 4,
  prep_time_minutes: 10,
  cook_time_minutes: 15,
  personal_notes: null,
  ingredients: [
    {
      raw_text: "2 cups flour",
      display_name: "flour",
      quantity_text: "2",
      unit: "cup",
      preparation_note: null,
      importance: "core",
      position: 0,
    },
  ],
  steps: [{ instruction: "Mix and cook.", position: 0 }],
};

describe("aiRecipeDraftSchema", () => {
  it("accepts a fully valid draft", () => {
    const result = aiRecipeDraftSchema.safeParse(validDraft);
    assert.equal(result.success, true);
  });

  it("accepts null for every nullable field", () => {
    const result = aiRecipeDraftSchema.safeParse({
      ...validDraft,
      description: null,
      servings: null,
      prep_time_minutes: null,
      cook_time_minutes: null,
      personal_notes: null,
      ingredients: [{ ...validDraft.ingredients[0], quantity_text: null, unit: null, preparation_note: null, importance: null, raw_text: null }],
    });
    assert.equal(result.success, true);
  });

  it("rejects a missing title", () => {
    const { title: _title, ...rest } = validDraft;
    const result = aiRecipeDraftSchema.safeParse(rest);
    assert.equal(result.success, false);
  });

  it("rejects an empty ingredients array", () => {
    const result = aiRecipeDraftSchema.safeParse({ ...validDraft, ingredients: [] });
    assert.equal(result.success, false);
  });

  it("rejects an empty steps array", () => {
    const result = aiRecipeDraftSchema.safeParse({ ...validDraft, steps: [] });
    assert.equal(result.success, false);
  });

  it("rejects more than MAX_AI_INGREDIENTS ingredients", () => {
    const tooMany = Array.from({ length: MAX_AI_INGREDIENTS + 1 }, (_, i) => ({
      ...validDraft.ingredients[0],
      position: i,
    }));
    const result = aiRecipeDraftSchema.safeParse({ ...validDraft, ingredients: tooMany });
    assert.equal(result.success, false);
  });

  it("rejects an invalid importance value", () => {
    const result = aiRecipeDraftSchema.safeParse({
      ...validDraft,
      ingredients: [{ ...validDraft.ingredients[0], importance: "garnish" }],
    });
    assert.equal(result.success, false);
  });

  it("rejects an out-of-range servings value", () => {
    const result = aiRecipeDraftSchema.safeParse({ ...validDraft, servings: 0 });
    assert.equal(result.success, false);
  });

  it("rejects a title over the max length", () => {
    const result = aiRecipeDraftSchema.safeParse({ ...validDraft, title: "x".repeat(201) });
    assert.equal(result.success, false);
  });
});

describe("parseAiRecipeDraft", () => {
  it("returns ok:true for valid JSON matching the schema", () => {
    const result = parseAiRecipeDraft(JSON.stringify(validDraft));
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.draft.title, "Simple Pancakes");
    }
  });

  it("returns invalid_json for unparseable text", () => {
    const result = parseAiRecipeDraft("not json at all {{{");
    assert.deepEqual(result, { ok: false, reason: "invalid_json" });
  });

  it("returns schema_validation_failed for well-formed JSON that doesn't match the schema", () => {
    const result = parseAiRecipeDraft(JSON.stringify({ foo: "bar" }));
    assert.deepEqual(result, { ok: false, reason: "schema_validation_failed" });
  });

  it("rejects markdown-fenced JSON as invalid_json (no fence-stripping is performed)", () => {
    const result = parseAiRecipeDraft("```json\n" + JSON.stringify(validDraft) + "\n```");
    assert.equal(result.ok, false);
  });
});
