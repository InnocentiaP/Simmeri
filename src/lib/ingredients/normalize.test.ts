import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { normalizeForCanonicalMatch } from "./normalize.ts";

describe("normalizeForCanonicalMatch", () => {
  it("lowercases", () => {
    assert.equal(normalizeForCanonicalMatch("Rice"), "rice");
  });

  it("trims leading and trailing whitespace", () => {
    assert.equal(normalizeForCanonicalMatch("  onion  "), "onion");
  });

  it("collapses repeated internal whitespace", () => {
    assert.equal(normalizeForCanonicalMatch("green   onion"), "green onion");
  });

  it("strips diacritics", () => {
    assert.equal(normalizeForCanonicalMatch("café"), "cafe");
    assert.equal(normalizeForCanonicalMatch("crème fraîche"), "creme fraiche");
    assert.equal(normalizeForCanonicalMatch("jalapeño"), "jalapeno");
  });

  it("strips trailing punctuation", () => {
    assert.equal(normalizeForCanonicalMatch("onion,"), "onion");
    assert.equal(normalizeForCanonicalMatch("onion powder!"), "onion powder");
    assert.equal(normalizeForCanonicalMatch('"garlic"'), '"garlic');
  });

  it("does not strip internal punctuation such as a hyphen", () => {
    assert.equal(normalizeForCanonicalMatch("all-purpose flour"), "all-purpose flour");
  });

  it("combines all rules together", () => {
    assert.equal(normalizeForCanonicalMatch("  CAFÉ,  "), "cafe");
  });

  it("returns an empty string for empty/whitespace-only input", () => {
    assert.equal(normalizeForCanonicalMatch(""), "");
    assert.equal(normalizeForCanonicalMatch("   "), "");
  });

  it("is idempotent — normalizing an already-normalized string is a no-op", () => {
    const once = normalizeForCanonicalMatch("Green   Onions,");
    const twice = normalizeForCanonicalMatch(once);
    assert.equal(once, twice);
  });
});
