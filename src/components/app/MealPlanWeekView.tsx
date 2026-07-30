import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Plus, Pencil } from "lucide-react";
import { formatDateKey, isToday } from "@/lib/date-range";
import { readinessTone, type ReadinessResult } from "@/lib/readiness";
import type { MealPlanEntry, Recipe } from "@/lib/api";
import { MealPlanEntryRow, type MealPlanActions } from "@/components/app/MealPlanDayView";

interface MealPlanWeekViewProps extends MealPlanActions {
  days: Date[];
  entriesByDate: Map<string, MealPlanEntry[]>;
  recipesById: Map<string, Recipe>;
  readinessById: Map<string, ReadinessResult>;
}

// Desktop: a 7-column grid (one column per day). Mobile: day tabs plus a
// single-day list below — a dense 7-column grid is unusable at phone
// widths, so this deliberately does not force the desktop layout down to
// small screens (matching the brief's explicit "no dense desktop calendar
// grid on mobile" requirement).
export function MealPlanWeekView({
  days,
  entriesByDate,
  recipesById,
  readinessById,
  onAdd,
  onEdit,
  onDuplicate,
  onSkip,
  onCook,
  onRemove,
}: MealPlanWeekViewProps) {
  const [selectedDayKey, setSelectedDayKey] = useState(() => formatDateKey(days.find(isToday) ?? days[0]));

  return (
    <div>
      {/* Mobile: day tabs */}
      <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1 md:hidden">
        {days.map((day) => {
          const key = formatDateKey(day);
          const active = key === selectedDayKey;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setSelectedDayKey(key)}
              className={`flex shrink-0 flex-col items-center rounded-xl px-3 py-1.5 text-xs ${
                active ? "bg-olive-deep text-primary-foreground" : "border border-border text-cocoa"
              }`}
            >
              <span className="font-medium">{day.toLocaleDateString(undefined, { weekday: "short" })}</span>
              <span>{day.getDate()}</span>
            </button>
          );
        })}
      </div>

      <div className="md:hidden">
        <DayColumn
          day={days.find((d) => formatDateKey(d) === selectedDayKey) ?? days[0]}
          entries={entriesByDate.get(selectedDayKey) ?? []}
          recipesById={recipesById}
          readinessById={readinessById}
          onAdd={onAdd}
          onEdit={onEdit}
          onDuplicate={onDuplicate}
          onSkip={onSkip}
          onCook={onCook}
          onRemove={onRemove}
        />
      </div>

      {/* Desktop: 7-column grid */}
      <div className="hidden gap-3 md:grid md:grid-cols-7">
        {days.map((day) => {
          const key = formatDateKey(day);
          return (
            <DayColumn
              key={key}
              day={day}
              entries={entriesByDate.get(key) ?? []}
              recipesById={recipesById}
              readinessById={readinessById}
              onAdd={onAdd}
              onEdit={onEdit}
              onDuplicate={onDuplicate}
              onSkip={onSkip}
              onCook={onCook}
              onRemove={onRemove}
              compact
            />
          );
        })}
      </div>
    </div>
  );
}

interface DayColumnProps extends MealPlanActions {
  day: Date;
  entries: MealPlanEntry[];
  recipesById: Map<string, Recipe>;
  readinessById: Map<string, ReadinessResult>;
  compact?: boolean;
}

function DayColumn({
  day,
  entries,
  recipesById,
  readinessById,
  onAdd,
  onEdit,
  onDuplicate,
  onSkip,
  onCook,
  onRemove,
  compact,
}: DayColumnProps) {
  const dateKey = formatDateKey(day);
  const sorted = [...entries].sort((a, b) => a.position - b.position);

  return (
    <div className={`rounded-2xl border p-3 ${isToday(day) ? "border-olive-deep/40 bg-olive-deep/5" : "border-border/70 bg-background"}`}>
      <div className="mb-2 flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-cocoa/60">
            {day.toLocaleDateString(undefined, { weekday: "short" })}
          </p>
          <p className="text-sm font-semibold text-cocoa">{day.toLocaleDateString(undefined, { month: "short", day: "numeric" })}</p>
        </div>
        <button
          type="button"
          onClick={() => onAdd(dateKey)}
          aria-label={`Add a recipe on ${dateKey}`}
          className="rounded-full border border-border p-1 text-cocoa hover:bg-cream-deep/40"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      {sorted.length === 0 ? (
        <p className="text-xs text-cocoa/50">Nothing planned.</p>
      ) : compact ? (
        <ul className="flex flex-col gap-1.5">
          {sorted.map((entry) => {
            const recipe = recipesById.get(entry.recipe_id);
            const readiness = readinessById.get(entry.recipe_id);
            return (
              <li key={entry.id}>
                {/* Title is a Link (navigates to Recipe Detail); Edit is a
                    sibling icon button, not a descendant — this avoids
                    nesting an <a> inside a <button> (or vice versa), so no
                    stopPropagation is needed and both stay independently
                    keyboard-operable. Previously the whole card was one
                    button that only opened Edit; that shortcut is preserved
                    here via the dedicated pencil icon. */}
                <div className="rounded-lg border border-border/60 p-1.5 text-xs hover:bg-cream-deep/40">
                  <div className="flex items-start justify-between gap-1">
                    {recipe ? (
                      <Link
                        to="/app/recipes/$recipeId"
                        params={{ recipeId: entry.recipe_id }}
                        aria-label={`View recipe: ${recipe.title}`}
                        className="min-w-0 flex-1 truncate rounded font-medium text-cocoa hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-olive-deep"
                      >
                        {recipe.title}
                      </Link>
                    ) : (
                      <span className="min-w-0 flex-1 truncate font-medium text-cocoa/50">
                        Recipe unavailable
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => onEdit(entry)}
                      aria-label="Move or edit this entry"
                      title="Move / edit"
                      className="shrink-0 rounded p-0.5 text-cocoa/50 hover:bg-cream-deep/60 hover:text-cocoa focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-olive-deep"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                  </div>
                  <p className="mt-0.5 text-cocoa/50 capitalize">{entry.meal_type}</p>
                  {readiness && (
                    <span className={`mt-1 inline-block rounded-full border px-1.5 py-0.5 ${readinessTone(readiness.label)}`}>
                      {readiness.label === "ready_to_cook" ? "Ready" : readiness.label.replace(/_/g, " ")}
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <ul className="flex flex-col gap-2">
          {sorted.map((entry) => {
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
    </div>
  );
}
