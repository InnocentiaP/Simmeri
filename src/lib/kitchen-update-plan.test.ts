import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeKitchenCandidateName,
  decideKitchenUpdateTargets,
  type ActiveKitchenItemInput,
  type PurchasedItemInput,
} from "./kitchen-update-plan.ts";

describe("normalizeKitchenCandidateName", () => {
  it("trims and lowercases", () => {
    assert.equal(normalizeKitchenCandidateName("  Baking Powder  "), "baking powder");
  });

  it("collapses repeated internal whitespace", () => {
    assert.equal(normalizeKitchenCandidateName("olive   oil"), "olive oil");
  });
});

describe("decideKitchenUpdateTargets", () => {
  it("selects update on an exact normalized-name match", () => {
    const purchased: PurchasedItemInput[] = [{ id: "p1", displayName: "flour" }];
    const kitchen: ActiveKitchenItemInput[] = [
      { id: "k1", name: "flour", status: "out_of_stock", storageLocation: "pantry" },
    ];
    const [decision] = decideKitchenUpdateTargets(purchased, kitchen);
    assert.equal(decision.action.kind, "update");
    assert.equal((decision.action as { kind: "update"; target: { id: string } }).target.id, "k1");
  });

  it("matches regardless of casing", () => {
    const purchased: PurchasedItemInput[] = [{ id: "p1", displayName: "FLOUR" }];
    const kitchen: ActiveKitchenItemInput[] = [
      { id: "k1", name: "Flour", status: "available", storageLocation: "pantry" },
    ];
    const [decision] = decideKitchenUpdateTargets(purchased, kitchen);
    assert.equal(decision.action.kind, "update");
  });

  it("matches through leading/trailing/repeated whitespace differences", () => {
    const purchased: PurchasedItemInput[] = [{ id: "p1", displayName: "  olive   oil " }];
    const kitchen: ActiveKitchenItemInput[] = [
      { id: "k1", name: "olive oil", status: "available", storageLocation: "pantry" },
    ];
    const [decision] = decideKitchenUpdateTargets(purchased, kitchen);
    assert.equal(decision.action.kind, "update");
  });

  it("selects create when no active Kitchen row matches", () => {
    const purchased: PurchasedItemInput[] = [{ id: "p1", displayName: "saffron" }];
    const kitchen: ActiveKitchenItemInput[] = [
      { id: "k1", name: "flour", status: "available", storageLocation: "pantry" },
    ];
    const [decision] = decideKitchenUpdateTargets(purchased, kitchen);
    assert.equal(decision.action.kind, "create");
  });

  it("selects create against an empty Kitchen", () => {
    const purchased: PurchasedItemInput[] = [{ id: "p1", displayName: "flour" }];
    const [decision] = decideKitchenUpdateTargets(purchased, []);
    assert.equal(decision.action.kind, "create");
  });

  it("ignores archived Kitchen rows when matching", () => {
    const purchased: PurchasedItemInput[] = [{ id: "p1", displayName: "flour" }];
    const kitchen: ActiveKitchenItemInput[] = [
      {
        id: "k1",
        name: "flour",
        status: "out_of_stock",
        storageLocation: "pantry",
        archivedAt: "2026-01-01T00:00:00.000Z",
      },
    ];
    const [decision] = decideKitchenUpdateTargets(purchased, kitchen);
    assert.equal(decision.action.kind, "create");
  });

  it("produces ambiguous rather than silently selecting one of several matches", () => {
    const purchased: PurchasedItemInput[] = [{ id: "p1", displayName: "flour" }];
    const kitchen: ActiveKitchenItemInput[] = [
      { id: "k1", name: "flour", status: "available", storageLocation: "pantry" },
      { id: "k2", name: "Flour", status: "running_low", storageLocation: "freezer" },
    ];
    const [decision] = decideKitchenUpdateTargets(purchased, kitchen);
    assert.equal(decision.action.kind, "ambiguous");
    assert.equal((decision.action as { kind: "ambiguous"; candidates: unknown[] }).candidates.length, 2);
  });

  it("keeps materially different names separate (no fuzzy matching)", () => {
    const purchased: PurchasedItemInput[] = [
      { id: "p1", displayName: "canned tomatoes" },
      { id: "p2", displayName: "tomatoes" },
    ];
    const kitchen: ActiveKitchenItemInput[] = [
      { id: "k1", name: "tomatoes", status: "available", storageLocation: "pantry" },
    ];
    const [cannedDecision, plainDecision] = decideKitchenUpdateTargets(purchased, kitchen);
    assert.equal(cannedDecision.action.kind, "create");
    assert.equal(plainDecision.action.kind, "update");
  });

  it("does not mutate the purchased-items or Kitchen-items input arrays", () => {
    const purchased: PurchasedItemInput[] = [{ id: "p1", displayName: "flour" }];
    const kitchen: ActiveKitchenItemInput[] = [
      { id: "k1", name: "flour", status: "available", storageLocation: "pantry" },
    ];
    const purchasedSnapshot = JSON.parse(JSON.stringify(purchased));
    const kitchenSnapshot = JSON.parse(JSON.stringify(kitchen));
    Object.freeze(purchased);
    Object.freeze(purchased[0]);
    Object.freeze(kitchen);
    Object.freeze(kitchen[0]);

    decideKitchenUpdateTargets(purchased, kitchen);

    assert.deepEqual(purchased, purchasedSnapshot);
    assert.deepEqual(kitchen, kitchenSnapshot);
  });
});
