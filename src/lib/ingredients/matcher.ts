// Ingredient identity for readiness, shopping, and Kitchen updates.
//
// A matcher turns any ingredient name into a comparison key. Two names are
// "the same ingredient" when their keys are equal. Resolution, in order:
//   1. the user's own "same as" links (e.g. "cabe" → "cabai merah"), one hop
//   2. the canonical catalog's aliases (user-owned first, then global),
//      trying the exact name and then a conservative singular form
//   3. otherwise the normalized name in a conservative singular form
//
// Matching happens when data is read, never stored on recipe or Kitchen
// rows: nothing about a user's recipes changes, re-saving a recipe can't
// lose a match, and a new link or alias applies everywhere immediately.
// Ambiguous names are simply absent from the catalog (see the canonical
// migration), so they fall through to text matching and are never guessed.
import { normalizeForCanonicalMatch } from "./normalize.ts";

export type IngredientKeyFn = (name: string) => string;

export interface MatcherAliasRow {
  canonical_ingredient_id: string;
  normalized_alias: string;
  owner_user_id: string | null;
}

export interface MatcherLinkRow {
  alias_normalized: string;
  target_normalized: string;
}

export interface MatcherData {
  aliases: readonly MatcherAliasRow[];
  links: readonly MatcherLinkRow[];
  userId: string | null;
}

// Words that end in "s" but are not plurals (or whose stem would collide
// with a different ingredient).
const NOT_PLURAL = new Set([
  "asparagus",
  "couscous",
  "hummus",
  "molasses",
  "swiss",
  "brussels",
  "citrus",
  "watercress",
  "lemongrass",
  "grass",
  "glass",
  "bass",
  "anise",
  "greens",
  "oats",
  "grits",
  "peas",
  "chives",
  "lentils",
  "noodles",
  "sprinkles",
  "jus",
]);

// A plural-insensitive comparison key for the LAST word only, so singular
// and plural forms meet: "tomatoes"/"tomato" → "tomato", "berries"/"berry"
// → "berri", "chilies"/"chili" → "chili", "cookies"/"cookie" → "cooki".
// It is a key, never shown to anyone, so the odd-looking stems are fine.
// Words that aren't plurals (molasses, asparagus, …) and non-English words
// without these endings are left alone.
export function pluralInsensitiveKey(text: string): string {
  const words = text.split(" ");
  let last = words[words.length - 1];
  if (last.length < 4 || NOT_PLURAL.has(last) || /(ss|us|is)$/.test(last)) return text;

  if (/ies$/.test(last)) last = last.slice(0, -2);
  else if (/oes$/.test(last)) last = last.slice(0, -2);
  else if (/(ches|shes|xes)$/.test(last)) last = last.slice(0, -2);
  else if (/[^s]s$/.test(last)) last = last.slice(0, -1);

  if (/[^aeiou]y$/.test(last)) last = `${last.slice(0, -1)}i`;
  else if (/ie$/.test(last)) last = last.slice(0, -1);

  words[words.length - 1] = last;
  return words.join(" ");
}

// The legacy key: exact text after trim + lowercase. Used where no matcher
// has been loaded, so behaviour is unchanged.
export const textOnlyKey: IngredientKeyFn = (name) => name.trim().toLowerCase();

export function createIngredientMatcher({ aliases, links, userId }: MatcherData): IngredientKeyFn {
  const linkMap = new Map<string, string>();
  for (const link of links) {
    const from = normalizeForCanonicalMatch(link.alias_normalized);
    const to = normalizeForCanonicalMatch(link.target_normalized);
    if (from && to && from !== to) linkMap.set(from, to);
  }

  // Exact aliases, plus their plural-insensitive keys. A stem shared by two
  // different canonical ingredients is ambiguous and dropped (null), so it
  // can never merge them.
  const own = new Map<string, string>();
  const global = new Map<string, string>();
  const ownStem = new Map<string, string | null>();
  const globalStem = new Map<string, string | null>();
  const addStem = (map: Map<string, string | null>, stem: string, id: string) => {
    if (!map.has(stem)) map.set(stem, id);
    else if (map.get(stem) !== id) map.set(stem, null);
  };
  for (const row of aliases) {
    const key = normalizeForCanonicalMatch(row.normalized_alias);
    if (!key) continue;
    const id = row.canonical_ingredient_id;
    if (userId !== null && row.owner_user_id === userId) {
      own.set(key, id);
      addStem(ownStem, pluralInsensitiveKey(key), id);
    } else if (row.owner_user_id === null) {
      if (!global.has(key)) global.set(key, id);
      addStem(globalStem, pluralInsensitiveKey(key), id);
    }
  }
  const canonicalFor = (name: string, stem: string) =>
    own.get(name) ?? ownStem.get(stem) ?? global.get(name) ?? globalStem.get(stem) ?? null;

  const cache = new Map<string, string>();
  return (rawName: string) => {
    const cached = cache.get(rawName);
    if (cached !== undefined) return cached;

    const normalized = normalizeForCanonicalMatch(rawName);
    const resolved = linkMap.get(normalized) ?? normalized;
    const stem = pluralInsensitiveKey(resolved);
    const canonical = canonicalFor(resolved, stem);
    const key = canonical ? `c:${canonical}` : `t:${stem}`;
    cache.set(rawName, key);
    return key;
  };
}
