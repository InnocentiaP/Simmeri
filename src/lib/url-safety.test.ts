import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isSafeHttpUrl, safeHostname, shouldShowSourceLink } from "./url-safety.ts";

describe("shouldShowSourceLink", () => {
  it("is true for a real https source URL", () => {
    assert.equal(shouldShowSourceLink("https://example.com/recipe"), true);
  });

  it("is false when source_url is null", () => {
    assert.equal(shouldShowSourceLink(null), false);
  });

  it("is false when source_url is undefined", () => {
    assert.equal(shouldShowSourceLink(undefined), false);
  });

  it("is false when source_url is an empty string", () => {
    assert.equal(shouldShowSourceLink(""), false);
  });

  it("is false for a non-http(s) protocol", () => {
    assert.equal(shouldShowSourceLink("javascript:alert(1)"), false);
  });
});

describe("isSafeHttpUrl / safeHostname", () => {
  it("accepts http and https", () => {
    assert.equal(isSafeHttpUrl("http://example.com"), true);
    assert.equal(isSafeHttpUrl("https://example.com"), true);
  });

  it("rejects other protocols and unparseable input", () => {
    assert.equal(isSafeHttpUrl("ftp://example.com"), false);
    assert.equal(isSafeHttpUrl("not a url"), false);
  });

  it("extracts a hostname for display", () => {
    assert.equal(safeHostname("https://www.example.com/recipes/x"), "www.example.com");
  });

  it("returns null for an unparseable URL", () => {
    assert.equal(safeHostname("not a url"), null);
  });
});
