import { Plus, Pencil, Copy, SkipForward, ChefHat, Trash2 } from "lucide-react";
import { MEAL_SLOT_ORDER, formatDateKey, type MealSlot } from "@/lib/date-range";
import { readinessDisplay, readinessTone, type ReadinessResult } from "@/lib/readiness";
import { RecipeCoverImage } from "@/components/app/RecipeCoverImage";
import type { MealPlanEntry, Recipe } from "@/lib/api";

export interface MealPlanActions {
  onAdd: (dateKey: string, mealType?: string) => void;
  onEdit: (entry: MealPlanEntry) => void;
  onDuplicate: (entry: MealPlanEntry) => void;
  onSkip: (entry: MealPlanEntry) => void;
  onCook: (entry: MealPlanEntry) => void;
  onRemove: (entry: MealPlanEntry) => void;
}

interface MealPlanDayViewProps extends MealPlanActions {
  date: Date;
  entries: MealPlanEntry[];
  recipesById: Map<string, Recipe>;
  readinessById: Map<string, ReadinessResult>;
}

const MEAL_SLOT_LABEL: Record<MealSlot, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
  other: "Other",
};

export function MealPlanDayView({
  date,
  entries,
  recipesById,
  readinessById,
  onAdd,
  onEdit,
  onDuplicate,
  onSkip,
  onCook,
  onRemove,
}: MealPlanDayViewProps) {
  const dateKey = formatDateKey(date);
  const entriesBySlot = new Map<string, MealPlanEntry[]>();
  for (const entry of entries) {
    entriesBySlot.set(entry.meal_type, [...(entriesBySlot.get(entry.meal_type) ?? []), entry]);
  }

  return (
    <div className="flex flex-col gap-4">
      {MEAL_SLOT_ORDER.map((slot) => {
        const slotEntries = (entriesBySlot.get(slot) ?? []).sort((a, b) => a.position - b.position);
        return (
          <section key={slot} className="rounded-2xl border border-border/70 bg-background p-4">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xs font-medium uppercase tracking-wide text-cocoa/60">
                {MEAL_SLOT_LABEL[slot]}
              </h3>
              <button
                type="button"
                onClick={() => onAdd(dateKey, slot)}
                aria-label={`Add a recipe for ${MEAL_SLOT_LABEL[slot]}`}
                className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs text-cocoa hover:bg-cream-deep/40"
              >
                <Plus className="h-3 w-3" /> Add
              </button>
            </div>

            {slotEntries.length === 0 ? (
              <p className="text-sm text-cocoa/50">Nothing planned.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {slotEntries.map((entry) => {
                  const recipe = recipesById.get(entry.recipe_id);
                  const readiness = readinessById.get(entry.recipe_id);
                  return (
                    <li key={entry.id}>
                      <MealPlanEntryRow
                        entry={entry}
                        recipe={recipe}
                        readiness={readiness}
                        onEdit={onEdit}
                        onDuplicate={onDuplicate}
                        onSkip={onSkip}
                        onCook={onCook}
                        onRemove={onRemove}
                      />
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}

interface MealPlanEntryRowProps extends Omit<MealPlanActions, "onAdd"> {
  entry: MealPlanEntry;
  recipe: Recipe | undefined;
  readiness: ReadinessResult | undefined;
}

export function MealPlanEntryRow({
  entry,
  recipe,
  readiness,
  onEdit,
  onDuplicate,
  onSkip,
  onCook,
  onRemove,
}: MealPlanEntryRowProps) {
  const isTerminal = entry.status === "cooked" || entry.status === "skipped" || entry.status === "cancelled";
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border/60 p-2.5">
      <RecipeCoverImage
        bucket={recipe?.cover_storage_bucket ?? null}
        path={recipe?.cover_storage_path ?? null}
        alt=""
        className="h-12 w-12 shrink-0 rounded-lg"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-cocoa">
          {recipe?.title ?? "Recipe unavailable"}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-cocoa/60">
          <span>Serves {entry.servings ?? recipe?.servings ?? "—"}</span>
          {readiness && (
            <span className={`rounded-full border px-2 py-0.5 ${readinessTone(readiness.label)}`}>
              {readinessDisplay(readiness.label)}
            </span>
          )}
          {entry.status !== "planned" && (
            <span className="rounded-full border border-border px-2 py-0.5 capitalize">{entry.status}</span>
          )}
        </div>
        {entry.notes && <p className="mt-1 truncate text-xs text-cocoa/60">{entry.notes}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {!isTerminal && (
          <>
            <button
              type="button"
              onClick={() => onEdit(entry)}
              aria-label="Move or edit this entry"
              title="Move / edit"
              className="rounded-full p-1.5 text-cocoa hover:bg-cream-deep/40"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onDuplicate(entry)}
              aria-label="Duplicate this entry"
              title="Duplicate"
              className="rounded-full p-1.5 text-cocoa hover:bg-cream-deep/40"
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onSkip(entry)}
              aria-label="Skip this entry"
              title="Skip"
              className="rounded-full p-1.5 text-cocoa hover:bg-cream-deep/40"
            >
              <SkipForward className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onCook(entry)}
              aria-label="Mark this entry as cooked"
              title="Cook"
              className="rounded-full p-1.5 text-olive-deep hover:bg-olive-deep/10"
            >
              <ChefHat className="h-3.5 w-3.5" />
            </button>
          </>
        )}
        <button
          type="button"
          onClick={() => onRemove(entry)}
          aria-label="Remove this entry"
          title="Remove"
          className="rounded-full p-1.5 text-terracotta hover:bg-terracotta/10"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
