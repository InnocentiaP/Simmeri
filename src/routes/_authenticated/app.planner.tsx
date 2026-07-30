import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import {
  listMealPlanEntriesInRange,
  listRecipesByIds,
  listRecipeIngredientsForRecipeIds,
  listKitchenItems,
  updateMealPlanEntry,
  deleteMealPlanEntry,
  getMostRecentCookingHistoryId,
  type MealPlanEntry,
  type Recipe,
} from "@/lib/api";
import { computeReadiness, type Importance, type ReadinessResult } from "@/lib/readiness";
import {
  formatDateKey,
  parseDateKey,
  getWeekRange,
  eachDayOfWeek,
  previousPeriod,
  nextPeriod,
  type PlannerView,
} from "@/lib/date-range";
import { RecipePicker } from "@/components/app/RecipePicker";
import { MealPlanEntryForm } from "@/components/app/MealPlanEntryForm";
import { CookingHistoryForm } from "@/components/app/CookingHistoryForm";
import { MealPlanDayView } from "@/components/app/MealPlanDayView";
import { MealPlanWeekView } from "@/components/app/MealPlanWeekView";

const searchSchema = z.object({
  view: z.enum(["day", "week"]).optional().default("day"),
  date: z.string().optional(),
});

export const Route = createFileRoute("/_authenticated/app/planner")({
  validateSearch: searchSchema,
  head: () => ({ meta: [{ title: "Meal Plan — Simmeri" }] }),
  component: PlannerPage,
});

interface PickerState {
  dateKey: string;
  mealType?: string;
}

interface EntryFormState {
  mode: "create" | "edit";
  recipe: Recipe;
  entry?: MealPlanEntry;
  defaultDate?: string;
  defaultMealType?: string;
  defaultServings?: number | null;
  defaultNotes?: string | null;
}

