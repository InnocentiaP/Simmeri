// Display-only measurement conversion for recipes: US cups/ounces ↔ metric
// millilitres/grams, plus oven temperatures in step text. Pure and
// deterministic. Nothing here ever changes a stored recipe — the original
// amount is always one tap away.
//
// Spoons (tsp/tbsp, sdt/sdm) are kept as they are in both systems: they are
// used everywhere and differ by less than a few percent.

export type MeasurementSystem = "original" | "metric" | "us";

type Dimension = "volume" | "weight" | "spoon";

interface UnitDef {
  id: string;
  dimension: Dimension;
  // Millilitres (volume, spoon) or grams (weight) per one unit.
  base: number;
  system: "us" | "metric" | "both";
}

const UNITS: Record<string, UnitDef> = {
  tsp: { id: "tsp", dimension: "spoon", base: 4.92892, system: "both" },
  tbsp: { id: "tbsp", dimension: "spoon", base: 14.7868, system: "both" },
  cup: { id: "cup", dimension: "volume", base: 236.588, system: "us" },
  floz: { id: "fl oz", dimension: "volume", base: 29.5735, system: "us" },
  pint: { id: "pint", dimension: "volume", base: 473.176, system: "us" },
  quart: { id: "quart", dimension: "volume", base: 946.353, system: "us" },
  gallon: { id: "gallon", dimension: "volume", base: 3785.41, system: "us" },
  ml: { id: "ml", dimension: "volume", base: 1, system: "metric" },
  cl: { id: "cl", dimension: "volume", base: 10, system: "metric" },
  dl: { id: "dl", dimension: "volume", base: 100, system: "metric" },
  l: { id: "l", dimension: "volume", base: 1000, system: "metric" },
  oz: { id: "oz", dimension: "weight", base: 28.3495, system: "us" },
  lb: { id: "lb", dimension: "weight", base: 453.592, system: "us" },
  g: { id: "g", dimension: "weight", base: 1, system: "metric" },
  kg: { id: "kg", dimension: "weight", base: 1000, system: "metric" },
};

const UNIT_ALIASES: Record<string, keyof typeof UNITS> = {
  tsp: "tsp",
  tsps: "tsp",
  teaspoon: "tsp",
  teaspoons: "tsp",
  sdt: "tsp",
  tbsp: "tbsp",
  tbsps: "tbsp",
  tbs: "tbsp",
  tbl: "tbsp",
  tablespoon: "tbsp",
  tablespoons: "tbsp",
  sdm: "tbsp",
  cup: "cup",
  cups: "cup",
  "fl oz": "floz",
  "fl. oz": "floz",
  "fl. oz.": "floz",
  "fluid ounce": "floz",
  "fluid ounces": "floz",
  pint: "pint",
  pints: "pint",
  pt: "pint",
  quart: "quart",
  quarts: "quart",
  qt: "quart",
  gallon: "gallon",
  gallons: "gallon",
  gal: "gallon",
  ml: "ml",
  milliliter: "ml",
  milliliters: "ml",
  millilitre: "ml",
  millilitres: "ml",
  cl: "cl",
  dl: "dl",
  l: "l",
  liter: "l",
  liters: "l",
  litre: "l",
  litres: "l",
  oz: "oz",
  ounce: "oz",
  ounces: "oz",
  lb: "lb",
  lbs: "lb",
  pound: "lb",
  pounds: "lb",
  g: "g",
  gr: "g",
  gram: "g",
  grams: "g",
  gramme: "g",
  grammes: "g",
  kg: "kg",
  kilogram: "kg",
  kilograms: "kg",
};

export function resolveUnit(unit: string | null | undefined): UnitDef | null {
  if (!unit) return null;
  const key = unit.trim().toLowerCase().replace(/\s+/g, " ").replace(/\.$/, "");
  const id = UNIT_ALIASES[key];
  return id ? UNITS[id] : null;
}

// ---------------------------------------------------------------------------
// Quantities
// ---------------------------------------------------------------------------

const UNICODE_FRACTIONS: Record<string, number> = {
  "½": 0.5,
  "⅓": 1 / 3,
  "⅔": 2 / 3,
  "¼": 0.25,
  "¾": 0.75,
  "⅕": 0.2,
  "⅛": 0.125,
  "⅜": 0.375,
  "⅝": 0.625,
  "⅞": 0.875,
};

