import { emptyDraft, type ExtractedRecipeDraft } from "./types.ts";
import { parseIngredientLine } from "./ingredient-parse.ts";
import { cleanHtmlFragment } from "./html-to-text.ts";

const SCRIPT_BLOCK_RE =
  /<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

export type JsonLdNode = Record<string, unknown>;

// Extracts every application/ld+json block via a scoped regex — deliberately
// not a full HTML parser/DOM library: this narrow a need (grab script tag
// contents, nothing else) doesn't justify a new dependency.
export function extractJsonLdBlocks(html: string): JsonLdNode[] {
  const blocks: JsonLdNode[] = [];
  let match: RegExpExecArray | null;
  SCRIPT_BLOCK_RE.lastIndex = 0;
  while ((match = SCRIPT_BLOCK_RE.exec(html)) !== null) {
    try {
      const parsed = JSON.parse(match[1].trim());
      blocks.push(parsed);
    } catch {
      // Malformed block — skip it, keep scanning the rest of the page.
      continue;
    }
  }
  return blocks;
}

function typeIncludesRecipe(node: JsonLdNode): boolean {
  const raw = node["@type"];
  const types = Array.isArray(raw) ? raw : raw != null ? [raw] : [];
  return types.some((t) => typeof t === "string" && t.toLowerCase() === "recipe");
}

function flattenCandidates(blocks: JsonLdNode[]): JsonLdNode[] {
  const candidates: JsonLdNode[] = [];
  for (const block of blocks) {
    const items = Array.isArray(block) ? block : [block];
    for (const item of items) {
      if (item == null || typeof item !== "object") continue;
      candidates.push(item as JsonLdNode);
      const graph = (item as JsonLdNode)["@graph"];
      if (Array.isArray(graph)) {
        for (const g of graph) {
          if (g != null && typeof g === "object") candidates.push(g as JsonLdNode);
        }
      }
    }
  }
  return candidates;
}

export function findRecipeNode(blocks: JsonLdNode[]): JsonLdNode | null {
  const candidates = flattenCandidates(blocks);
  return candidates.find(typeIncludesRecipe) ?? null;
}

// ISO 8601 duration → minutes. Hours/minutes only — days/seconds are
// intentionally out of scope for recipe prep/cook times.
export function parseIsoDurationToMinutes(iso: unknown): number | null {
  if (typeof iso !== "string") return null;
  const m = /^P(?:\d+D)?T?(?:(\d+)H)?(?:(\d+)M)?/i.exec(iso.trim());
  if (!m) return null;
  const hours = m[1] ? parseInt(m[1], 10) : 0;
  const minutes = m[2] ? parseInt(m[2], 10) : 0;
  if (hours === 0 && minutes === 0) return null;
  return hours * 60 + minutes;
}

function firstInt(value: unknown): number | null {
  const str = Array.isArray(value) ? value.join(" ") : typeof value === "string" ? value : "";
  const m = /\d+/.exec(str);
  return m ? parseInt(m[0], 10) : null;
}

function asString(value: unknown): string {
  return typeof value === "string" ? cleanHtmlFragment(value) : "";
}

function mapIngredients(value: unknown): ExtractedRecipeDraft["ingredients"] {
  const list = Array.isArray(value) ? value : typeof value === "string" ? [value] : [];
  return list
    .filter((v): v is string => typeof v === "string")
    .map((line) => cleanHtmlFragment(line))
    .filter((line) => line.length > 0)
    .map((line) => ({
      ...parseIngredientLine(line),
      importance: "core" as const,
    }));
}

// Splits a block of instruction HTML/text into steps on paragraph, list
// item, and line-break boundaries.
function splitInstructionBlock(value: string): string[] {
  return value
    .split(/<\/?(?:p|li|ol|ul|br)\b[^>]*>|\r?\n/i)
    .map((s) => cleanHtmlFragment(s))
    .filter(Boolean);
}

