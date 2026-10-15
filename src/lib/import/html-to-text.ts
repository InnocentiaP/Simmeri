// Pure HTML-to-readable-text reducer for the AI URL-import path only. Not a
// full HTML parser/DOM library — deliberately regex-based, matching the
// existing convention in ./jsonld-extract.ts (a narrow, scoped need doesn't
// justify a new dependency). Gemini never fetches a URL itself; it only ever
// receives this already-cleaned, truncated text (see ./gemini-prompt.ts and
// ./recipe-ai-import.functions.ts).
const BLOCK_TAGS = ["script", "style", "nav", "header", "footer", "noscript"];

function stripBlockTags(html: string): string {
  let result = html;
  for (const tag of BLOCK_TAGS) {
    const re = new RegExp(`<${tag}[^>]*>[\\s\\S]*?<\\/${tag}>`, "gi");
    result = result.replace(re, " ");
  }
  return result;
}

function stripRemainingTags(html: string): string {
  return html.replace(/<[^>]+>/g, " ");
}

// Named entities that commonly appear in recipe pages (quotes, dashes,
// fractions, degrees). Anything not listed is left as-is rather than guessed.
const NAMED_ENTITIES: Record<string, string> = {
  nbsp: " ",
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  deg: "°",
  frac12: "½",
  frac14: "¼",
  frac34: "¾",
  frac13: "⅓",
  frac23: "⅔",
  frac18: "⅛",
  times: "×",
  eacute: "é",
  egrave: "è",
  ntilde: "ñ",
  uuml: "ü",
  ouml: "ö",
  auml: "ä",
};

// Decodes named entities from the table above plus every numeric entity
// (&#8217; / &#x2019;). Used for page text and for strings inside JSON-LD,
// which many sites HTML-escape.
export function decodeHtmlEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi, (match, body: string) => {
    if (body[0] === "#") {
      const code =
        body[1] === "x" || body[1] === "X"
          ? parseInt(body.slice(2), 16)
          : parseInt(body.slice(1), 10);
      if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff) return match;
      try {
        return String.fromCodePoint(code);
      } catch {
        return match;
      }
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? match;
  });
}

// Strips tags from a short HTML fragment (e.g. a JSON-LD instruction that
// contains <p> or <br>) and decodes entities. Line breaks are kept as
// spaces; callers split on structure before calling this.
export function cleanHtmlFragment(fragment: string): string {
  return collapseWhitespace(decodeHtmlEntities(stripRemainingTags(fragment)));
}

// Full readable text of a page, without truncation.
export function htmlToReadableText(html: string): string {
  return collapseWhitespace(decodeHtmlEntities(stripRemainingTags(stripBlockTags(html))));
}

function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export interface StripHtmlResult {
  text: string;
  truncated: boolean;
}

// Strips script/style/nav/header/footer/noscript blocks entirely, strips
// remaining tags, decodes a small set of common entities, collapses
// whitespace, then truncates to maxChars — reporting whether truncation
// occurred so the caller can surface a "this page was long" notice.
export function stripHtmlToReadableText(html: string, maxChars: number): StripHtmlResult {
  const collapsed = htmlToReadableText(html);

  if (collapsed.length <= maxChars) {
    return { text: collapsed, truncated: false };
  }
  return { text: collapsed.slice(0, maxChars), truncated: true };
}
