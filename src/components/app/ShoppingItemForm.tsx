import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { createShoppingListItem, updateShoppingListItem, type ShoppingListItem } from "@/lib/api";

const shoppingItemSchema = z.object({
  displayName: z.string().trim().min(1, "Name is required").max(120, "Keep it under 120 characters"),
  quantityText: z.string().trim().max(60, "Keep it under 60 characters").nullable(),
  unit: z.string().trim().max(40, "Keep it under 40 characters").nullable(),
  note: z.string().trim().max(1000, "Keep notes under 1000 characters").nullable(),
});
type ShoppingItemFormValues = z.infer<typeof shoppingItemSchema>;

interface ShoppingItemFormProps {
  mode: "create" | "edit";
  shoppingListId: string;
  item?: ShoppingListItem;
  onDone: () => void;
  onClose: () => void;
}

// Dual create/edit form for a manually-managed shopping-list item — no
// provenance, no sources; that's Checkpoint 3. Modeled on CookingHistoryForm
// /MealPlanEntryForm's create/edit-mode pattern.
export function ShoppingItemForm({ mode, shoppingListId, item, onDone, onClose }: ShoppingItemFormProps) {
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ShoppingItemFormValues>({
    resolver: zodResolver(shoppingItemSchema),
    defaultValues: {
      displayName: item?.display_name ?? "",
      quantityText: item?.quantity_text ?? null,
      unit: item?.unit ?? null,
      note: item?.note ?? null,
    },
  });

  async function onSubmit(values: ShoppingItemFormValues) {
    if (submitting || !user) return;
    setSubmitting(true);
    try {
      const quantityText = values.quantityText?.trim() || null;
      const unit = values.unit?.trim() || null;
      const note = values.note?.trim() || null;

      if (mode === "edit" && item) {
        await updateShoppingListItem(item.id, {
          displayName: values.displayName.trim(),
          quantityText,
          unit,
          note,
        });
        toast.success("Item updated");
      } else {
        await createShoppingListItem({
          userId: user.id,
          shoppingListId,
          displayName: values.displayName.trim(),
          quantityText,
          unit,
          note,
        });
        toast.success("Item added");
      }
      onDone();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't save this item.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={mode === "create" ? "Add item" : "Edit item"}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <div className="w-full max-w-md rounded-3xl bg-background p-6 shadow-[var(--shadow-paper)]">
        <h3 className="mb-4 font-display text-lg font-semibold text-cocoa">
          {mode === "create" ? "Add item" : "Edit item"}
        </h3>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-cocoa">Name</span>
            <input
              {...register("displayName")}
              autoFocus
              className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
            />
            {errors.displayName && (
              <span className="text-xs text-terracotta">{errors.displayName.message}</span>
            )}
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-cocoa">Quantity (optional)</span>
              <input
                {...register("quantityText", { setValueAs: (v) => (v === "" ? null : v) })}
                placeholder="e.g. 2"
                className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
              />
              {errors.quantityText && (
                <span className="text-xs text-terracotta">{errors.quantityText.message}</span>
              )}
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-cocoa">Unit (optional)</span>
              <input
                {...register("unit", { setValueAs: (v) => (v === "" ? null : v) })}
                placeholder="e.g. cups"
                className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
              />
              {errors.unit && <span className="text-xs text-terracotta">{errors.unit.message}</span>}
            </label>
          </div>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-cocoa">Note (optional)</span>
            <textarea
              rows={2}
              {...register("note", { setValueAs: (v) => (v === "" ? null : v) })}
              className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
              placeholder="e.g. get the low-sodium kind"
            />
            {errors.note && <span className="text-xs text-terracotta">{errors.note.message}</span>}
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
