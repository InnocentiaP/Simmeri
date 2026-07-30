import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ChevronLeft, X } from "lucide-react";
import { getCollection, listRecipesInCollection, removeRecipeFromCollection } from "@/lib/api";
import { RecipeCoverImage } from "@/components/app/RecipeCoverImage";

export const Route = createFileRoute("/_authenticated/app/collections/$collectionId")({
  head: () => ({ meta: [{ title: "Collection — Simmeri" }] }),
  component: CollectionDetail,
});

function CollectionDetail() {
  const { collectionId } = Route.useParams();
  const qc = useQueryClient();
  const [showArchivedRecipes, setShowArchivedRecipes] = useState(false);

  // RLS-scoped: a nonexistent id and another user's collection id are
  // indistinguishable here — both resolve to null, never leaking whether
  // the id belongs to someone else.
  const collectionQuery = useQuery({
    queryKey: ["collection", collectionId],
    queryFn: () => getCollection(collectionId),
  });

  const recipesQuery = useQuery({
    queryKey: ["collection-recipes", collectionId],
    queryFn: () => listRecipesInCollection(collectionId),
    enabled: Boolean(collectionQuery.data),
  });

  const removeMut = useMutation({
    mutationFn: (recipeId: string) => removeRecipeFromCollection(collectionId, recipeId),
    onSuccess: () => {
      toast.success("Removed from collection");
      qc.invalidateQueries({ queryKey: ["collection-recipes", collectionId] });
      qc.invalidateQueries({ queryKey: ["collection-membership-counts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (collectionQuery.isLoading) return <div className="text-cocoa/70">Loading…</div>;

  if (!collectionQuery.data) {
    return (
      <div className="text-cocoa">
        Collection not found.{" "}
        <Link to="/app/collections" className="text-olive-deep underline">
          Back to collections
        </Link>
      </div>
    );
  }

  const collection = collectionQuery.data;
  const recipes = recipesQuery.data ?? [];
  const visible = recipes.filter((r) => showArchivedRecipes || !r.archived_at);

  return (
    <div className="mx-auto max-w-5xl">
      <Link
        to="/app/collections"
        className="mb-3 inline-flex items-center gap-1 text-sm text-cocoa hover:underline"
      >
        <ChevronLeft className="h-4 w-4" /> Back to collections
      </Link>
      <header className="mb-6">
        <h1 className="font-display text-3xl font-semibold text-olive-deep">{collection.name}</h1>
        {collection.archived_at && (
          <span className="mt-2 inline-block rounded-full bg-cocoa/10 px-2 py-0.5 text-xs text-cocoa">
            Archived collection
          </span>
        )}
      </header>

      <label className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-2 text-sm text-cocoa">
        <input
          type="checkbox"
          checked={showArchivedRecipes}
          onChange={(e) => setShowArchivedRecipes(e.target.checked)}
        />
        Show archived recipes
      </label>

      {recipesQuery.isLoading && <div className="text-cocoa/70">Loading recipes…</div>}
      {recipesQuery.error && (
        <div className="rounded-xl border border-terracotta/40 bg-terracotta/5 p-4 text-terracotta">
          Failed to load recipes in this collection.
        </div>
      )}

      {!recipesQuery.isLoading && !recipesQuery.error && visible.length === 0 && (
        <div className="rounded-3xl border border-dashed border-border bg-cream/40 p-8 text-center">
          <h3 className="font-display text-lg font-semibold text-cocoa">No recipes here yet.</h3>
          <p className="mt-1 text-sm text-cocoa/70">
            Add recipes to this collection from any recipe's detail page.
          </p>
        </div>
      )}

      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((recipe) => (
          <li
            key={recipe.id}
            className="flex flex-col rounded-2xl border border-border/70 bg-background p-4"
          >
            <Link to="/app/recipes/$recipeId" params={{ recipeId: recipe.id }} className="block">
              <RecipeCoverImage
                bucket={recipe.cover_storage_bucket}
                path={recipe.cover_storage_path}
                alt={`${recipe.title} cover photo`}
                className="mb-3 aspect-[4/3] w-full rounded-xl"
              />
              <h3 className="font-display text-lg font-semibold text-cocoa">{recipe.title}</h3>
              {recipe.description && (
                <p className="mt-1 line-clamp-2 text-sm text-cocoa/70">{recipe.description}</p>
              )}
              {recipe.archived_at && (
                <span className="mt-2 inline-block rounded-full bg-cocoa/10 px-2 py-0.5 text-xs text-cocoa">
                  Archived
                </span>
              )}
            </Link>
            <div className="mt-3 border-t border-border/50 pt-3">
              <button
                type="button"
                onClick={() => removeMut.mutate(recipe.id)}
                disabled={removeMut.isPending}
                className="inline-flex items-center gap-1 rounded-full border border-terracotta/40 px-3 py-1 text-xs text-terracotta hover:bg-terracotta/10 disabled:opacity-60"
              >
                <X className="h-3 w-3" /> Remove from collection
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
