import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildPostCookRows,
  planPostCookUpdates,
  type PostCookIngredientInput,
  type PostCookSelection,
} from "./post-cook-kitchen.ts";
import type { ActiveKitchenItemInput } from "./kitchen-update-plan.ts";

const kitchen = (
  id: string,
  name: string,
  status = "available",
  archivedAt: string | null = null,
): ActiveKitchenItemInput => ({ id, name, status, storageLocation: "pantry", archivedAt });

const ing = (
  id: string,
  displayName: string,
  importance: PostCookIngredientInput["importance"] = "core",
): PostCookIngredientInput => ({ id, displayName, importance });

describe("buildPostCookRows", () => {
  it("returns a row only for ingredients that exist in Kitchen", () => {
    const rows = buildPostCookRows(
      [ing("i1", "Rice"), ing("i2", "Saffron", "seasoning")],
      [kitchen("k1", "rice")],
    );
    assert.equal(rows.length, 1);
    assert.equal(rows[0].displayName, "Rice");
    assert.deepEqual(
      rows[0].candidates.map((c) => c.id),
      ["k1"],
    );
  });

  it("returns no rows for an empty Kitchen", () => {
    assert.deepEqual(buildPostCookRows([ing("i1", "Rice")], []), []);
  });

  it("ignores archived and already out-of-stock Kitchen items", () => {
    const rows = buildPostCookRows(
      [ing("i1", "Rice"), ing("i2", "Eggs")],
      [
        kitchen("k1", "rice", "available", "2026-01-01T00:00:00Z"),
        kitchen("k2", "eggs", "out_of_stock"),
      ],
    );
    assert.deepEqual(rows, []);
  });

  it("deduplicates repeated ingredient names, keeping the first label and the strongest importance", () => {
    const rows = buildPostCookRows(
      [ing("i1", "Salt", "seasoning"), ing("i2", "salt ", "core")],
      [kitchen("k1", "salt")],
    );
    assert.equal(rows.length, 1);
    assert.equal(rows[0].key, "i1");
    assert.equal(rows[0].displayName, "Salt");
    assert.equal(rows[0].importance, "core");
  });

  it("keeps every candidate when several Kitchen items share the name", () => {
    const rows = buildPostCookRows(
      [ing("i1", "Milk")],
      [kitchen("k1", "milk"), kitchen("k2", "Milk")],
    );
    assert.equal(rows[0].candidates.length, 2);
  });

  it("sorts rows core → supporting → seasoning → optional", () => {
    const rows = buildPostCookRows(
      [
        ing("i1", "Parsley", "optional"),
        ing("i2", "Pepper", "seasoning"),
        ing("i3", "Onion", "supporting"),
        ing("i4", "Chicken", "core"),
      ],
      [
        kitchen("k1", "parsley"),
        kitchen("k2", "pepper"),
        kitchen("k3", "onion"),
        kitchen("k4", "chicken"),
      ],
    );
    assert.deepEqual(
      rows.map((r) => r.displayName),
      ["Chicken", "Onion", "Pepper", "Parsley"],
    );
  });
});

describe("planPostCookUpdates", () => {
  const rows = buildPostCookRows(
    [ing("i1", "Rice"), ing("i2", "Milk"), ing("i3", "Butter")],
    [
      kitchen("k1", "rice"),
      kitchen("k2", "milk"),
      kitchen("k3", "milk"),
      kitchen("k4", "butter", "running_low"),
    ],
  );

  it("produces nothing when every row is left on keep (the default)", () => {
    assert.deepEqual(planPostCookUpdates(rows, new Map()), []);
    const allKeep = new Map<string, PostCookSelection>(
      rows.map((r) => [r.key, { choice: "keep" }]),
    );
    assert.deepEqual(planPostCookUpdates(rows, allKeep), []);
  });

  it("updates the single matching Kitchen item", () => {
    const updates = planPostCookUpdates(rows, new Map([["i1", { choice: "running_low" }]]));
    assert.deepEqual(updates, [{ kitchenItemId: "k1", status: "running_low" }]);
  });

  it("never guesses an ambiguous target", () => {
    assert.deepEqual(planPostCookUpdates(rows, new Map([["i2", { choice: "out_of_stock" }]])), []);
    const picked = planPostCookUpdates(
      rows,
      new Map([["i2", { choice: "out_of_stock", targetId: "k3" }]]),
    );
    assert.deepEqual(picked, [{ kitchenItemId: "k3", status: "out_of_stock" }]);
  });

  it("ignores a target id that is not one of the row's candidates", () => {
    assert.deepEqual(
      planPostCookUpdates(rows, new Map([["i2", { choice: "out_of_stock", targetId: "k1" }]])),
      [],
    );
  });

  it("skips no-op changes where the status is already equal", () => {
    assert.deepEqual(planPostCookUpdates(rows, new Map([["i3", { choice: "running_low" }]])), []);
  });

  it("collapses two rows targeting the same item to the most severe status", () => {
    const shared = buildPostCookRows(
      [ing("i1", "Garlic"), ing("i2", "Garlic cloves")],
      [kitchen("k1", "garlic"), kitchen("k2", "garlic cloves")],
    );
    // Point both rows at the same Kitchen item (k1).
    const sameItemRows = [
      { ...shared[0], candidates: [shared[0].candidates[0]] },
      { ...shared[1], candidates: [shared[0].candidates[0]] },
    ];
    const updates = planPostCookUpdates(
      sameItemRows,
      new Map<string, PostCookSelection>([
        ["i1", { choice: "out_of_stock" }],
        ["i2", { choice: "running_low" }],
      ]),
    );
    assert.deepEqual(updates, [{ kitchenItemId: "k1", status: "out_of_stock" }]);
  });
});
