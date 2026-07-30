import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo, useState } from "react";
import { computeReadiness, readinessDisplay, readinessTone } from "@/lib/readiness";
import { archiveRecipe, unarchiveRecipe, listCollections } from "@/lib/api";
import { toast } from "sonner";
import { Archive, ArchiveRestore, Clock, Users, Pencil, Plus, Search, Import } from "lucide-react";
import { RecipeCoverImage } from "@/components/app/RecipeCoverImage";

export const Route = createFileRoute("/_authenticated/app/recipes/")({
  head: () => ({ meta: [{ title: "My Recipes — Simmeri" }] }),
  component: RecipesList,
});

function useRecipesWithReadiness(includeArchived: boolean) {
  return useQuery({
    queryKey: ["recipes-list", includeArchived],
    queryFn: async () => {
      let q = supabase.from("recipes").select("*").order("created_at", { ascending: false });
      if (!includeArchived) q = q.is("archived_at", null);
      const [recipesRes, ingRes, kitRes] = await Promise.all([
        q,
        supabase.from("recipe_ingredients").select("*"),
        supabase.from("kitchen_items").select("*").is("archived_at", null),
      ]);
      if (recipesRes.error) throw recipesRes.error;
      if (ingRes.error) throw ingRes.error;
      if (kitRes.error) throw kitRes.error;
      const recipes = recipesRes.data ?? [];
      const ingredients = ingRes.data ?? [];
      const kitchen = kitRes.data ?? [];
      return recipes.map((r) => {
        const rIng = ingredients
          .filter((i) => i.recipe_id === r.id)
          .map((i) => ({
            display_name: i.display_name,
            importance: i.importance as "core" | "supporting" | "seasoning" | "optional",
          }));
        return { recipe: r, readiness: computeReadiness(rIng, kitchen) };
      });
    },
  });
}

function RecipesList() {
  const [q, setQ] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [collectionFilter, setCollectionFilter] = useState<string>("all");
  const { data, isLoading, error } = useRecipesWithReadiness(showArchived);
  const qc = useQueryClient();

  const collectionsQuery = useQuery({
    queryKey: ["collections", false],
    queryFn: () => listCollections(false),
  });

  const collectionMembersQuery = useQuery({
    queryKey: ["collection-member-ids", collectionFilter],
    queryFn: async () => {
      const { data: memberships, error: membershipError } = await supabase
        .from("collection_recipes")
        .select("recipe_id")
        .eq("collection_id", collectionFilter);
      if (membershipError) throw membershipError;
      return new Set((memberships ?? []).map((m) => m.recipe_id));
    },
    enabled: collectionFilter !== "all",
  });

  const filtered = useMemo(() => {
    if (!data) return [];
    const needle = q.trim().toLowerCase();
    let result = data;
    if (needle) result = result.filter(({ recipe }) => recipe.title.toLowerCase().includes(needle));
    if (collectionFilter !== "all") {
      const memberIds = collectionMembersQuery.data;
      result = memberIds ? result.filter(({ recipe }) => memberIds.has(recipe.id)) : [];
    }
    return result;
  }, [data, q, collectionFilter, collectionMembersQuery.data]);

  const archiveMut = useMutation({
    mutationFn: async (id: string) => archiveRecipe(id),
    onSuccess: () => {
      toast.success("Recipe archived");
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const unarchiveMut = useMutation({
    mutationFn: async (id: string) => unarchiveRecipe(id),
    onSuccess: () => {
      toast.success("Recipe restored");
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold text-olive-deep">My Recipes</h1>
          <p className="text-sm text-cocoa/70">Everything you've saved and cooked.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/app/recipes/import"
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-4 py-2 text-sm font-medium text-cocoa hover:bg-cream-deep/40"
          >
            <Import className="h-4 w-4" /> Import
          </Link>
          <Link
            to="/app/recipes/new"
            className="inline-flex items-center gap-1.5 rounded-full bg-olive-deep px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-olive"
          >
            <Plus className="h-4 w-4" /> Add recipe
          </Link>
        </div>
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-cocoa/50" />
          <input
            placeholder="Search recipes…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full rounded-full border border-border bg-background py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-olive-deep/40"
          />
        </div>
        <label className="flex items-center gap-2 rounded-full border border-border bg-background px-3 py-2 text-sm text-cocoa">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
          />
          Show archived
        </label>
        <select
          value={collectionFilter}
          onChange={(e) => setCollectionFilter(e.target.value)}
          aria-label="Filter by collection"
          className="rounded-full border border-border bg-background px-3 py-2 text-sm text-cocoa focus:outline-none focus:ring-2 focus:ring-olive-deep/40"
        >
          <option value="all">All collections</option>
          {(collectionsQuery.data ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {isLoading && <div className="text-cocoa/70">Loading…</div>}
      {error && (
        <div className="rounded-xl border border-terracotta/40 bg-terracotta/5 p-4 text-terracotta">
          Failed to load recipes.
        </div>
      )}
      {!isLoading && filtered.length === 0 && (
        <div className="rounded-3xl border border-dashed border-border bg-cream/40 p-8 text-center">
          <h3 className="font-display text-lg font-semibold text-cocoa">
            {q ? "No recipes match that search." : "No recipes yet."}
          </h3>
          {!q && (
            <Link
              to="/app/recipes/new"
              className="mt-4 inline-flex rounded-full bg-olive-deep px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-olive"
            >
              Add your first recipe
            </Link>
          )}
        </div>
      )}

      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map(({ recipe, readiness }) => (
          <li
            key={recipe.id}
            className="flex flex-col rounded-2xl border border-border/70 bg-background p-4"
          >
            <Link
              to="/app/recipes/$recipeId"
              params={{ recipeId: recipe.id }}
              className="block"
            >
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
              <div className="mt-3 flex flex-wrap gap-3 text-xs text-cocoa/60">
                {recipe.cook_time_minutes != null && (
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3 w-3" /> {recipe.cook_time_minutes} min
                  </span>
                )}
                {recipe.servings != null && (
                  <span className="inline-flex items-center gap-1">
                    <Users className="h-3 w-3" /> {recipe.servings}
                  </span>
                )}
                {recipe.archived_at && (
                  <span className="rounded-full bg-cocoa/10 px-2 py-0.5 text-cocoa">Archived</span>
                )}
              </div>
              <div className="mt-3">
                <span className={`rounded-full border px-2.5 py-1 text-xs ${readinessTone(readiness.label)}`}>
                  {readinessDisplay(readiness.label)}
                </span>
                <p className="mt-1.5 text-xs text-cocoa/60">{readiness.short}</p>
              </div>
            </Link>
            <div className="mt-3 flex items-center gap-2 border-t border-border/50 pt-3 text-sm">
              <Link
                to="/app/recipes/$recipeId/edit"
                params={{ recipeId: recipe.id }}
                className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-xs text-cocoa hover:bg-cream-deep/40"
              >
                <Pencil className="h-3 w-3" /> Edit
              </Link>
              {recipe.archived_at ? (
                <button
                  onClick={() => unarchiveMut.mutate(recipe.id)}
                  className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-xs text-cocoa hover:bg-cream-deep/40"
                >
                  <ArchiveRestore className="h-3 w-3" /> Restore
                </button>
              ) : (
                <button
                  onClick={() => archiveMut.mutate(recipe.id)}
                  className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-xs text-cocoa hover:bg-cream-deep/40"
                >
                  <Archive className="h-3 w-3" /> Archive
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
