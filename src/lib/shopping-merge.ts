// Pure, dependency-free primitives for conservatively merging generated
// shopping needs. No browser/database dependencies, no AI, no fuzzy
// matching, no canonical-ingredient model — only deterministic text
// normalization and safe numeric parsing.

// Trim, lowercase, collapse repeated internal whitespace only. Never stems,
// never removes meaningful words — "tomatoes" and "canned tomatoes" (or
// "milk" and "coconut milk") must stay materially different names.
export function normalizeIngredientName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

// Every alias maps to one canonical representative per unit family. Deliberately
// the same minimum family list the ingredient parser already recognizes
// (src/lib/import/ingredient-parse.ts) so the two stay conceptually aligned,
// though this module has no import dependency on it.
const UNIT_ALIASES: Record<string, string> = {
  tsp: "teaspoon",
  teaspoon: "teaspoon",
  teaspoons: "teaspoon",
  tbsp: "tablespoon",
  tablespoon: "tablespoon",
  tablespoons: "tablespoon",
  cup: "cup",
  cups: "cup",
  g: "g",
  gram: "g",
  grams: "g",
  kg: "kg",
  kilogram: "kg",
  kilograms: "kg",
  ml: "ml",
  milliliter: "ml",
  milliliters: "ml",
  l: "l",
  liter: "l",
  liters: "l",
  oz: "oz",
  ounce: "oz",
  ounces: "oz",
  lb: "lb",
  pound: "lb",
  pounds: "lb",
  clove: "clove",
  cloves: "clove",
  can: "can",
  cans: "can",
  piece: "piece",
  pieces: "piece",
};

// Returns the canonical family key for a unit, or null when there is no
// unit at all OR the unit is not one of the explicitly supported aliases.
// An unrecognized unit word is never guessed into one of the known families
// (that would risk a cross-family conversion, e.g. treating "g" and "kg" as
// compatible) — and, unlike a merely-absent unit, it is also never treated
// as compatible with itself. Two candidates both carrying the literal same
// unrecognized unit text (e.g. "scoop" and "scoop") still share this same
// null return value here, but callers must not treat that as a merge
// signal — use isUnitMergeEligible() to decide mergeability; only an
// absent unit or a genuinely recognized alias is ever merge-eligible.
export function canonicalUnit(unit: string | null | undefined): string | null {
  if (!unit) return null;
  const normalized = unit.trim().toLowerCase();
  if (!normalized) return null;
  return UNIT_ALIASES[normalized] ?? null;
}

// True only when a unit is absent (mergeable with other absent units) or a
// recognized alias (mergeable within its own canonical family). A
// non-empty, unrecognized unit is never merge-eligible — not even against
// another instance of the exact same literal text — so callers must give
// it its own unique grouping key rather than relying on canonicalUnit's
// (necessarily identical-for-identical-input) return value to disambiguate.
export function isUnitMergeEligible(unit: string | null | undefined): boolean {
  if (!unit) return true;
  const normalized = unit.trim().toLowerCase();
  if (!normalized) return true;
  return normalized in UNIT_ALIASES;
}

export function computeMergeKey(name: string, unit: string | null | undefined): string {
  return `${normalizeIngredientName(name)}::${canonicalUnit(unit) ?? ""}`;
}

const AMBIGUOUS_QUANTITY_RE = /to taste|as needed|handful|^a\s|^an\s/i;
const RANGE_RE = /\d\s*[-–]\s*\d/;

// Parses a quantity_text into a plain numeric value only when it is safe
// and unambiguous to do so. Returns null (never combinable) for ranges,
// "to taste", "as needed", "a handful", unknown text, or anything else that
// isn't a clean integer, decimal, simple fraction, or mixed number.
export function parseQuantityValue(text: string | null | undefined): number | null {
  if (!text) return null;
  const trimmed = text.trim();
  if (!trimmed) return null;
  if (AMBIGUOUS_QUANTITY_RE.test(trimmed)) return null;
  if (RANGE_RE.test(trimmed)) return null;

  const mixedMatch = /^(\d+)\s+(\d+)\/(\d+)$/.exec(trimmed);
  if (mixedMatch) {
    const whole = Number(mixedMatch[1]);
    const numerator = Number(mixedMatch[2]);
    const denominator = Number(mixedMatch[3]);
    if (denominator === 0) return null;
    return whole + numerator / denominator;
  }

  const fractionMatch = /^(\d+)\/(\d+)$/.exec(trimmed);
  if (fractionMatch) {
    const numerator = Number(fractionMatch[1]);
    const denominator = Number(fractionMatch[2]);
    if (denominator === 0) return null;
    return numerator / denominator;
  }

  if (/^\d+\.\d+$/.test(trimmed)) return Number(trimmed);
  if (/^\d+$/.test(trimmed)) return Number(trimmed);

  return null;
}

// Formats a numeric quantity for display: whole numbers with no decimal
// point, otherwise up to 2 decimal places with trailing zeros trimmed.
export function formatQuantityValue(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

export type CombineQuantitiesResult =
  | { combinable: true; combinedValue: number; combinedText: string }
  | { combinable: false };

// Sums every quantity text in the list only when ALL of them parse safely.
// A single unparseable/ambiguous entry makes the whole group not
// combinable — this module never invents a partial total.
export function combineQuantityTexts(
  texts: ReadonlyArray<string | null | undefined>,
): CombineQuantitiesResult {
  let total = 0;
  for (const text of texts) {
    const value = parseQuantityValue(text);
    if (value === null) return { combinable: false };
    total += value;
  }
  return { combinable: true, combinedValue: total, combinedText: formatQuantityValue(total) };
}
