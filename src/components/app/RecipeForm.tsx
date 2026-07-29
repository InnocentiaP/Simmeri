import { useForm, useFieldArray, type UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowDown, ArrowUp, Trash2, Plus } from "lucide-react";
import type { RecipeFormValues } from "@/lib/api";

const importanceEnum = z.enum(["core", "supporting", "seasoning", "optional"]);

export const recipeFormSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  description: z.string().max(2000).default(""),
  servings: z.number().int().min(1).max(99).nullable(),
  prep_time_minutes: z.number().int().min(0).max(1440).nullable(),
  cook_time_minutes: z.number().int().min(0).max(1440).nullable(),
  notes: z.string().max(4000).default(""),
  ingredients: z
    .array(
      z.object({
        display_name: z.string().trim().max(200).default(""),
        raw_text: z.string().max(400).default(""),
        quantity_text: z.string().max(60).default(""),
        unit: z.string().max(40).default(""),
        preparation_note: z.string().max(200).default(""),
        importance: importanceEnum.default("core"),
      }),
    )
    .default([]),
  steps: z
    .array(z.object({ instruction: z.string().max(1200).default("") }))
    .default([]),
});

export type RecipeFormSchema = z.infer<typeof recipeFormSchema>;

export function useRecipeForm(defaultValues?: Partial<RecipeFormValues>) {
  return useForm<RecipeFormSchema>({
    resolver: zodResolver(recipeFormSchema) as any,
    defaultValues: {
      title: defaultValues?.title ?? "",
      description: defaultValues?.description ?? "",
      servings: defaultValues?.servings ?? null,
      prep_time_minutes: defaultValues?.prep_time_minutes ?? null,
      cook_time_minutes: defaultValues?.cook_time_minutes ?? null,
      notes: defaultValues?.notes ?? "",
      ingredients:
        defaultValues?.ingredients && defaultValues.ingredients.length > 0
          ? defaultValues.ingredients
          : [
              {
                display_name: "",
                raw_text: "",
                quantity_text: "",
                unit: "",
                preparation_note: "",
                importance: "core",
              },
            ],
      steps:
        defaultValues?.steps && defaultValues.steps.length > 0
          ? defaultValues.steps
          : [{ instruction: "" }],
    },
  });
}

