import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  formatDateKey,
  parseDateKey,
  addDays,
  isSameDay,
  startOfWeek,
  getWeekRange,
  eachDayOfWeek,
  previousPeriod,
  nextPeriod,
  compareMealSlots,
  MEAL_SLOT_ORDER,
} from "./date-range.ts";

describe("formatDateKey / parseDateKey", () => {
  it("formats a date as YYYY-MM-DD", () => {
    assert.equal(formatDateKey(new Date(2026, 6, 4)), "2026-07-04");
  });

  it("pads single-digit month and day", () => {
    assert.equal(formatDateKey(new Date(2026, 0, 9)), "2026-01-09");
  });

  it("round-trips through parseDateKey", () => {
    const key = "2026-12-31";
    const parsed = parseDateKey(key);
    assert.equal(formatDateKey(parsed), key);
  });
});

describe("addDays", () => {
  it("adds positive days", () => {
    const result = addDays(new Date(2026, 6, 30), 3);
    assert.equal(formatDateKey(result), "2026-08-02");
  });

  it("subtracts with negative days", () => {
    const result = addDays(new Date(2026, 7, 2), -3);
    assert.equal(formatDateKey(result), "2026-07-30");
  });

  it("crosses a year boundary", () => {
    const result = addDays(new Date(2026, 11, 30), 3);
    assert.equal(formatDateKey(result), "2027-01-02");
  });
});

describe("isSameDay", () => {
  it("is true for the same calendar date at different times", () => {
    assert.equal(isSameDay(new Date(2026, 6, 4, 8, 0), new Date(2026, 6, 4, 22, 30)), true);
  });

  it("is false for different dates", () => {
    assert.equal(isSameDay(new Date(2026, 6, 4), new Date(2026, 6, 5)), false);
  });
});

describe("startOfWeek / getWeekRange", () => {
  it("returns the same Monday for every day in that week (weekStartsOn=1)", () => {
    const monday = new Date(2026, 6, 6); // a Monday
    for (let i = 0; i < 7; i++) {
      const day = addDays(monday, i);
      assert.equal(formatDateKey(startOfWeek(day, 1)), formatDateKey(monday));
    }
  });

  it("supports weekStartsOn=0 (Sunday)", () => {
    const sunday = new Date(2026, 6, 5);
    assert.equal(formatDateKey(startOfWeek(new Date(2026, 6, 8), 0)), formatDateKey(sunday));
  });

  it("getWeekRange end is exactly 6 days after start", () => {
    const { start, end } = getWeekRange(new Date(2026, 6, 9), 1);
    assert.equal(formatDateKey(addDays(start, 6)), formatDateKey(end));
  });

  it("eachDayOfWeek returns 7 consecutive dates starting at the week start", () => {
    const date = new Date(2026, 6, 9);
    const days = eachDayOfWeek(date, 1);
    assert.equal(days.length, 7);
    assert.equal(formatDateKey(days[0]), formatDateKey(startOfWeek(date, 1)));
    for (let i = 1; i < 7; i++) {
      assert.equal(formatDateKey(days[i]), formatDateKey(addDays(days[0], i)));
    }
  });
});

describe("previousPeriod / nextPeriod", () => {
  it("day view moves by 1 day and is symmetric", () => {
    const date = new Date(2026, 6, 15);
    const next = nextPeriod(date, "day");
    assert.equal(formatDateKey(previousPeriod(next, "day")), formatDateKey(date));
  });

  it("week view moves by 7 days and is symmetric", () => {
    const date = new Date(2026, 6, 15);
    const next = nextPeriod(date, "week");
    assert.equal(formatDateKey(next), formatDateKey(addDays(date, 7)));
    assert.equal(formatDateKey(previousPeriod(next, "week")), formatDateKey(date));
  });

  it("nextPeriod for week crosses a month boundary correctly", () => {
    const date = new Date(2026, 6, 28);
    assert.equal(formatDateKey(nextPeriod(date, "week")), "2026-08-04");
  });
});

describe("compareMealSlots / MEAL_SLOT_ORDER", () => {
  it("orders breakfast before lunch before dinner before snack before other", () => {
    const shuffled = ["other", "dinner", "breakfast", "snack", "lunch"];
    const sorted = [...shuffled].sort(compareMealSlots);
    assert.deepEqual(sorted, [...MEAL_SLOT_ORDER]);
  });

  it("treats an unrecognized slot as sorting last", () => {
    const sorted = ["dinner", "made-up-slot", "breakfast"].sort(compareMealSlots);
    assert.deepEqual(sorted, ["breakfast", "dinner", "made-up-slot"]);
  });
});
