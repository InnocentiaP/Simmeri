import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getRecipeDetail, saveRecipe, type RecipeFormValues } from "@/lib/api";
import { RecipeFormFields, useRecipeForm, type RecipeFormSchema } from "@/components/app/RecipeForm";
import { cleanUpRecipeWithAI } from "@/lib/import/recipe-ai-edit.functions";
import type { NormalizedRecipeDraft } from "@/lib/import/ai-normalize";
import { toast } from "sonner";
import { ChevronLeft, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/_authenticated/app/recipes/$recipeId/edit")({
  head: () => ({ meta: [{ title: "Edit Recipe — Simmeri" }] }),
  component: EditRecipe,
});

function EditRecipe() {
  const { recipeId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const form = useRecipeForm();

  const { data, isLoading } = useQuery({
    queryKey: ["recipe-edit", recipeId],
    queryFn: () => getRecipeDetail(recipeId),
  });

  useEffect(() => {
    if (data) {
      form.reset({
        title: data.recipe.title,
        description: data.recipe.description ?? "",
        servings: data.recipe.servings,
        prep_time_minutes: data.recipe.prep_time_minutes,
        cook_time_minutes: data.recipe.cook_time_minutes,
        notes: data.recipe.notes ?? "",
        ingredients: data.ingredients.map((i) => ({
          display_name: i.display_name,
          raw_text: i.raw_text ?? "",
          quantity_text: i.quantity_text ?? "",
          unit: i.unit ?? "",
          preparation_note: i.preparation_note ?? "",
          importance: i.importance as "core" | "supporting" | "seasoning" | "optional",
        })),
        steps: data.steps.map((s) => ({ instruction: s.instruction })),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  // AI cleanup state. Nothing here touches the form until the user
  // explicitly clicks "Apply changes" in the review dialog — a Cancel (or
  // simply not opening the dialog) leaves the form exactly as it was,
  // including any manual edits made before "Clean up with AI" was clicked.
  const [aiProposal, setAiProposal] = useState<NormalizedRecipeDraft | null>(null);
  const [aiApplied, setAiApplied] = useState(false);
  const [preAiSnapshot, setPreAiSnapshot] = useState<RecipeFormSchema | null>(null);

  const aiMut = useMutation({
    mutationFn: async () => {
      const values = form.getValues();
      return cleanUpRecipeWithAI({
        data: {
          title: values.title,
          description: values.description,
          servings: values.servings,
          prep_time_minutes: values.prep_time_minutes,
          cook_time_minutes: values.cook_time_minutes,
          notes: values.notes,
          ingredients: values.ingredients,
          steps: values.steps,
        },
      });
    },
    onSuccess: (res) => setAiProposal(res.draft),
    onError: (e: Error) => toast.error(e.message),
  });

  function handleApplyAiProposal() {
    if (!aiProposal) return;
    setPreAiSnapshot(form.getValues());
    form.reset(aiProposal as RecipeFormSchema);
    setAiApplied(true);
    setAiProposal(null);
    toast.success("AI changes applied — review before saving");
  }

  function handleCancelAiProposal() {
    setAiProposal(null);
  }

  function handleResetToOriginal() {
    if (preAiSnapshot) form.reset(preAiSnapshot);
    setAiApplied(false);
  }

  const mut = useMutation({
    mutationFn: async (v: RecipeFormValues) => saveRecipe(v, recipeId),
    onSuccess: () => {
      toast.success("Recipe updated");
      qc.invalidateQueries();
      navigate({ to: "/app/recipes/$recipeId", params: { recipeId } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <div className="text-cocoa/70">Loading…</div>;

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        to="/app/recipes/$recipeId"
        params={{ recipeId }}
        className="mb-4 inline-flex items-center gap-1 text-sm text-cocoa hover:underline"
      >
        <ChevronLeft className="h-4 w-4" /> Back to recipe
      </Link>
      <h1 className="mb-6 font-display text-3xl font-semibold text-olive-deep">Edit recipe</h1>

      <div className="mb-6 rounded-2xl border border-border/70 bg-background p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            {aiApplied && (
              <span className="mb-1 inline-flex items-center gap-1 rounded-full bg-olive-deep/10 px-2.5 py-1 text-xs font-medium text-olive-deep">
                <Sparkles className="h-3 w-3" /> AI-applied changes
              </span>
            )}
            <p className="mt-1 text-xs text-cocoa/70">
              {aiApplied
                ? "Review every field before saving. Cleaning up again will propose a new set of changes."
                : "Ask AI to tidy up ingredient names, units, notes, and step wording — you'll review the proposal before anything changes."}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {aiApplied && (
              <button
                type="button"
                onClick={handleResetToOriginal}
                className="rounded-full border border-border px-3 py-1.5 text-xs text-cocoa hover:bg-cream-deep/40"
              >
                Reset to original
              </button>
            )}
            <button
              type="button"
              onClick={() => aiMut.mutate()}
              disabled={aiMut.isPending}
              className="inline-flex items-center gap-1.5 rounded-full border border-olive-deep px-4 py-1.5 text-sm font-medium text-olive-deep hover:bg-olive-deep/10 disabled:opacity-60"
            >
              <Sparkles className="h-3.5 w-3.5" />
              {aiMut.isPending ? "Cleaning up…" : "Clean up with AI"}
            </button>
          </div>
        </div>
        <p role="status" aria-live="polite" className="sr-only">
          {aiMut.isPending ? "Asking AI to clean up this recipe…" : aiProposal ? "AI proposal ready for review." : ""}
        </p>
      </div>

      <form
        onSubmit={form.handleSubmit((v) => mut.mutate(v as RecipeFormValues))}
        className="flex flex-col gap-6"
      >
        <RecipeFormFields form={form} />
        <div className="flex justify-end gap-2">
          <Link
            to="/app/recipes/$recipeId"
            params={{ recipeId }}
            className="rounded-full border border-border px-4 py-2 text-sm text-cocoa hover:bg-cream-deep/40"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={mut.isPending}
            className="rounded-full bg-olive-deep px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-olive disabled:opacity-60"
          >
            {mut.isPending ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>

      {aiProposal && (
        <AiCleanupReviewDialog
          proposal={aiProposal}
          onApply={handleApplyAiProposal}
          onCancel={handleCancelAiProposal}
        />
      )}
    </div>
  );
}

function AiCleanupReviewDialog({
  proposal,
  onApply,
  onCancel,
}: {
  proposal: NormalizedRecipeDraft;
  onApply: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Review AI cleanup proposal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-3xl bg-background p-6 shadow-[var(--shadow-paper)]">
        <span className="mb-1 inline-flex w-fit items-center gap-1 rounded-full bg-olive-deep/10 px-2.5 py-1 text-xs font-medium text-olive-deep">
          <Sparkles className="h-3 w-3" /> AI-proposed changes
        </span>
        <h3 className="mt-2 font-display text-lg font-semibold text-cocoa">Review before applying</h3>
        <p className="mt-1 text-sm text-cocoa/70">
          This is only a proposal — nothing has changed yet. Apply it to update the fields below, or
          cancel to keep your recipe exactly as it is.
        </p>

        <div className="mt-4 flex flex-col gap-4 overflow-y-auto text-sm">
          <div>
            <h4 className="text-xs font-medium uppercase tracking-wide text-cocoa/60">Title</h4>
            <p className="text-cocoa">{proposal.title || "—"}</p>
          </div>
          {proposal.description && (
            <div>
              <h4 className="text-xs font-medium uppercase tracking-wide text-cocoa/60">Description</h4>
              <p className="text-cocoa">{proposal.description}</p>
            </div>
          )}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <h4 className="text-xs font-medium uppercase tracking-wide text-cocoa/60">Servings</h4>
              <p className="text-cocoa">{proposal.servings ?? "—"}</p>
            </div>
            <div>
              <h4 className="text-xs font-medium uppercase tracking-wide text-cocoa/60">Prep</h4>
              <p className="text-cocoa">
                {proposal.prep_time_minutes != null ? `${proposal.prep_time_minutes} min` : "—"}
              </p>
            </div>
            <div>
              <h4 className="text-xs font-medium uppercase tracking-wide text-cocoa/60">Cook</h4>
              <p className="text-cocoa">
                {proposal.cook_time_minutes != null ? `${proposal.cook_time_minutes} min` : "—"}
              </p>
            </div>
          </div>
          <div>
            <h4 className="text-xs font-medium uppercase tracking-wide text-cocoa/60">
              Ingredients ({proposal.ingredients.length})
            </h4>
            <ul className="mt-1 flex flex-col gap-1">
              {proposal.ingredients.map((ing, i) => (
                <li key={i} className="text-cocoa">
                  <span className="font-medium">{ing.display_name}</span>
                  {(ing.quantity_text || ing.unit) && (
                    <span className="text-cocoa/70">
                      {" — "}
                      {[ing.quantity_text, ing.unit].filter(Boolean).join(" ")}
                    </span>
                  )}
                  {ing.preparation_note && <span className="text-cocoa/60"> ({ing.preparation_note})</span>}
                  <span className="ml-2 rounded-full border border-border px-1.5 py-0.5 text-[10px] uppercase text-cocoa/60">
                    {ing.importance}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-xs font-medium uppercase tracking-wide text-cocoa/60">
              Steps ({proposal.steps.length})
            </h4>
            <ol className="mt-1 flex flex-col gap-1 pl-4 list-decimal">
              {proposal.steps.map((s, i) => (
                <li key={i} className="text-cocoa">
                  {s.instruction}
                </li>
              ))}
            </ol>
          </div>
          {proposal.notes && (
            <div>
              <h4 className="text-xs font-medium uppercase tracking-wide text-cocoa/60">Personal notes</h4>
              <p className="whitespace-pre-wrap text-cocoa">{proposal.notes}</p>
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-border px-4 py-2 text-sm text-cocoa hover:bg-cream-deep/40"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onApply}
            className="rounded-full bg-olive-deep px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-olive"
          >
            Apply changes
          </button>
        </div>
      </div>
    </div>
  );
}