export function RecipeFormFields({ form }: { form: UseFormReturn<RecipeFormSchema> }) {
  const {
    register,
    control,
    formState: { errors },
  } = form;
  const ingredients = useFieldArray({ control, name: "ingredients" });
  const steps = useFieldArray({ control, name: "steps" });

  return (
    <div className="flex flex-col gap-8">
      <section className="rounded-3xl border border-border/70 bg-background p-5">
        <h2 className="mb-4 font-display text-xl font-semibold text-olive-deep">Basics</h2>
        <div className="grid gap-4">
          <Field label="Title" error={errors.title?.message}>
            <input
              {...register("title")}
              className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Description">
            <textarea
              {...register("description")}
              rows={3}
              className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
            />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Servings">
              <input
                type="number"
                min={1}
                {...register("servings", {
                  setValueAs: (v) => (v === "" || v == null ? null : Number(v)),
                })}
                className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
              />
            </Field>
            <Field label="Prep (min)">
              <input
                type="number"
                min={0}
                {...register("prep_time_minutes", {
                  setValueAs: (v) => (v === "" || v == null ? null : Number(v)),
                })}
                className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
              />
            </Field>
            <Field label="Cook (min)">
              <input
                type="number"
                min={0}
                {...register("cook_time_minutes", {
                  setValueAs: (v) => (v === "" || v == null ? null : Number(v)),
                })}
                className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
              />
            </Field>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-border/70 bg-background p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold text-olive-deep">Ingredients</h2>
          <button
            type="button"
            onClick={() =>
              ingredients.append({
                display_name: "",
                raw_text: "",
                quantity_text: "",
                unit: "",
                preparation_note: "",
                importance: "core",
              })
            }
            className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-xs text-cocoa hover:bg-cream-deep/40"
          >
            <Plus className="h-3 w-3" /> Add ingredient
          </button>
        </div>
        <ul className="flex flex-col gap-3">
          {ingredients.fields.map((f, idx) => (
            <li key={f.id} className="rounded-2xl border border-border/50 p-3">
              <div className="grid gap-2 sm:grid-cols-[2fr_1fr_1fr_1.3fr]">
                <input
                  placeholder="Ingredient name (e.g. Onion)"
                  {...register(`ingredients.${idx}.display_name`)}
                  className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm"
                />
                <input
                  placeholder="Qty"
                  {...register(`ingredients.${idx}.quantity_text`)}
                  className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm"
                />
                <input
                  placeholder="Unit"
                  {...register(`ingredients.${idx}.unit`)}
                  className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm"
                />
                <select
                  {...register(`ingredients.${idx}.importance`)}
                  className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm"
                >
                  <option value="core">Core</option>
                  <option value="supporting">Supporting</option>
                  <option value="seasoning">Seasoning</option>
                  <option value="optional">Optional</option>
                </select>
              </div>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <input
                  placeholder="Prep note (e.g. diced)"
                  {...register(`ingredients.${idx}.preparation_note`)}
                  className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm"
                />
                <input
                  placeholder="Raw text (optional)"
                  {...register(`ingredients.${idx}.raw_text`)}
                  className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm"
                />
              </div>
              <div className="mt-2 flex justify-end gap-1">
                <ReorderBtn onClick={() => idx > 0 && ingredients.move(idx, idx - 1)} dir="up" />
                <ReorderBtn
                  onClick={() => idx < ingredients.fields.length - 1 && ingredients.move(idx, idx + 1)}
                  dir="down"
                />
                <button
                  type="button"
                  aria-label="Remove ingredient"
                  onClick={() => ingredients.remove(idx)}
                  className="rounded-full border border-border p-1.5 text-terracotta hover:bg-terracotta/10"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-3xl border border-border/70 bg-background p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold text-olive-deep">Steps</h2>
          <button
            type="button"
            onClick={() => steps.append({ instruction: "" })}
            className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-xs text-cocoa hover:bg-cream-deep/40"
          >
            <Plus className="h-3 w-3" /> Add step
          </button>
        </div>
        <ol className="flex flex-col gap-3">
          {steps.fields.map((f, idx) => (
            <li key={f.id} className="flex items-start gap-2 rounded-2xl border border-border/50 p-3">
              <span className="mt-1 flex h-6 w-6 items-center justify-center rounded-full bg-olive-deep/10 text-xs font-medium text-olive-deep">
                {idx + 1}
              </span>
              <textarea
                {...register(`steps.${idx}.instruction`)}
                rows={2}
                placeholder="Describe this step…"
                className="flex-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm"
              />
              <div className="flex flex-col gap-1">
                <ReorderBtn onClick={() => idx > 0 && steps.move(idx, idx - 1)} dir="up" />
                <ReorderBtn
                  onClick={() => idx < steps.fields.length - 1 && steps.move(idx, idx + 1)}
                  dir="down"
                />
                <button
                  type="button"
                  aria-label="Remove step"
                  onClick={() => steps.remove(idx)}
                  className="rounded-full border border-border p-1.5 text-terracotta hover:bg-terracotta/10"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="rounded-3xl border border-border/70 bg-background p-5">
        <h2 className="mb-4 font-display text-xl font-semibold text-olive-deep">Personal notes</h2>
        <textarea
          {...register("notes")}
          rows={4}
          placeholder="Reminders, tips, memories…"
          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
        />
      </section>
    </div>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium text-cocoa">{label}</span>
      {children}
      {error && <span className="text-xs text-terracotta">{error}</span>}
    </label>
  );
}

function ReorderBtn({ onClick, dir }: { onClick: () => void; dir: "up" | "down" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={dir === "up" ? "Move up" : "Move down"}
      className="rounded-full border border-border p-1.5 text-cocoa hover:bg-cream-deep/40"
    >
      {dir === "up" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />}
    </button>
  );
}
