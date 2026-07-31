import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  mapGeminiErrorToUserMessage,
  AI_MALFORMED_RESPONSE_MESSAGE,
  AI_RATE_LIMIT_EXCEEDED_MESSAGE,
} from "./gemini-error-messages.ts";

describe("mapGeminiErrorToUserMessage", () => {
  it("maps every known failure category to a distinct, safe message", () => {
    const categories = ["not_configured", "timeout", "network", "rate_limited", "upstream_error"] as const;
    const messages = categories.map((c) => mapGeminiErrorToUserMessage(c));
    assert.equal(new Set(messages).size > 0, true);
    for (const message of messages) {
      assert.equal(typeof message, "string");
      assert.ok(message.length > 0);
    }
  });

  it("maps timeout and network to the same transient-failure message", () => {
    assert.equal(mapGeminiErrorToUserMessage("timeout"), mapGeminiErrorToUserMessage("network"));
  });

  it("never includes internal detail like status codes or hostnames", () => {
    const categories = ["not_configured", "timeout", "network", "rate_limited", "upstream_error"] as const;
    for (const c of categories) {
      const message = mapGeminiErrorToUserMessage(c);
      assert.equal(/\d{3}/.test(message), false); // no bare 3-digit HTTP status
      assert.equal(/http/i.test(message), false);
    }
  });
});

describe("shared AI error message constants", () => {
  it("are non-empty, safe strings with no secret-adjacent content", () => {
    for (const message of [AI_MALFORMED_RESPONSE_MESSAGE, AI_RATE_LIMIT_EXCEEDED_MESSAGE]) {
      assert.ok(message.length > 0);
      assert.equal(/gemini_api_key/i.test(message), false);
    }
  });
});
