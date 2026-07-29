// Conservative, deterministic parsing of a single ingredient line into the
// existing recipe_ingredients fields (quantity_text/unit/display_name/
// preparation_note), so imported ingredients can match Kitchen items by
// display_name instead of the whole raw measurement string. No AI, no new
// canonical-ingredient model — this only splits text that's already there.

export interface ParsedIngredientLine {
  raw_text: string;
  display_name: string;
  quantity_text: string;
  unit: string;
  preparation_note: string;
}

const UNICODE_FRACTIONS: Record<string, string> = {
  "¼": "1/4",
  "½": "1/2",
  "¾": "3/4",
  "⅓": "1/3",
  "⅔": "2/3",
  "⅕": "1/5",
  "⅖": "2/5",
  "⅗": "3/5",
  "⅘": "4/5",
  "⅙": "1/6",
  "⅚": "5/6",
  "⅛": "1/8",
  "⅜": "3/8",
  "⅝": "5/8",
  "⅞": "7/8",
};

const UNICODE_FRACTION_CHARS = Object.keys(UNICODE_FRACTIONS).join("");

// Every alias maps to a stable singular canonical form. Unknown unit words
// are deliberately NOT guessed here — they stay part of display_name rather
// than risk mislabeling an ingredient name as a unit.
const UNIT_ALIASES: Record<string, string> = {
  tsp: "teaspoon",
  tsps: "teaspoon",
  teaspoon: "teaspoon",
  teaspoons: "teaspoon",
  tbsp: "tablespoon",
  tbsps: "tablespoon",
  tablespoon: "tablespoon",
  tablespoons: "tablespoon",
  cup: "cup",
  cups: "cup",
  g: "g",
  gr: "g",
  gram: "g",
  grams: "g",
  kg: "kg",
  kilogram: "kg",
  kilograms: "kg",
  ml: "ml",
  milliliter: "ml",
  milliliters: "ml",
  millilitre: "ml",
  millilitres: "ml",
  l: "l",
  liter: "l",
  litre: "l",
  liters: "l",
  litres: "l",
  oz: "oz",
  ounce: "oz",
  ounces: "oz",
  lb: "lb",
  lbs: "lb",
  pound: "lb",
  pounds: "lb",
  clove: "clove",
  cloves: "clove",
  can: "can",
  cans: "can",
  piece: "piece",
  pieces: "piece",
  pcs: "piece",
  pinch: "pinch",
  pinches: "pinch",
};

// Ordered so longer/more specific quantity shapes are tried before shorter
// ones that would otherwise "win" early (e.g. plain integer would swallow
// just the "2" out of a "2-3" range or "1" out of "1.5" if tried first).
const QUANTITY_RE = new RegExp(
  "^(" +
    "\\d+\\s+\\d+/\\d+" + // mixed fraction: "1 3/4"
    "|\\d+/\\d+" + // simple fraction: "3/4"
    "|\\d+(?:\\.\\d+)?\\s*[-–]\\s*\\d+(?:\\.\\d+)?" + // range: "2-3", "2.5–3"
    "|\\d+\\.\\d+" + // decimal: "1.5"
    "|\\d+" + // integer: "4"
    ")\\s*",
);

const UNIT_TOKEN_RE = /^([a-zA-Z]+)\.?\s*/;

function normalizeUnicodeFractions(input: string): string {
  // Insert a space between a digit and an immediately-following fraction
  // glyph ("1½" -> "1 ½") so the mixed-fraction pattern can match it after
  // the glyph itself is replaced with its ASCII fraction text below.
  const spaced = input.replace(
    new RegExp(`(\\d)([${UNICODE_FRACTION_CHARS}])`, "g"),
    "$1 $2",
  );
  let out = spaced;
  for (const [glyph, ascii] of Object.entries(UNICODE_FRACTIONS)) {
    out = out.split(glyph).join(ascii);
  }
  return out;
}

// Parses one free-text ingredient line, e.g. "4 teaspoons baking powder" or
// "2 cloves garlic, minced". Conservative by design: when a quantity/unit
// can't be confidently separated, the whole line stays in display_name and
// quantity_text/unit are left empty rather than guessed.
export function parseIngredientLine(originalLine: string): ParsedIngredientLine {
  const raw_text = originalLine.trim();
  if (!raw_text) {
    return { raw_text: "", display_name: "", quantity_text: "", unit: "", preparation_note: "" };
  }

  // Split off a trailing preparation clause: "garlic, minced" -> "minced".
  const commaIdx = raw_text.indexOf(",");
  const core = commaIdx === -1 ? raw_text : raw_text.slice(0, commaIdx);
  const preparation_note = commaIdx === -1 ? "" : raw_text.slice(commaIdx + 1).trim();

  const normalized = normalizeUnicodeFractions(core.trim());

  let quantity_text = "";
  let unit = "";
  let rest = normalized;

  const qMatch = QUANTITY_RE.exec(normalized);
  if (qMatch) {
    quantity_text = qMatch[1].replace(/\s+/g, " ").replace(/–/g, "-").trim();
    rest = normalized.slice(qMatch[0].length);

    const uMatch = UNIT_TOKEN_RE.exec(rest);
    if (uMatch) {
      const canonical = UNIT_ALIASES[uMatch[1].toLowerCase()];
      if (canonical) {
        unit = canonical;
        rest = rest.slice(uMatch[0].length);
      }
    }
  }

  const trimmedRest = rest.trim();
  // If splitting off a quantity/unit would leave nothing meaningful as a
  // name, bail out to the safe fallback: keep the full core text as the
  // name and drop the (evidently wrong) quantity/unit guess.
  const display_name = trimmedRest.length > 0 ? trimmedRest : core.trim();
  if (trimmedRest.length === 0) {
    quantity_text = "";
    unit = "";
  }

  return { raw_text, display_name, quantity_text, unit, preparation_note };
}
