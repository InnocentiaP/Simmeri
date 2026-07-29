// Deterministic Cooking Readiness engine.
// Pure: compares recipe ingredients against kitchen items via normalized names.

export type Importance = "core" | "supporting" | "seasoning" | "optional";
export type KitchenStatus = "available" | "running_low" | "out_of_stock" | "unknown";
export type ReadinessLabel =
  | "ready_to_cook"
  | "check_first"
  | "almost_ready"
  | "needs_shopping"
  | "not_ready";

export interface ReadinessIngredient {
  id?: string;
  display_name: string;
  importance: Importance;
}

export interface ReadinessKitchenItem {
  ingredient_name: string;
  normalized_name?: string | null;
  status: KitchenStatus | string;
  archived_at?: string | null;
}

export interface ReadinessExplanation {
  available: string[];
  running_low: string[];
  needs_check: string[];
  missing_core: string[];
  missing_supporting: string[]; // supporting OR seasoning
  ignored_optional: string[];
}

export interface ReadinessResult {
  label: ReadinessLabel;
  explanation: ReadinessExplanation;
  short: string;
}

const norm = (s: string) => s.trim().toLowerCase();

export function computeReadiness(
  ingredients: ReadinessIngredient[],
  kitchenItems: ReadinessKitchenItem[],
): ReadinessResult {
  const activeKitchen = kitchenItems.filter((k) => !k.archived_at);
  const byName = new Map<string, KitchenStatus>();
  const priority: Record<KitchenStatus, number> = {
    unknown: 4,
    out_of_stock: 3,
    running_low: 2,
    available: 1,
  };
  for (const k of activeKitchen) {
    const key = k.normalized_name ?? norm(k.ingredient_name);
    const status = (["available", "running_low", "out_of_stock", "unknown"].includes(k.status)
      ? k.status
      : "unknown") as KitchenStatus;
    const prev = byName.get(key);
    if (!prev || priority[status] > priority[prev]) byName.set(key, status);
  }

  const exp: ReadinessExplanation = {
    available: [],
    running_low: [],
    needs_check: [],
    missing_core: [],
    missing_supporting: [],
    ignored_optional: [],
  };

  for (const ing of ingredients) {
    const name = ing.display_name;
    if (ing.importance === "optional") {
      exp.ignored_optional.push(name);
      continue;
    }
    const status = byName.get(norm(name));
    if (!status || status === "out_of_stock") {
      if (ing.importance === "core") exp.missing_core.push(name);
      else exp.missing_supporting.push(name); // supporting + seasoning
      continue;
    }
    if (status === "unknown") exp.needs_check.push(name);
    else if (status === "running_low") exp.running_low.push(name);
    else exp.available.push(name);
  }

  let label: ReadinessLabel;
  if (exp.missing_core.length > 0) label = "not_ready";
  else if (exp.missing_supporting.length > 0) label = "needs_shopping";
  else if (exp.needs_check.length > 0) label = "check_first";
  else if (exp.running_low.length > 0) label = "almost_ready";
  else label = "ready_to_cook";

  const short = shortLabel(label, exp);
  return { label, explanation: exp, short };
}

export function readinessDisplay(label: ReadinessLabel): string {
  switch (label) {
    case "ready_to_cook":
      return "Ready to cook";
    case "check_first":
      return "Check first";
    case "almost_ready":
      return "Almost ready";
    case "needs_shopping":
      return "Needs shopping";
    case "not_ready":
      return "Not ready";
  }
}

export function readinessTone(label: ReadinessLabel): string {
  switch (label) {
    case "ready_to_cook":
      return "bg-olive-deep/15 text-olive-deep border-olive-deep/30";
    case "almost_ready":
      return "bg-caramel/15 text-cocoa border-caramel/40";
    case "check_first":
      return "bg-caramel/10 text-cocoa border-caramel/30";
    case "needs_shopping":
      return "bg-terracotta/10 text-terracotta border-terracotta/30";
    case "not_ready":
      return "bg-cocoa/10 text-cocoa border-cocoa/30";
  }
}

function shortLabel(label: ReadinessLabel, exp: ReadinessExplanation): string {
  switch (label) {
    case "ready_to_cook":
      return "You have everything you need.";
    case "almost_ready":
      return `Running low on ${exp.running_low.length} item${exp.running_low.length === 1 ? "" : "s"}.`;
    case "check_first":
      return `Check ${exp.needs_check.length} item${exp.needs_check.length === 1 ? "" : "s"} before starting.`;
    case "needs_shopping":
      return `${exp.missing_supporting.length} item${exp.missing_supporting.length === 1 ? "" : "s"} to buy.`;
    case "not_ready":
      return `Missing ${exp.missing_core.length} core ingredient${exp.missing_core.length === 1 ? "" : "s"}.`;
  }
}
