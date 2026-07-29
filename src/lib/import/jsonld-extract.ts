import { emptyDraft, type ExtractedRecipeDraft } from "./types";
import { parseIngredientLine } from "./ingredient-parse";

const SCRIPT_BLOCK_RE =
  /<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

type JsonLdNode = Record<string, unknown>;

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
  return typeof value === "string" ? value : "";
}

function mapIngredients(value: unknown): ExtractedRecipeDraft["ingredients"] {
  const list = Array.isArray(value) ? value : [];
  return list
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    .map((line) => ({
      ...parseIngredientLine(line),
      importance: "core" as const,
    }));
}

function flattenInstructions(value: unknown): string[] {
  if (typeof value === "string") {
    return value.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  }
  if (!Array.isArray(value)) return [];

  const out: string[] = [];
  for (const item of value) {
    if (typeof item === "string") {
      if (item.trim()) out.push(item.trim());
      continue;
    }
    if (item != null && typeof item === "object") {
      const obj = item as JsonLdNode;
      const type = Array.isArray(obj["@type"]) ? obj["@type"][0] : obj["@type"];
      if (typeof type === "string" && type.toLowerCase() === "howtosection") {
        const nested = obj.itemListElement;
        out.push(...flattenInstructions(nested));
        continue;
      }
      const text = obj.text;
      if (typeof text === "string" && text.trim()) out.push(text.trim());
    }
  }
  return out;
}

// Maps a schema.org Recipe node to Simmeri's ExtractedRecipeDraft. Each
// recipeIngredient string (schema.org gives one unstructured string per
// ingredient) is split conservatively via parseIngredientLine — see
// ./ingredient-parse for the quantity/unit/name split rules.
export function mapSchemaOrgRecipeToDraft(node: JsonLdNode): ExtractedRecipeDraft {
  const draft = emptyDraft(asString(node.name) || "Imported recipe");
  draft.description = asString(node.description);
  draft.servings = firstInt(node.recipeYield);
  draft.prep_time_minutes = parseIsoDurationToMinutes(node.prepTime);
  draft.cook_time_minutes =
    parseIsoDurationToMinutes(node.cookTime) ?? parseIsoDurationToMinutes(node.totalTime);
  draft.ingredients = mapIngredients(node.recipeIngredient);
  draft.steps = flattenInstructions(node.recipeInstructions).map((instruction) => ({
    instruction,
  }));
  return draft;
}
