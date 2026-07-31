import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { isAiRateLimited } from "./ai-rate-limit.server.ts";

describe("isAiRateLimited", () => {
  it("allows calls under the limit and tracks distinct users independently", () => {
    const userA = `user-a-${Math.random()}`;
    const userB = `user-b-${Math.random()}`;
    for (let i = 0; i < 5; i++) {
      assert.equal(isAiRateLimited(userA), false);
    }
    // userB has never called before — unaffected by userA's usage.
    assert.equal(isAiRateLimited(userB), false);
  });

  it("blocks the 11th call within the window for the same user", () => {
    const userId = `user-block-${Math.random()}`;
    for (let i = 0; i < 10; i++) {
      assert.equal(isAiRateLimited(userId), false);
    }
    assert.equal(isAiRateLimited(userId), true);
  });

  it("allows calls again once old entries fall outside the window", (t) => {
    const userId = `user-window-${Math.random()}`;
    const realNow = Date.now;
    let simulatedNow = realNow();
    mock.method(Date, "now", () => simulatedNow);
    t.after(() => {
      Date.now = realNow;
    });

    for (let i = 0; i < 10; i++) {
      assert.equal(isAiRateLimited(userId), false);
    }
    assert.equal(isAiRateLimited(userId), true);

    // Advance past the 10-minute window — the earlier calls should no
    // longer count against the limit.
    simulatedNow += 10 * 60 * 1000 + 1;
    assert.equal(isAiRateLimited(userId), false);
  });
});
