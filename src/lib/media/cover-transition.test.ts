import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  decidePromoteToCoverCleanup,
  decideCookingPhotoDeletion,
  type CoverState,
} from "./cover-transition.ts";

const noCover: CoverState = { bucket: null, path: null, source: null, cookingPhotoId: null };

describe("decidePromoteToCoverCleanup (cover-source transition decision logic)", () => {
  it("marks the old direct-upload cover as cleanup-eligible when switching to a cooking photo", () => {
    const current: CoverState = {
      bucket: "recipe-media",
      path: "u1/recipes/r1/cover/old.jpg",
      source: "direct_upload",
      cookingPhotoId: null,
    };
    const result = decidePromoteToCoverCleanup(current, {
      id: "photo-a",
      bucket: "recipe-media",
      path: "u1/cooking-history/h1/photo-a.jpg",
    });
    assert.deepEqual(result.cleanupEligible, {
      bucket: "recipe-media",
      path: "u1/recipes/r1/cover/old.jpg",
    });
  });

  it("identifies only the old direct-upload object, never the new cooking photo's object", () => {
    const current: CoverState = {
      bucket: "recipe-media",
      path: "u1/recipes/r1/cover/old.jpg",
      source: "direct_upload",
      cookingPhotoId: null,
    };
    const result = decidePromoteToCoverCleanup(current, {
      id: "photo-a",
      bucket: "recipe-media",
      path: "u1/cooking-history/h1/photo-a.jpg",
    });
    assert.notEqual(result.cleanupEligible?.path, "u1/cooking-history/h1/photo-a.jpg");
  });

  it("does not delete either object when switching between two cooking-photo covers", () => {
    const current: CoverState = {
      bucket: "recipe-media",
      path: "u1/cooking-history/h1/photo-a.jpg",
      source: "cooking_photo",
      cookingPhotoId: "photo-a",
    };
    const result = decidePromoteToCoverCleanup(current, {
      id: "photo-b",
      bucket: "recipe-media",
      path: "u1/cooking-history/h1/photo-b.jpg",
    });
    assert.equal(result.cleanupEligible, null);
  });

  it("does nothing when re-promoting the same cooking photo that is already the cover", () => {
    const current: CoverState = {
      bucket: "recipe-media",
      path: "u1/cooking-history/h1/photo-a.jpg",
      source: "cooking_photo",
      cookingPhotoId: "photo-a",
    };
    const result = decidePromoteToCoverCleanup(current, {
      id: "photo-a",
      bucket: "recipe-media",
      path: "u1/cooking-history/h1/photo-a.jpg",
    });
    assert.equal(result.cleanupEligible, null);
  });

  it("has nothing to clean up when there was no cover at all", () => {
    const result = decidePromoteToCoverCleanup(noCover, {
      id: "photo-a",
      bucket: "recipe-media",
      path: "u1/cooking-history/h1/photo-a.jpg",
    });
    assert.equal(result.cleanupEligible, null);
  });
});

describe("decideCookingPhotoDeletion", () => {
  it("does not clear the recipe cover when deleting a non-cover photo", () => {
    const current: CoverState = {
      bucket: "recipe-media",
      path: "u1/cooking-history/h1/photo-a.jpg",
      source: "cooking_photo",
      cookingPhotoId: "photo-a",
    };
    const decision = decideCookingPhotoDeletion(current, "photo-b");
    assert.equal(decision.isActiveCover, false);
    assert.equal(decision.shouldClearRecipeCover, false);
  });

  it("requires clearing the recipe cover when deleting the active cover photo", () => {
    const current: CoverState = {
      bucket: "recipe-media",
      path: "u1/cooking-history/h1/photo-a.jpg",
      source: "cooking_photo",
      cookingPhotoId: "photo-a",
    };
    const decision = decideCookingPhotoDeletion(current, "photo-a");
    assert.equal(decision.isActiveCover, true);
    assert.equal(decision.shouldClearRecipeCover, true);
  });

  it("does not clear the cover when the recipe has no cover at all", () => {
    const decision = decideCookingPhotoDeletion(noCover, "photo-a");
    assert.equal(decision.shouldClearRecipeCover, false);
  });
});
