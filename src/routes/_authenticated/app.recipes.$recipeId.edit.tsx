import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getRecipeDetail, saveRecipe, type RecipeFormValues } from "@/lib/api";
import { RecipeFormFields, useRecipeForm } from "@/components/app/RecipeForm";
import { toast } from "sonner";
import { ChevronLeft } from "lucide-react";
import { useEffect } from "react";

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
    </div>
  );
}
