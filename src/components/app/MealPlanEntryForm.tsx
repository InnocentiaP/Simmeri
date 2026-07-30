import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { createMealPlanEntry, updateMealPlanEntry, type MealPlanEntry, type Recipe } from "@/lib/api";
import { MEAL_SLOT_ORDER, formatDateKey } from "@/lib/date-range";

const mealPlanEntrySchema = z.object({
  plannedDate: z.string().min(1, "Date is required"),
  mealType: z.enum(MEAL_SLOT_ORDER),
  servings: z.number().int().positive().nullable(),
  notes: z.string().trim().max(2000, "Keep notes under 2000 characters").nullable(),
});
type MealPlanEntryFormValues = z.infer<typeof mealPlanEntrySchema>;

interface MealPlanEntryFormProps {
  mode: "create" | "edit";
  recipe: Pick<Recipe, "id" | "title" | "servings">;
  entry?: MealPlanEntry;
  defaultDate?: string;
  defaultMealType?: string;
  defaultServings?: number | null;
  defaultNotes?: string | null;
  onDone: () => void;
  onClose: () => void;
}

// Dual create/edit form for a single meal-plan entry, modeled directly on
// CookingHistoryForm.tsx's create/edit-mode pattern. "Move" and "Duplicate"
// both reuse this same form: Move opens it in edit mode against the
// existing row; Duplicate opens it in create mode with the source entry's
// recipe/servings/notes pre-filled but no entry id, so saving inserts a new
// row rather than mutating the original.
export function MealPlanEntryForm({
  mode,
  recipe,
  entry,
  defaultDate,
  defaultMealType,
  defaultServings,
  defaultNotes,
  onDone,
  onClose,
}: MealPlanEntryFormProps) {
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<MealPlanEntryFormValues>({
    resolver: zodResolver(mealPlanEntrySchema),
    defaultValues: {
      plannedDate: entry?.planned_date ?? defaultDate ?? formatDateKey(new Date()),
      mealType: (entry?.meal_type ?? defaultMealType ?? "dinner") as MealPlanEntryFormValues["mealType"],
      servings: entry?.servings ?? defaultServings ?? null,
      notes: entry?.notes ?? defaultNotes ?? null,
    },
  });

  async function onSubmit(values: MealPlanEntryFormValues) {
    if (submitting || !user) return;
    setSubmitting(true);
    try {
      const notes = values.notes?.trim() || null;

      if (mode === "edit" && entry) {
        await updateMealPlanEntry(entry.id, {
          plannedDate: values.plannedDate,
          mealType: values.mealType,
          servings: values.servings,
          notes,
        });
        toast.success("Meal plan entry updated");
      } else {
        await createMealPlanEntry({
          userId: user.id,
          recipeId: recipe.id,
          plannedDate: values.plannedDate,
          mealType: values.mealType,
          servings: values.servings,
          notes,
        });
        toast.success("Added to your meal plan");
      }
      onDone();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't save this meal plan entry.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={mode === "create" ? "Add to meal plan" : "Edit meal plan entry"}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <div className="w-full max-w-md rounded-3xl bg-background p-6 shadow-[var(--shadow-paper)]">
        <h3 className="mb-1 font-display text-lg font-semibold text-cocoa">
          {mode === "create" ? "Add to meal plan" : "Edit meal plan entry"}
        </h3>
        <p className="mb-4 text-sm text-cocoa/70">{recipe.title}</p>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-cocoa">Date</span>
            <input
              type="date"
              {...register("plannedDate")}
              className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
            />
            {errors.plannedDate && (
              <span className="text-xs text-terracotta">{errors.plannedDate.message}</span>
            )}
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-cocoa">Meal</span>
            <select
              {...register("mealType")}
              className="rounded-xl border border-border bg-background px-3 py-2 text-sm capitalize"
            >
              {MEAL_SLOT_ORDER.map((slot) => (
                <option key={slot} value={slot} className="capitalize">
                  {slot[0].toUpperCase() + slot.slice(1)}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-cocoa">
              Servings (optional{recipe.servings != null ? ` — recipe default: ${recipe.servings}` : ""})
            </span>
            <input
              type="number"
              min={1}
              {...register("servings", {
                setValueAs: (v) => (v === "" || v == null ? null : Number(v)),
              })}
              className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
            />
            {errors.servings && (
              <span className="text-xs text-terracotta">{errors.servings.message}</span>
            )}
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-cocoa">Notes (optional)</span>
            <textarea
              rows={2}
              {...register("notes", { setValueAs: (v) => (v === "" ? null : v) })}
              className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
              placeholder="Anything to remember for this one…"
            />
            {errors.notes && <span className="text-xs text-terracotta">{errors.notes.message}</span>}
          </label>

          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-border px-4 py-2 text-sm text-cocoa"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-full bg-olive-deep px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-olive disabled:opacity-60"
            >
              {submitting ? "Saving…" : mode === "create" ? "Add" : "Save changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