function PlannerPage() {
  const { view, date: dateParam } = Route.useSearch();
  const navigate = Route.useNavigate();
  const qc = useQueryClient();

  const anchorDate = dateParam ? parseDateKey(dateParam) : new Date();

  const [picker, setPicker] = useState<PickerState | null>(null);
  const [entryForm, setEntryForm] = useState<EntryFormState | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<MealPlanEntry | null>(null);
  const [cookingEntry, setCookingEntry] = useState<MealPlanEntry | null>(null);

  const { start, end } =
    view === "week" ? getWeekRange(anchorDate, 1) : { start: anchorDate, end: anchorDate };
  const startKey = formatDateKey(start);
  const endKey = formatDateKey(end);

  const entriesQuery = useQuery({
    queryKey: ["meal-plan-entries", startKey, endKey],
    queryFn: () => listMealPlanEntriesInRange(startKey, endKey),
  });
  const entries = useMemo(() => entriesQuery.data ?? [], [entriesQuery.data]);

  const recipeIds = useMemo(() => Array.from(new Set(entries.map((e) => e.recipe_id))), [entries]);

  const recipesQuery = useQuery({
    queryKey: ["recipes-by-ids", recipeIds],
    queryFn: () => listRecipesByIds(recipeIds),
    enabled: recipeIds.length > 0,
  });
  const ingredientsQuery = useQuery({
    queryKey: ["recipe-ingredients-for-ids", recipeIds],
    queryFn: () => listRecipeIngredientsForRecipeIds(recipeIds),
    enabled: recipeIds.length > 0,
  });
  const kitchenQuery = useQuery({
    queryKey: ["kitchen-items-active"],
    queryFn: () => listKitchenItems(false),
  });

  const recipesById = useMemo(() => {
    const map = new Map<string, Recipe>();
    for (const r of recipesQuery.data ?? []) map.set(r.id, r);
    return map;
  }, [recipesQuery.data]);

  const readinessById = useMemo(() => {
    const map = new Map<string, ReadinessResult>();
    const ingredients = ingredientsQuery.data ?? [];
    const kitchen = kitchenQuery.data ?? [];
    for (const recipeId of recipeIds) {
      const forRecipe = ingredients
        .filter((i) => i.recipe_id === recipeId)
        .map((i) => ({ display_name: i.display_name, importance: i.importance as Importance }));
      map.set(recipeId, computeReadiness(forRecipe, kitchen));
    }
    return map;
  }, [ingredientsQuery.data, kitchenQuery.data, recipeIds]);

  const entriesByDate = useMemo(() => {
    const map = new Map<string, MealPlanEntry[]>();
    for (const e of entries) map.set(e.planned_date, [...(map.get(e.planned_date) ?? []), e]);
    return map;
  }, [entries]);

  function goTo(nextDate: Date, nextView?: PlannerView) {
    navigate({ search: (prev) => ({ ...prev, date: formatDateKey(nextDate), view: nextView ?? prev.view }) });
  }

  function invalidateEntries() {
    qc.invalidateQueries({ queryKey: ["meal-plan-entries"] });
  }

  const skipMut = useMutation({
    mutationFn: (entry: MealPlanEntry) => updateMealPlanEntry(entry.id, { status: "skipped" }),
    onSuccess: () => {
      toast.success("Marked as skipped");
      invalidateEntries();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const removeMut = useMutation({
    mutationFn: (entry: MealPlanEntry) => deleteMealPlanEntry(entry.id),
    onSuccess: () => {
      toast.success("Removed from meal plan");
      setConfirmRemove(null);
      invalidateEntries();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  // Marking an entry Cooked reuses the existing CookingHistoryForm unchanged
  // — this only links the cooking_history row it creates back to the entry
  // afterward, via the most-recently-created history row for this recipe.
  const cookMut = useMutation({
    mutationFn: async (entry: MealPlanEntry) => {
      const historyId = await getMostRecentCookingHistoryId(entry.recipe_id);
      await updateMealPlanEntry(entry.id, { status: "cooked", cookingHistoryId: historyId });
    },
    onSuccess: () => {
      toast.success("Marked as cooked");
      invalidateEntries();
      qc.invalidateQueries({ queryKey: ["cooking-history"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const actions = {
    onAdd: (dateKey: string, mealType?: string) => setPicker({ dateKey, mealType }),
    onEdit: (entry: MealPlanEntry) => {
      const recipe = recipesById.get(entry.recipe_id);
      if (!recipe) return;
      setEntryForm({ mode: "edit", recipe, entry });
    },
    onDuplicate: (entry: MealPlanEntry) => {
      const recipe = recipesById.get(entry.recipe_id);
      if (!recipe) return;
      setEntryForm({
        mode: "create",
        recipe,
        defaultDate: entry.planned_date,
        defaultMealType: entry.meal_type,
        defaultServings: entry.servings,
        defaultNotes: entry.notes,
      });
    },
    onSkip: (entry: MealPlanEntry) => skipMut.mutate(entry),
    onCook: (entry: MealPlanEntry) => setCookingEntry(entry),
    onRemove: (entry: MealPlanEntry) => setConfirmRemove(entry),
  };

  const isLoading = entriesQuery.isLoading || (recipeIds.length > 0 && (recipesQuery.isLoading || ingredientsQuery.isLoading));
  const hasError = Boolean(entriesQuery.error || recipesQuery.error || ingredientsQuery.error || kitchenQuery.error);

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold text-olive-deep">Meal Plan</h1>
          <p className="text-sm text-cocoa/70">
            {view === "week"
              ? `${start.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${end.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`
              : anchorDate.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex overflow-hidden rounded-full border border-border">
            <button
              type="button"
              onClick={() => goTo(anchorDate, "day")}
              className={`px-3 py-1.5 text-sm ${view === "day" ? "bg-olive-deep text-primary-foreground" : "text-cocoa"}`}
            >
              Day
            </button>
            <button
              type="button"
              onClick={() => goTo(anchorDate, "week")}
              className={`px-3 py-1.5 text-sm ${view === "week" ? "bg-olive-deep text-primary-foreground" : "text-cocoa"}`}
            >
              Week
            </button>
          </div>
          <button
            type="button"
            onClick={() => goTo(previousPeriod(anchorDate, view))}
            aria-label="Previous"
            className="rounded-full border border-border p-2 text-cocoa hover:bg-cream-deep/40"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => goTo(new Date())}
            className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-sm text-cocoa hover:bg-cream-deep/40"
          >
            <CalendarDays className="h-3.5 w-3.5" /> Today
          </button>
          <button
            type="button"
            onClick={() => goTo(nextPeriod(anchorDate, view))}
            aria-label="Next"
            className="rounded-full border border-border p-2 text-cocoa hover:bg-cream-deep/40"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </header>

      {hasError && (
        <div className="mb-4 rounded-xl border border-terracotta/40 bg-terracotta/5 p-4 text-terracotta">
          Failed to load your meal plan. Refresh to try again.
        </div>
      )}

      {isLoading && !hasError && <div className="text-cocoa/70">Loading…</div>}

      {!isLoading && !hasError && view === "day" && (
        <MealPlanDayView
          date={anchorDate}
          entries={entries}
          recipesById={recipesById}
          readinessById={readinessById}
          {...actions}
        />
      )}

      {!isLoading && !hasError && view === "week" && (
        <MealPlanWeekView
          days={eachDayOfWeek(anchorDate, 1)}
          entriesByDate={entriesByDate}
          recipesById={recipesById}
          readinessById={readinessById}
          {...actions}
        />
      )}

      {picker && (
        <RecipePicker
          onSelect={(recipe) => {
            const p = picker;
            setPicker(null);
            if (p) {
              setEntryForm({ mode: "create", recipe, defaultDate: p.dateKey, defaultMealType: p.mealType });
            }
          }}
          onClose={() => setPicker(null)}
        />
      )}

      {entryForm && (
        <MealPlanEntryForm
          mode={entryForm.mode}
          recipe={entryForm.recipe}
          entry={entryForm.entry}
          defaultDate={entryForm.defaultDate}
          defaultMealType={entryForm.defaultMealType}
          defaultServings={entryForm.defaultServings}
          defaultNotes={entryForm.defaultNotes}
          onDone={() => {
            setEntryForm(null);
            invalidateEntries();
          }}
          onClose={() => setEntryForm(null)}
        />
      )}

      {cookingEntry && (
        <CookingHistoryForm
          mode="create"
          recipeId={cookingEntry.recipe_id}
          onDone={() => {
            const entry = cookingEntry;
            setCookingEntry(null);
            if (entry) cookMut.mutate(entry);
          }}
          onClose={() => setCookingEntry(null)}
        />
      )}

      {confirmRemove && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        >
          <div className="w-full max-w-sm rounded-3xl bg-background p-6 shadow-[var(--shadow-paper)]">
            <h3 className="font-display text-lg font-semibold text-cocoa">Remove this entry?</h3>
            <p className="mt-1 text-sm text-cocoa/70">This only removes it from your meal plan — the recipe itself is untouched.</p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmRemove(null)}
                className="rounded-full border border-border px-4 py-2 text-sm text-cocoa"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={removeMut.isPending}
                onClick={() => removeMut.mutate(confirmRemove)}
                className="rounded-full bg-terracotta px-4 py-2 text-sm font-medium text-white hover:bg-terracotta/90 disabled:opacity-60"
              >
                {removeMut.isPending ? "Removing…" : "Remove"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