// "2", "1.5", "1,5", "1/2", "1 1/2", "½", "1½", "1 ½" → number; else null.
export function parseAmount(text: string): number | null {
  const t = text.trim().replace(/(\d),(\d)/g, "$1.$2");
  if (!t) return null;
  const uni = /^(\d+)?\s*([½⅓⅔¼¾⅕⅛⅜⅝⅞])$/.exec(t);
  if (uni) return (uni[1] ? Number(uni[1]) : 0) + UNICODE_FRACTIONS[uni[2]];
  const mixed = /^(\d+)\s+(\d+)\/(\d+)$/.exec(t);
  if (mixed)
    return Number(mixed[3]) ? Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]) : null;
  const frac = /^(\d+)\/(\d+)$/.exec(t);
  if (frac) return Number(frac[2]) ? Number(frac[1]) / Number(frac[2]) : null;
  if (/^\d+(\.\d+)?$/.test(t)) return Number(t);
  return null;
}

// A single amount or a range ("2-3", "2 to 3").
export function parseQuantity(text: string): { low: number; high: number } | null {
  const range = /^(.+?)\s*(?:-|–|—|to|sampai)\s*(.+)$/i.exec(text.trim());
  if (range) {
    const low = parseAmount(range[1]);
    const high = parseAmount(range[2]);
    return low !== null && high !== null && high >= low ? { low, high } : null;
  }
  const single = parseAmount(text);
  return single === null ? null : { low: single, high: single };
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

function roundTo(value: number, step: number): number {
  return Math.round(value / step) * step;
}

// Sensible precision for metric amounts: whole numbers when small, then
// steps of 5 and 10 so nobody is asked for "473 ml".
function roundMetric(value: number): number {
  if (value < 10) return Math.round(value * 10) / 10;
  if (value < 50) return Math.round(value);
  if (value < 500) return roundTo(value, 5);
  return roundTo(value, 10);
}

function trimNumber(value: number): string {
  return String(Math.round(value * 100) / 100);
}

const NICE_FRACTIONS: [number, string][] = [
  [0, ""],
  [1 / 4, "¼"],
  [1 / 3, "⅓"],
  [1 / 2, "½"],
  [2 / 3, "⅔"],
  [3 / 4, "¾"],
  [1, ""],
];

// Kitchen fractions for US amounts: 1.49 → "1 ½", 0.33 → "⅓".
export function formatFraction(value: number): string {
  let whole = Math.floor(value);
  const rest = value - whole;
  let best = NICE_FRACTIONS[0];
  for (const candidate of NICE_FRACTIONS) {
    if (Math.abs(candidate[0] - rest) < Math.abs(best[0] - rest)) best = candidate;
  }
  if (best[0] === 1) whole += 1;
  if (!best[1]) return String(whole);
  return whole > 0 ? `${whole} ${best[1]}` : best[1];
}

function formatRange(low: number, high: number, format: (n: number) => string): string {
  const a = format(low);
  const b = format(high);
  return a === b ? a : `${a}–${b}`;
}

// ---------------------------------------------------------------------------
// Conversion
// ---------------------------------------------------------------------------

export interface AmountInput {
  quantityText: string;
  unit: string;
  // Typical grams per US cup for this ingredient, when it is something
  // usually weighed in metric kitchens (flour, sugar, butter, …). Null for
  // liquids and anything unknown.
  gramsPerCup: number | null;
}

export interface ConvertedAmount {
  quantityText: string;
  unit: string;
  changed: boolean;
  // True when a volume ↔ weight conversion used a typical density.
  approximate: boolean;
}

function unchanged(input: AmountInput): ConvertedAmount {
  return { quantityText: input.quantityText, unit: input.unit, changed: false, approximate: false };
}

// Pulls a unit out of the quantity when the unit field is empty ("2 cups").
function splitQuantityUnit(input: AmountInput): { quantity: string; unit: string } {
  if (input.unit.trim() || !input.quantityText.trim()) {
    return { quantity: input.quantityText, unit: input.unit };
  }
  const m = /^(.*?[\d½⅓⅔¼¾⅕⅛⅜⅝⅞])\s*([a-zA-Z][a-zA-Z. ]*)$/.exec(input.quantityText.trim());
  if (m && resolveUnit(m[2])) return { quantity: m[1], unit: m[2] };
  return { quantity: input.quantityText, unit: input.unit };
}

function toMetric(
  lowBase: number,
  highBase: number,
  dim: Dimension,
): { text: string; unit: string } {
  const big = dim === "weight" ? "kg" : "l";
  const small = dim === "weight" ? "g" : "ml";
  if (highBase >= 1000) {
    return {
      text: formatRange(lowBase / 1000, highBase / 1000, (n) =>
        trimNumber(Math.round(n * 10) / 10),
      ),
      unit: big,
    };
  }
  return { text: formatRange(lowBase, highBase, (n) => trimNumber(roundMetric(n))), unit: small };
}

function volumeToUs(lowMl: number, highMl: number): { text: string; unit: string } {
  if (highMl < 15) {
    return {
      text: formatRange(lowMl / UNITS.tsp.base, highMl / UNITS.tsp.base, formatFraction),
      unit: "tsp",
    };
  }
  if (highMl < 59) {
    return {
      text: formatRange(lowMl / UNITS.tbsp.base, highMl / UNITS.tbsp.base, formatFraction),
      unit: "tbsp",
    };
  }
  const text = formatRange(lowMl / UNITS.cup.base, highMl / UNITS.cup.base, formatFraction);
  // Plural follows what is shown: "1 cup", "¾ cup", "1 ½ cups", "1–2 cups".
  return { text, unit: text === "1" || /^[¼⅓½⅔¾]$/.test(text) ? "cup" : "cups" };
}

function weightToUs(lowG: number, highG: number): { text: string; unit: string } {
  const lowOz = lowG / UNITS.oz.base;
  const highOz = highG / UNITS.oz.base;
  if (highOz >= 16) {
    return {
      text: formatRange(lowOz / 16, highOz / 16, (n) => trimNumber(Math.round(n * 4) / 4)),
      unit: "lb",
    };
  }
  return {
    text: formatRange(lowOz, highOz, (n) =>
      trimNumber(n < 10 ? Math.round(n * 2) / 2 : Math.round(n)),
    ),
    unit: "oz",
  };
}

export function convertAmount(input: AmountInput, target: MeasurementSystem): ConvertedAmount {
  if (target === "original") return unchanged(input);
  const { quantity, unit } = splitQuantityUnit(input);
  const def = resolveUnit(unit);
  const qty = parseQuantity(quantity);
  if (!def || !qty || def.dimension === "spoon" || def.system === target) return unchanged(input);

  const lowBase = qty.low * def.base;
  const highBase = qty.high * def.base;
  const perMlGrams = input.gramsPerCup ? input.gramsPerCup / UNITS.cup.base : null;

  if (target === "metric") {
    // Dry ingredients measured by volume become grams, the way metric
    // recipes write them; liquids become millilitres.
    if (def.dimension === "volume" && perMlGrams) {
      const { text, unit: u } = toMetric(lowBase * perMlGrams, highBase * perMlGrams, "weight");
      return { quantityText: text, unit: u, changed: true, approximate: true };
    }
    const { text, unit: u } = toMetric(lowBase, highBase, def.dimension);
    return { quantityText: text, unit: u, changed: true, approximate: false };
  }

  // target === "us"
  if (def.dimension === "weight" && perMlGrams) {
    const { text, unit: u } = volumeToUs(lowBase / perMlGrams, highBase / perMlGrams);
    return { quantityText: text, unit: u, changed: true, approximate: true };
  }
  const { text, unit: u } =
    def.dimension === "weight" ? weightToUs(lowBase, highBase) : volumeToUs(lowBase, highBase);
  return { quantityText: text, unit: u, changed: true, approximate: false };
}

// Which system a recipe's amounts are written in, judged by its units.
export function detectMeasurementSystem(
  amounts: readonly { quantityText: string; unit: string }[],
): "metric" | "us" | "mixed" | "none" {
  let us = 0;
  let metric = 0;
  for (const amount of amounts) {
    const { unit } = splitQuantityUnit({ ...amount, gramsPerCup: null });
    const def = resolveUnit(unit);
    if (!def || def.system === "both") continue;
    if (def.system === "us") us += 1;
    else metric += 1;
  }
  if (us === 0 && metric === 0) return "none";
  if (us > 0 && metric > 0) return "mixed";
  return us > 0 ? "us" : "metric";
}

// ---------------------------------------------------------------------------
// Temperatures in step text
// ---------------------------------------------------------------------------

const TEMPERATURE_RE =
  /(\d{2,3})\s*(?:°\s*|º\s*|degrees?\s+|derajat\s+)(F|C|Fahrenheit|Celsius)\b|(\d{2,3})\s*(?:°|º)(F|C)\b/gi;

// Rewrites oven temperatures for the target system, keeping the original in
// parentheses: "Bake at 350°F" → "Bake at 175°C (350°F)" for metric.
export function convertTemperaturesInText(text: string, target: MeasurementSystem): string {
  if (target === "original") return text;
  return text.replace(TEMPERATURE_RE, (match, n1, u1, n2, u2) => {
    const value = Number(n1 ?? n2);
    const isF = String(u1 ?? u2)
      .toUpperCase()
      .startsWith("F");
    if (target === "metric" && isF) return `${roundTo(((value - 32) * 5) / 9, 5)}°C (${match})`;
    if (target === "us" && !isF) return `${roundTo((value * 9) / 5 + 32, 5)}°F (${match})`;
    return match;
  });
}