function flattenInstructions(value: unknown): string[] {
  if (typeof value === "string") return splitInstructionBlock(value);
  if (!Array.isArray(value)) {
    return value != null && typeof value === "object" ? flattenInstructions([value]) : [];
  }

  const out: string[] = [];
  for (const item of value) {
    if (typeof item === "string") {
      out.push(...splitInstructionBlock(item));
      continue;
    }
    if (item != null && typeof item === "object") {
      const obj = item as JsonLdNode;
      const type = Array.isArray(obj["@type"]) ? obj["@type"][0] : obj["@type"];
      if (typeof type === "string" && type.toLowerCase() === "howtosection") {
        out.push(...flattenInstructions(obj.itemListElement));
        continue;
      }
      // HowToStep: prefer text; some sites only fill name.
      const text = asString(obj.text) || asString(obj.name);
      if (text) out.push(text);
    }
  }
  return out;
}

function resolveHttpUrl(raw: unknown, pageUrl: string | null): string | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  try {
    const url = pageUrl ? new URL(raw.trim(), pageUrl) : new URL(raw.trim());
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

// schema.org `image` may be a URL string, an ImageObject ({ url } or
// { contentUrl }), or an array of either. Returns the first usable
// absolute http(s) URL.
// Sites often list several sizes (e.g. a 225x225 thumbnail first). Unknown
// widths are assumed to be full-size originals.
const UNKNOWN_IMAGE_WIDTH = 1000;

function imageWidth(url: string, declared: unknown): number {
  const n =
    typeof declared === "number"
      ? declared
      : typeof declared === "string"
        ? parseInt(declared, 10)
        : NaN;
  if (Number.isFinite(n) && n > 0) return n;
  const m = /-(\d{2,5})x(\d{2,5})\.[a-z0-9]+(?:\?|$)/i.exec(url);
  return m ? parseInt(m[1], 10) : UNKNOWN_IMAGE_WIDTH;
}

// schema.org `image` may be a URL string, an ImageObject ({ url } or
// { contentUrl }, optionally with width), or an array of either. Returns the
// widest usable absolute http(s) URL; the first one wins ties.
export function extractSchemaImageUrl(node: JsonLdNode, pageUrl: string | null): string | null {
  const raw = Array.isArray(node.image) ? node.image : [node.image];
  let best: { url: string; width: number } | null = null;
  for (const c of raw) {
    let url: string | null = null;
    let declared: unknown;
    if (typeof c === "string") {
      url = resolveHttpUrl(c, pageUrl);
    } else if (c != null && typeof c === "object") {
      const obj = c as JsonLdNode;
      url = resolveHttpUrl(obj.url, pageUrl) ?? resolveHttpUrl(obj.contentUrl, pageUrl);
      declared = obj.width;
    }
    if (!url) continue;
    const width = imageWidth(url, declared);
    if (!best || width > best.width) best = { url, width };
  }
  return best?.url ?? null;
}

// Maps a schema.org Recipe node to Simmeri's ExtractedRecipeDraft. Each
// recipeIngredient string (schema.org gives one unstructured string per
// ingredient) is split conservatively via parseIngredientLine — see
// ./ingredient-parse for the quantity/unit/name split rules. Strings are
// HTML-cleaned and entity-decoded, since many sites escape them.
export function mapSchemaOrgRecipeToDraft(node: JsonLdNode): ExtractedRecipeDraft {
  const draft = emptyDraft(asString(node.name) || "Imported recipe");
  draft.description = asString(node.description);
  draft.servings = firstInt(node.recipeYield);
  draft.prep_time_minutes = parseIsoDurationToMinutes(node.prepTime);
  draft.cook_time_minutes =
    parseIsoDurationToMinutes(node.cookTime) ?? parseIsoDurationToMinutes(node.totalTime);
  draft.ingredients = mapIngredients(node.recipeIngredient ?? node.ingredients);
  draft.steps = flattenInstructions(node.recipeInstructions).map((instruction) => ({
    instruction,
  }));
  return draft;
}
