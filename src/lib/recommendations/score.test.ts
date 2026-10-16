import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isEligible,
  matchesMood,
  recommend,
  scoreRecipe,
  seededUnit,
  SHUFFLE_SPREAD,
  summarizeCookingHistory,
  WEIGHTS,
  type RecommendationInput,
} from "./score.ts";

const NOW = new Date("2026-10-15T18:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000).toISOString();

function input(
  overrides: Partial<RecommendationInput> & { recipeId: string },
): RecommendationInput {
  return {
    readiness: "ready_to_cook",
    runningLow: [],
    needsCheck: [],
    missing: [],
    totalMinutes: null,
    favorite: false,
    timesCooked: 1,
    lastCookedAt: daysAgo(20),
    lastRating: null,
    plannedSoon: false,
    ...overrides,
  };
}

describe("isEligible", () => {
  it("excludes a recipe missing a core ingredient unless explicitly included", () => {
    const r = input({ recipeId: "a", readiness: "not_ready", missing: ["chicken"] });
    assert.equal(isEligible(r, true), false);
    assert.equal(isEligible(r, true, true), true);
  });

  it("includes needs_shopping only when opted in", () => {
    const r = input({ recipeId: "a", readiness: "needs_shopping", missing: ["lime"] });
    assert.equal(isEligible(r, false), false);
    assert.equal(isEligible(r, true), true);
  });

  it("includes ready, almost ready and check first by default", () => {
    for (const readiness of ["ready_to_cook", "almost_ready", "check_first"] as const) {
      assert.equal(isEligible(input({ recipeId: "a", readiness }), false), true);
    }
  });
});

describe("matchesMood", () => {
  it("quick requires a known total time of 30 minutes or less", () => {
    assert.equal(matchesMood(input({ recipeId: "a", totalMinutes: 30 }), "quick", NOW), true);
    assert.equal(matchesMood(input({ recipeId: "a", totalMinutes: 31 }), "quick", NOW), false);
    assert.equal(matchesMood(input({ recipeId: "a", totalMinutes: null }), "quick", NOW), false);
  });

  it("use_up requires at least one running-low ingredient", () => {
    assert.equal(matchesMood(input({ recipeId: "a", runningLow: ["milk"] }), "use_up", NOW), true);
    assert.equal(matchesMood(input({ recipeId: "a" }), "use_up", NOW), false);
  });

  it("new means never cooked", () => {
    assert.equal(
      matchesMood(input({ recipeId: "a", timesCooked: 0, lastCookedAt: null }), "new", NOW),
      true,
    );
    assert.equal(matchesMood(input({ recipeId: "a" }), "new", NOW), false);
  });

  it("old_favorite is a favorite or loved recipe not cooked in the last two weeks", () => {
    assert.equal(matchesMood(input({ recipeId: "a", favorite: true }), "old_favorite", NOW), true);
    assert.equal(
      matchesMood(
        input({ recipeId: "a", lastRating: "loved", lastCookedAt: daysAgo(14) }),
        "old_favorite",
        NOW,
      ),
      true,
    );
    assert.equal(
      matchesMood(
        input({ recipeId: "a", favorite: true, lastCookedAt: daysAgo(3) }),
        "old_favorite",
        NOW,
      ),
      false,
    );
    assert.equal(matchesMood(input({ recipeId: "a" }), "old_favorite", NOW), false);
  });
});

describe("scoreRecipe", () => {
  it("ranks readiness first: ready beats almost ready beats check first", () => {
    const score = (readiness: RecommendationInput["readiness"]) =>
      scoreRecipe(
        input({ recipeId: "a", readiness, runningLow: ["x"], needsCheck: ["y"] }),
        "any",
        NOW,
      ).score;
    assert.ok(score("ready_to_cook") > score("almost_ready"));
    assert.ok(score("almost_ready") > score("check_first"));
  });

  it("penalizes recipes cooked in the last few days", () => {
    const fresh = scoreRecipe(input({ recipeId: "a", lastCookedAt: daysAgo(1) }), "any", NOW).score;
    const older = scoreRecipe(
      input({ recipeId: "a", lastCookedAt: daysAgo(20) }),
      "any",
      NOW,
    ).score;
    assert.equal(older - fresh, -WEIGHTS.cookedWithin3Days);
  });

  it("puts personal reasons before the readiness line", () => {
    const { reasons } = scoreRecipe(input({ recipeId: "a", favorite: true }), "any", NOW);
    assert.equal(reasons[0], "One of your favorites.");
    assert.equal(reasons[1], "You have everything you need.");
  });

  it("explains a never-cooked recipe", () => {
    const { reasons } = scoreRecipe(
      input({ recipeId: "a", timesCooked: 0, lastCookedAt: null }),
      "any",
      NOW,
    );
    assert.ok(reasons.includes("You haven't tried this one yet."));
  });

  it("names running-low ingredients when the mood is use_up", () => {
    const { reasons } = scoreRecipe(
      input({ recipeId: "a", readiness: "almost_ready", runningLow: ["spinach"] }),
      "use_up",
      NOW,
    );
    assert.equal(reasons[0], "Uses up spinach before it runs out.");
  });

  it("summarizes long ingredient lists", () => {
    const { reasons } = scoreRecipe(
      input({
        recipeId: "a",
        readiness: "check_first",
        needsCheck: ["eggs", "milk", "flour", "sugar"],
      }),
      "any",
      NOW,
    );
    assert.ok(reasons.includes("Check you still have eggs, milk and 2 more."));
  });
});

describe("recommend", () => {
  it("excludes ineligible recipes and sorts by score", () => {
    const result = recommend(
      [
        input({ recipeId: "check", readiness: "check_first", needsCheck: ["x"] }),
        input({ recipeId: "ready", readiness: "ready_to_cook" }),
        input({ recipeId: "core-missing", readiness: "not_ready", missing: ["chicken"] }),
      ],
      { mood: "any", now: NOW },
    );
    assert.deepEqual(
      result.map((r) => r.recipeId),
      ["ready", "check"],
    );
  });

  it("breaks ties deterministically by recipe id", () => {
    const result = recommend(
      [input({ recipeId: "b" }), input({ recipeId: "a" }), input({ recipeId: "c" })],
      {
        mood: "any",
        now: NOW,
      },
    );
    assert.deepEqual(
      result.map((r) => r.recipeId),
      ["a", "b", "c"],
    );
  });

  it("filters to the mood by default and only boosts when strictMood is false", () => {
    const inputs = [
      input({ recipeId: "slow", totalMinutes: 90 }),
      input({ recipeId: "fast", totalMinutes: 20 }),
    ];
    assert.deepEqual(
      recommend(inputs, { mood: "quick", now: NOW }).map((r) => r.recipeId),
      ["fast"],
    );
    assert.deepEqual(
      recommend(inputs, { mood: "quick", now: NOW, strictMood: false }).map((r) => r.recipeId),
      ["fast", "slow"],
    );
  });

  it("returns an empty list when nothing is eligible", () => {
    assert.deepEqual(
      recommend([input({ recipeId: "a", readiness: "not_ready", missing: ["rice"] })], {
        mood: "any",
        now: NOW,
      }),
      [],
    );
  });

  it("orders an endless deck: cookable now, then needs a shop, then missing a core ingredient", () => {
    const result = recommend(
      [
        input({ recipeId: "core-missing", readiness: "not_ready", missing: ["chicken"] }),
        input({ recipeId: "shop", readiness: "needs_shopping", missing: ["lime"] }),
        input({ recipeId: "ready", readiness: "ready_to_cook" }),
      ],
      { mood: "any", now: NOW, includeNeedsShopping: true, includeNotReady: true },
    );
    assert.deepEqual(
      result.map((r) => r.recipeId),
      ["ready", "shop", "core-missing"],
    );
  });

  it("sinks recipes already planned this week", () => {
    const result = recommend(
      [input({ recipeId: "a", plannedSoon: true }), input({ recipeId: "b" })],
      { mood: "any", now: NOW },
    );
    assert.deepEqual(
      result.map((r) => r.recipeId),
      ["b", "a"],
    );
  });

  it("includes needs_shopping recipes only when asked", () => {
    const inputs = [input({ recipeId: "a", readiness: "needs_shopping", missing: ["lime"] })];
    assert.equal(recommend(inputs, { mood: "any", now: NOW }).length, 0);
    assert.equal(
      recommend(inputs, { mood: "any", now: NOW, includeNeedsShopping: true }).length,
      1,
    );
  });
});

describe("summarizeCookingHistory", () => {
  it("counts cooks and keeps the rating of the most recent cook regardless of row order", () => {
    const summary = summarizeCookingHistory([
      { recipe_id: "r1", cooked_at: daysAgo(10), rating: "loved" },
      { recipe_id: "r1", cooked_at: daysAgo(2), rating: null },
      { recipe_id: "r1", cooked_at: daysAgo(30), rating: "meh" },
      { recipe_id: "r2", cooked_at: daysAgo(5), rating: "good" },
    ]);
    assert.deepEqual(summary.get("r1"), {
      timesCooked: 3,
      lastCookedAt: daysAgo(2),
      lastRating: null,
    });
    assert.deepEqual(summary.get("r2"), {
      timesCooked: 1,
      lastCookedAt: daysAgo(5),
      lastRating: "good",
    });
    assert.equal(summary.get("r3"), undefined);
  });

  it("ignores unknown rating values", () => {
    const summary = summarizeCookingHistory([
      { recipe_id: "r1", cooked_at: daysAgo(1), rating: "amazing" },
    ]);
    assert.equal(summary.get("r1")?.lastRating, null);
  });
});

describe("seeded daily shuffle", () => {
  const many = Array.from({ length: 12 }, (_, i) =>
    input({ recipeId: `r${String(i).padStart(2, "0")}` }),
  );
  const order = (seed?: string) =>
    recommend(many, { mood: "any", now: NOW, seed }).map((r) => r.recipeId);

  it("is repeatable for the same seed", () => {
    assert.deepEqual(order("2026-10-16"), order("2026-10-16"));
  });

  it("changes the order from one day to the next", () => {
    assert.notDeepEqual(order("2026-10-16"), order("2026-10-17"));
    assert.notDeepEqual(order("2026-10-16"), order());
  });

  it("gives every recipe a turn near the top over a month of seeds", () => {
    const leaders = new Set<string>();
    for (let day = 1; day <= 30; day++) leaders.add(order(`2026-11-${day}`).slice(0, 3)[0]);
    assert.ok(leaders.size >= 6, `only ${leaders.size} different recipes led the deck`);
  });

  it("never lets shuffling move a recipe across readiness tiers", () => {
    const mixed = [
      input({ recipeId: "a-core-missing", readiness: "not_ready", missing: ["x"] }),
      input({ recipeId: "b-shop", readiness: "needs_shopping", missing: ["y"] }),
      input({ recipeId: "c-ready", readiness: "ready_to_cook" }),
      input({ recipeId: "d-check", readiness: "check_first", needsCheck: ["z"] }),
    ];
    for (let day = 1; day <= 20; day++) {
      const ids = recommend(mixed, {
        mood: "any",
        now: NOW,
        seed: `day-${day}`,
        includeNeedsShopping: true,
        includeNotReady: true,
      }).map((r) => r.recipeId);
      assert.deepEqual(ids.slice(2), ["b-shop", "a-core-missing"]);
    }
  });

  it("still sinks a recipe cooked yesterday below an otherwise equal one", () => {
    const pair = [
      input({ recipeId: "fresh", lastCookedAt: daysAgo(1) }),
      input({ recipeId: "old" }),
    ];
    assert.ok(SHUFFLE_SPREAD < -WEIGHTS.cookedWithin3Days);
    for (let day = 1; day <= 200; day++) {
      assert.equal(recommend(pair, { mood: "any", now: NOW, seed: `d${day}` })[0].recipeId, "old");
    }
  });

  it("maps the hash into [0, 1)", () => {
    for (const key of ["a", "b", "recipe-123", ""]) {
      const u = seededUnit("seed", key);
      assert.ok(u >= 0 && u < 1);
    }
  });
});
