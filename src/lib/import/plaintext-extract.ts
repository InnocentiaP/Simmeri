import { emptyDraft, type ExtractedRecipeDraft } from "./types";
import { parseIngredientLine } from "./ingredient-parse";

const INGREDIENTS_HEADER = /^ingredients?:?$/i;
const STEPS_HEADER = /^(steps?|instructions?|directions?|methods?):?$/i;
const LIST_MARKER = /^[-*•]\s*|^\d+[.)]\s*/;

export interface PlainTextExtraction {
  draft: ExtractedRecipeDraft;
  warnings: string[];
}

// Pure, client-safe: operates only on the user's own pasted text, so this is
// not a security boundary and needs no server round-trip.
export function extractDraftFromPlainText(text: string): PlainTextExtraction {
  const lines = text.split(/\r?\n/).map((l) => l.trim());
  const warnings: string[] = [];

  const firstNonEmptyIdx = lines.findIndex((l) => l.length > 0);
  const title = firstNonEmptyIdx >= 0 ? lines[firstNonEmptyIdx] : "";
  const draft = emptyDraft(title || "Untitled import");

  const ingredientsIdx = lines.findIndex((l) => INGREDIENTS_HEADER.test(l));
  const stepsIdx = lines.findIndex((l) => STEPS_HEADER.test(l));

  if (ingredientsIdx === -1 && stepsIdx === -1) {
    const bodyLines = lines
      .slice(firstNonEmptyIdx + 1)
      .filter((l) => l.length > 0);
    if (bodyLines.length > 0) {
      draft.steps = [{ instruction: bodyLines.join(" ") }];
    }
    warnings.push(
      "Couldn't detect ingredients/steps sections — added everything as one step for you to split up.",
    );
    return { draft, warnings };
  }

  if (ingredientsIdx !== -1) {
    const end = stepsIdx !== -1 && stepsIdx > ingredientsIdx ? stepsIdx : lines.length;
    const rows = lines
      .slice(ingredientsIdx + 1, end)
      .filter((l) => l.length > 0)
      .map((l) => l.replace(LIST_MARKER, "").trim())
      .filter((l) => l.length > 0);
    if (rows.length === 0) {
      warnings.push("No ingredients detected under the \"Ingredients\" heading.");
    }
    draft.ingredients = rows.map((line) => ({
      ...parseIngredientLine(line),
      importance: "core" as const,
    }));
  }

  if (stepsIdx !== -1) {
    const rows = lines
      .slice(stepsIdx + 1)
      .filter((l) => l.length > 0)
      .map((l) => l.replace(LIST_MARKER, "").trim())
      .filter((l) => l.length > 0);
    if (rows.length === 0) {
      warnings.push("No steps detected under the \"Steps\" heading.");
    }
    draft.steps = rows.map((instruction) => ({ instruction }));
  }

  return { draft, warnings };
}
