import { describe, it } from "node:test";
import assert from "node:assert/strict";
// Tested against path-utils.ts directly (not storage.ts) since storage.ts
// imports the Supabase client via the "@/" path alias, which plain `node
// --test` can't resolve — path-utils.ts is a dependency-free leaf module
// re-exported by storage.ts, so this exercises the exact same functions
// every real caller (via `@/lib/media/storage`) actually uses.
import { extensionForMimeType, buildRecipeCoverPath, buildCookingPhotoPath } from "./path-utils.ts";

describe("extensionForMimeType", () => {
  it("maps every accepted MIME type to its expected extension", () => {
    assert.equal(extensionForMimeType("image/jpeg"), "jpg");
    assert.equal(extensionForMimeType("image/png"), "png");
    assert.equal(extensionForMimeType("image/webp"), "webp");
  });

  it("falls back to jpg for an unrecognized MIME type", () => {
    assert.equal(extensionForMimeType("image/gif"), "jpg");
  });
});

describe("buildRecipeCoverPath", () => {
  it("produces the exact required path structure", () => {
    const path = buildRecipeCoverPath("user-123", "recipe-456", "uuid-789", "image/jpeg");
    assert.equal(path, "user-123/recipes/recipe-456/cover/uuid-789.jpg");
  });

  it("begins with the authenticated user id as the first path segment", () => {
    const path = buildRecipeCoverPath("user-abc", "recipe-def", "uuid-ghi", "image/png");
    assert.equal(path.split("/")[0], "user-abc");
  });

  it("is deterministic for the same inputs", () => {
    const a = buildRecipeCoverPath("u1", "r1", "uuid-1", "image/webp");
    const b = buildRecipeCoverPath("u1", "r1", "uuid-1", "image/webp");
    assert.equal(a, b);
  });

  it("varies the extension with the given MIME type", () => {
    const jpeg = buildRecipeCoverPath("u1", "r1", "uuid-1", "image/jpeg");
    const webp = buildRecipeCoverPath("u1", "r1", "uuid-1", "image/webp");
    assert.ok(jpeg.endsWith(".jpg"));
    assert.ok(webp.endsWith(".webp"));
  });
});

describe("buildCookingPhotoPath", () => {
  it("produces the exact required cooking-photo path structure", () => {
    const path = buildCookingPhotoPath("user-123", "history-456", "uuid-789", "image/webp");
    assert.equal(path, "user-123/cooking-history/history-456/uuid-789.webp");
  });

  it("begins with the authenticated user id as the first path segment", () => {
    const path = buildCookingPhotoPath("user-abc", "history-def", "uuid-ghi", "image/png");
    assert.equal(path.split("/")[0], "user-abc");
  });

  it("uses the same owner-first-segment shape as buildRecipeCoverPath, just a different prefix", () => {
    const cover = buildRecipeCoverPath("u1", "r1", "uuid-1", "image/jpeg");
    const cookingPhoto = buildCookingPhotoPath("u1", "h1", "uuid-1", "image/jpeg");
    assert.equal(cover.split("/")[0], cookingPhoto.split("/")[0]);
  });
});
