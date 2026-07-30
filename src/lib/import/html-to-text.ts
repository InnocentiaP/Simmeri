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

function decodeBasicEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;/gi, "'");
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
  const withoutBlocks = stripBlockTags(html);
  const withoutTags = stripRemainingTags(withoutBlocks);
  const decoded = decodeBasicEntities(withoutTags);
  const collapsed = collapseWhitespace(decoded);

  if (collapsed.length <= maxChars) {
    return { text: collapsed, truncated: false };
  }
  return { text: collapsed.slice(0, maxChars), truncated: true };
}
