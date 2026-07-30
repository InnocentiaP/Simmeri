import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { saveRecipe, type RecipeFormValues } from "@/lib/api";
import { RecipeFormFields, useRecipeForm } from "@/components/app/RecipeForm";
import { toast } from "sonner";
import { ChevronLeft, Download } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/recipes/new")({
  head: () => ({ meta: [{ title: "Add Recipe — Simmeri" }] }),
  component: NewRecipe,
});

function NewRecipe() {
  const form = useRecipeForm();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const mut = useMutation({
    mutationFn: async (v: RecipeFormValues) => saveRecipe(v),
    onSuccess: (id) => {
      toast.success("Recipe saved");
      qc.invalidateQueries();
      navigate({ to: "/app/recipes/$recipeId", params: { recipeId: id! } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mx-auto max-w-3xl">
      <Link to="/app/recipes" className="mb-4 inline-flex items-center gap-1 text-sm text-cocoa hover:underline">
        <ChevronLeft className="h-4 w-4" /> Back to recipes
      </Link>
      <div className="mb-1 flex flex-wrap items-start justify-between gap-3">
        <h1 className="font-display text-3xl font-semibold text-olive-deep">Add recipe</h1>
        <Link
          to="/app/recipes/import"
          className="inline-flex items-center gap-1.5 rounded-full border border-olive-deep px-4 py-1.5 text-sm font-medium text-olive-deep hover:bg-olive-deep/10"
        >
          <Download className="h-3.5 w-3.5" /> Import a recipe
        </Link>
      </div>
      <p className="mb-6 text-sm text-cocoa/70">
        Import from a public recipe webpage or paste recipe text.
      </p>
      <form
        onSubmit={form.handleSubmit((v) => mut.mutate(v as RecipeFormValues))}
        className="flex flex-col gap-6"
      >
        <RecipeFormFields form={form} />
        <div className="flex justify-end gap-2">
          <Link
            to="/app/recipes"
            className="rounded-full border border-border px-4 py-2 text-sm text-cocoa hover:bg-cream-deep/40"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={mut.isPending}
            className="rounded-full bg-olive-deep px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-olive disabled:opacity-60"
          >
            {mut.isPending ? "Saving…" : "Save recipe"}
          </button>
        </div>
      </form>
    </div>
  );
}
