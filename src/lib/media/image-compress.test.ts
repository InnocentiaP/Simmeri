import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  computeResizedDimensions,
  isAcceptedMimeType,
  isWithinRawSizeLimit,
  MAX_RAW_BYTES,
} from "./image-compress.ts";

describe("computeResizedDimensions", () => {
  it("reduces a landscape image whose width exceeds the cap", () => {
    const r = computeResizedDimensions({ width: 4000, height: 2000 }, 2000);
    assert.equal(r.width, 2000);
    assert.equal(r.height, 1000);
  });

  it("reduces a portrait image whose height exceeds the cap", () => {
    const r = computeResizedDimensions({ width: 1500, height: 3000 }, 2000);
    assert.equal(r.height, 2000);
    assert.equal(r.width, 1000);
  });

  it("leaves an image already within the limit untouched (no upscaling)", () => {
    const r = computeResizedDimensions({ width: 800, height: 600 }, 2000);
    assert.equal(r.width, 800);
    assert.equal(r.height, 600);
  });

  it("preserves aspect ratio after reduction", () => {
    const r = computeResizedDimensions({ width: 3000, height: 1500 }, 2000);
    const originalRatio = 3000 / 1500;
    const resultRatio = r.width / r.height;
    assert.ok(Math.abs(originalRatio - resultRatio) < 0.01);
  });

  it("treats an exactly-at-the-cap image as already within limit", () => {
    const r = computeResizedDimensions({ width: 2000, height: 1000 }, 2000);
    assert.equal(r.width, 2000);
    assert.equal(r.height, 1000);
  });
});

describe("isAcceptedMimeType", () => {
  it("accepts jpeg, png, and webp", () => {
    assert.equal(isAcceptedMimeType("image/jpeg"), true);
    assert.equal(isAcceptedMimeType("image/png"), true);
    assert.equal(isAcceptedMimeType("image/webp"), true);
  });

  it("rejects an unsupported MIME type", () => {
    assert.equal(isAcceptedMimeType("image/gif"), false);
    assert.equal(isAcceptedMimeType("application/pdf"), false);
  });
});

describe("isWithinRawSizeLimit", () => {
  it("accepts a file at or under the 8MB limit", () => {
    assert.equal(isWithinRawSizeLimit(MAX_RAW_BYTES), true);
    assert.equal(isWithinRawSizeLimit(1024), true);
  });

  it("rejects a file over the 8MB limit", () => {
    assert.equal(isWithinRawSizeLimit(MAX_RAW_BYTES + 1), false);
  });
});
