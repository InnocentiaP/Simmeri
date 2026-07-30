// Pure local-calendar-date arithmetic for the Meal Planner. Deliberately not
// IANA-timezone-aware — the app has no timezone utility yet (user_preferences
// .timezone is stored but never read anywhere), so this operates on the
// browser's local time only, matching the "documented limitation, not a
// silent assumption" call in the Wave 2 plan.

export type PlannerView = "day" | "week";
export type WeekStartsOn = 0 | 1; // 0 = Sunday, 1 = Monday

export const MEAL_SLOT_ORDER = ["breakfast", "lunch", "dinner", "snack", "other"] as const;
export type MealSlot = (typeof MEAL_SLOT_ORDER)[number];

export function compareMealSlots(a: string, b: string): number {
  const ai = MEAL_SLOT_ORDER.indexOf(a as MealSlot);
  const bi = MEAL_SLOT_ORDER.indexOf(b as MealSlot);
  return (ai === -1 ? MEAL_SLOT_ORDER.length : ai) - (bi === -1 ? MEAL_SLOT_ORDER.length : bi);
}

function toMidnight(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function formatDateKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(date: Date, days: number): Date {
  const d = toMidnight(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function startOfWeek(date: Date, weekStartsOn: WeekStartsOn = 1): Date {
  const d = toMidnight(date);
  const day = d.getDay();
  const diff = (day - weekStartsOn + 7) % 7;
  return addDays(d, -diff);
}

export function getWeekRange(date: Date, weekStartsOn: WeekStartsOn = 1): { start: Date; end: Date } {
  const start = startOfWeek(date, weekStartsOn);
  const end = addDays(start, 6);
  return { start, end };
}

export function eachDayOfWeek(date: Date, weekStartsOn: WeekStartsOn = 1): Date[] {
  const { start } = getWeekRange(date, weekStartsOn);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function previousPeriod(date: Date, view: PlannerView): Date {
  return addDays(date, view === "day" ? -1 : -7);
}

export function nextPeriod(date: Date, view: PlannerView): Date {
  return addDays(date, view === "day" ? 1 : 7);
}

export function isToday(date: Date): boolean {
  return isSameDay(date, new Date());
}
