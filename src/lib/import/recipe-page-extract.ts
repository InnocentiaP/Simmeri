// Deterministic recipe extraction from a fetched web page, plus the
// focused text handed to AI when the deterministic path comes up short.
// Pure: HTML string in, data out — no network, no AI, fully unit-tested.
//
// Order of preference:
//   1. schema.org Recipe in JSON-LD (most blogs; exact, structured)
//   2. schema.org Recipe in microdata (itemprop attributes; older sites)
//   3. nothing structured — the caller falls back to AI on focused text
import { emptyDraft, type ExtractedRecipeDraft } from "./types.ts";
import { parseIngredientLine } from "./ingredient-parse.ts";
import {
  extractJsonLdBlocks,
  extractSchemaImageUrl,
  findRecipeNode,
  mapSchemaOrgRecipeToDraft,
  type JsonLdNode,
} from "./jsonld-extract.ts";
import { cleanHtmlFragment, decodeHtmlEntities, htmlToReadableText } from "./html-to-text.ts";

export type ExtractionMethod = "json_ld" | "microdata" | "none";

export interface PageExtraction {
  draft: ExtractedRecipeDraft;
  method: ExtractionMethod;
  // Both ingredients and steps were found.
  complete: boolean;
  imageUrl: string | null;
  pageTitle: string | null;
  // The raw schema.org node, when one exists — passed to AI as a hint if
  // the structured data was incomplete.
  recipeNode: JsonLdNode | null;
}

export function isDraftComplete(draft: ExtractedRecipeDraft): boolean {
  return draft.ingredients.length > 0 && draft.steps.length > 0;
}

// ---------------------------------------------------------------------------
// Page metadata
// ---------------------------------------------------------------------------

function parseAttributes(tag: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(tag)) !== null) {
    attrs[m[1].toLowerCase()] = decodeHtmlEntities(m[3] ?? m[4] ?? m[5] ?? "");
  }
  return attrs;
}

// Reads <meta property|name="..." content="..."> regardless of attribute order.
export function readMetaContent(html: string, key: string): string | null {
  const wanted = key.toLowerCase();
  const tags = html.match(/<meta\b[^>]*>/gi) ?? [];
  for (const tag of tags) {
    const attrs = parseAttributes(tag);
    if ((attrs.property ?? attrs.name ?? "").toLowerCase() === wanted && attrs.content?.trim()) {
      return attrs.content.trim();
    }
  }
  return null;
}

export function extractPageTitle(html: string): string | null {
  const og = readMetaContent(html, "og:title");
  if (og) return og;
  const m = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  const title = m ? cleanHtmlFragment(m[1]) : "";
  return title || null;
}

function toAbsoluteHttpUrl(raw: string | null, pageUrl: string): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw, pageUrl);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Microdata (itemprop) fallback
// ---------------------------------------------------------------------------

// Inner HTML of every element carrying one of the given itemprop names.
// Regex-based like the rest of this module: it matches an element up to its
// own closing tag, which covers the flat <li>/<span>/<div> markup recipe
// microdata uses in practice.
function itempropContents(html: string, names: string[]): string[] {
  const alt = names.join("|");
  const re = new RegExp(
    `<([a-z][a-z0-9]*)\\b[^>]*\\bitemprop\\s*=\\s*["'](?:${alt})["'][^>]*>([\\s\\S]*?)<\\/\\1>`,
    "gi",
  );
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) out.push(m[2]);
  return out;
}

function itempropMeta(html: string, name: string): string | null {
  const tags = html.match(/<(?:meta|time|link)\b[^>]*>/gi) ?? [];
  for (const tag of tags) {
    const attrs = parseAttributes(tag);
    if (attrs.itemprop === name) return attrs.content ?? attrs.datetime ?? attrs.href ?? null;
  }
  return null;
}

function splitSteps(fragment: string): string[] {
  const items = fragment.match(/<li\b[^>]*>[\s\S]*?<\/li>/gi);
  const parts = items ?? fragment.split(/<\/?(?:p|br|div)\b[^>]*>|\r?\n/i);
  return parts.map((p) => cleanHtmlFragment(p)).filter(Boolean);
}

