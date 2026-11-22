// Typical grams per US cup for dry/solid ingredients that metric kitchens
// weigh, keyed by canonical ingredient (see the canonical_ingredients
// seeds). Used only to show an approximate ("≈") weight for a cup amount,
// or approximate cups for a weight. Values follow common baking references
// (spooned and levelled, brown sugar packed). Liquids are deliberately
// absent — they convert to millilitres instead.
export const GRAMS_PER_CUP: Readonly<Record<string, number>> = {
  flour: 120,
  almond_flour: 96,
  rice_flour: 158,
  tapioca_starch: 120,
  cornstarch: 112,
  sugar: 200,
  brown_sugar: 213,
  butter: 227,
  margarine: 227,
  rice_raw: 185,
  rice_cooked: 160,
  cocoa_powder: 84,
  cheddar: 113,
};

export function gramsPerCupFor(canonicalKey: string | null): number | null {
  return canonicalKey ? (GRAMS_PER_CUP[canonicalKey] ?? null) : null;
}
