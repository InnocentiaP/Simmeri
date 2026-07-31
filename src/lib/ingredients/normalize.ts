// Pure text normalization for the canonical-ingredient matching pipeline
// (Wave 3 Checkpoint 3.1 — see
// docs/plans/WAVE_3_CANONICAL_INGREDIENTS_AND_RECOMMENDATIONS_PLAN.md,
// section D). Deliberately a NEW, separate function from the four existing
// normalizers in src/lib/readiness.ts, src/lib/shopping-merge.ts, and
// src/lib/kitchen-update-plan.ts — unifying those is an explicit, optional
// post-Wave-3 cleanup (plan section P), not part of this checkpoint, so
// none of them are touched or replaced here. Nothing in the running app
// calls this yet.
//
// Normalizes: trim -> lowercase -> collapse internal whitespace -> strip
// diacritics (native Unicode NFD decomposition + combining-mark removal —
// no dependency, no Postgres `unaccent` extension needed, since this runs
// before every write/lookup in TypeScript rather than at query time) ->
// strip trailing punctuation. Internal punctuation (e.g. the hyphen in
// "all-purpose flour") is never touched — only punctuation at the very end
// of the string is stripped.
const TRAILING_PUNCTUATION_RE = /[.,;:!?'"]+$/;
// Unicode "Combining Diacritical Marks" block (code points 0x0300-0x036F) —
// matches the marks NFD decomposition splits off of accented characters
// (e.g. "e" + a combining acute accent mark from decomposed "e"-acute).
// Built from numeric code points (rather than a literal escape sequence in
// the regex source) so the exact character range is unambiguous regardless
// of editor/terminal rendering of combining marks.
const COMBINING_MARK_RANGE_START = String.fromCharCode(0x0300);
const COMBINING_MARK_RANGE_END = String.fromCharCode(0x036f);
const DIACRITIC_MARKS_RE = new RegExp(`[${COMBINING_MARK_RANGE_START}-${COMBINING_MARK_RANGE_END}]`, "g");

export function normalizeForCanonicalMatch(text: string): string {
  const collapsed = text.trim().toLowerCase().replace(/\s+/g, " ");
  const withoutDiacritics = collapsed.normalize("NFD").replace(DIACRITIC_MARKS_RE, "");
  return withoutDiacritics.replace(TRAILING_PUNCTUATION_RE, "").trim();
}