export function extractMicrodataDraft(html: string): ExtractedRecipeDraft | null {
  if (!/itemtype\s*=\s*["'][^"']*schema\.org\/Recipe["']/i.test(html)) return null;

  const ingredients = itempropContents(html, ["recipeIngredient", "ingredients"])
    .map((s) => cleanHtmlFragment(s))
    .filter(Boolean);
  const steps = itempropContents(html, ["recipeInstructions"]).flatMap(splitSteps);
  if (ingredients.length === 0 && steps.length === 0) return null;

  const name = itempropContents(html, ["name"])
    .map((s) => cleanHtmlFragment(s))
    .find(Boolean);
  const draft = emptyDraft(name ?? "Imported recipe");
  const description = itempropContents(html, ["description"])
    .map((s) => cleanHtmlFragment(s))
    .find(Boolean);
  draft.description = description ?? "";
  const yieldText = itempropMeta(html, "recipeYield") ?? itempropContents(html, ["recipeYield"])[0];
  const servings = yieldText ? /\d+/.exec(cleanHtmlFragment(yieldText)) : null;
  draft.servings = servings ? parseInt(servings[0], 10) : null;
  draft.ingredients = ingredients.map((line) => ({
    ...parseIngredientLine(line),
    importance: "core" as const,
  }));
  draft.steps = steps.map((instruction) => ({ instruction }));
  return draft;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export function extractRecipeFromHtml(html: string, pageUrl: string): PageExtraction {
  const pageTitle = extractPageTitle(html);
  const ogImage = toAbsoluteHttpUrl(readMetaContent(html, "og:image"), pageUrl);

  const node = findRecipeNode(extractJsonLdBlocks(html));
  if (node) {
    const draft = mapSchemaOrgRecipeToDraft(node);
    // Structured data occasionally omits steps that microdata on the same
    // page still has; borrow them rather than discarding the whole result.
    if (!isDraftComplete(draft)) {
      const micro = extractMicrodataDraft(html);
      if (micro) {
        if (draft.ingredients.length === 0) draft.ingredients = micro.ingredients;
        if (draft.steps.length === 0) draft.steps = micro.steps;
      }
    }
    return {
      draft,
      method: "json_ld",
      complete: isDraftComplete(draft),
      imageUrl: extractSchemaImageUrl(node, pageUrl) ?? ogImage,
      pageTitle,
      recipeNode: node,
    };
  }

  const micro = extractMicrodataDraft(html);
  if (micro) {
    return {
      draft: micro,
      method: "microdata",
      complete: isDraftComplete(micro),
      imageUrl: toAbsoluteHttpUrl(itempropMeta(html, "image"), pageUrl) ?? ogImage,
      pageTitle,
      recipeNode: null,
    };
  }

  return {
    draft: emptyDraft(pageTitle ?? "Imported recipe"),
    method: "none",
    complete: false,
    imageUrl: ogImage,
    pageTitle,
    recipeNode: null,
  };
}

// ---------------------------------------------------------------------------
// Focused text for AI
// ---------------------------------------------------------------------------

// Container classes used by the common recipe-card plugins (WP Recipe Maker,
// Tasty Recipes, Mediavine Create, Zip Recipes, EasyRecipe, Jetpack, …).
const RECIPE_CARD_RE =
  /<[a-z][a-z0-9]*\b[^>]*\bclass\s*=\s*["'][^"']*\b(?:wprm-recipe-container|wprm-recipe|tasty-recipes|mv-create-card|zlrecipe-container|easyrecipe|jetpack-recipe|wp-block-recipe-card|recipe-card|cooked-recipe)\b/i;

// Ingredient-section headings across the languages Simmeri users write in.
const INGREDIENT_HEADING_RE =
  /\b(?:ingredients?|bahan(?:-bahan)?|bahan yang (?:dibutuhkan|diperlukan)|zutaten|ingrédients|ingredientes|ingrediënten)\b/gi;

// Quantity-looking tokens ("2 cups", "100 g", "1/2 sdt", "3 siung") — used to
// tell the real ingredient list apart from a story that merely mentions
// "ingredients".
const QUANTITY_RE =
  /(?:\d+(?:[.,/]\d+)?|[½¼¾⅓⅔⅛])\s*(?:g|gr|gram|kg|ml|l|liter|cups?|tbsp|tsp|tablespoons?|teaspoons?|oz|lbs?|pounds?|sdm|sdt|siung|buah|butir|lembar|batang|ruas|ikat|cloves?|pinch)\b/gi;

const LOOKBACK_CHARS = 600;
const SCORE_WINDOW_CHARS = 1500;

function countMatches(re: RegExp, text: string): number {
  re.lastIndex = 0;
  return text.match(re)?.length ?? 0;
}

// Picks the start of the most recipe-like region of a page's readable text:
// the ingredient heading followed by the most quantity-looking tokens (ties
// go to the later one, since recipe cards sit below the story). Returns 0
// when there is no plausible heading.
export function findRecipeTextStart(text: string): number {
  let best = { index: -1, score: 0 };
  INGREDIENT_HEADING_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = INGREDIENT_HEADING_RE.exec(text)) !== null) {
    const score = countMatches(QUANTITY_RE, text.slice(m.index, m.index + SCORE_WINDOW_CHARS));
    if (score > 0 && score >= best.score) best = { index: m.index, score };
  }
  return best.index < 0 ? 0 : Math.max(0, best.index - LOOKBACK_CHARS);
}

export interface AiInput {
  text: string;
  truncated: boolean;
}

// Builds the text sent to AI for a web page: the page title, any (partial)
// schema.org data as a hint, then readable text starting from the recipe
// card or the most recipe-like ingredient section — instead of the top of
// the page, where blogs put long stories that crowd out the recipe.
export function buildAiInputFromHtml(
  html: string,
  maxChars: number,
  recipeNode: JsonLdNode | null = null,
): AiInput {
  const parts: string[] = [];
  const title = extractPageTitle(html);
  if (title) parts.push(`Page title: ${title}`);

  if (recipeNode) {
    const hint = JSON.stringify(recipeNode).slice(0, 4000);
    parts.push(`Structured recipe data found on the page (may be incomplete):\n${hint}`);
  }

  const card = RECIPE_CARD_RE.exec(html);
  let body: string;
  if (card) {
    body = htmlToReadableText(html.slice(card.index));
  } else {
    const full = htmlToReadableText(html);
    body = full.slice(findRecipeTextStart(full));
  }

  const header = parts.join("\n\n");
  const budget = Math.max(0, maxChars - header.length - 2);
  const truncated = body.length > budget;
  const text = [header, body.slice(0, budget)].filter(Boolean).join("\n\n");
  return { text, truncated };
}
