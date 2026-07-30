import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getRecipeDetail,
  archiveRecipe,
  unarchiveRecipe,
  deleteRecipe,
  listCollections,
  listCollectionIdsForRecipe,
  listCookingHistory,
  listCookingPhotosForHistoryIds,
} from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";
import { computeReadiness, readinessDisplay, readinessTone } from "@/lib/readiness";
import { shouldShowSourceLink, safeHostname } from "@/lib/url-safety";
import { RecipeCoverImage } from "@/components/app/RecipeCoverImage";
import { CoverPhotoUploader } from "@/components/app/CoverPhotoUploader";
import { CollectionPicker } from "@/components/app/CollectionPicker";
import { CookingHistoryForm } from "@/components/app/CookingHistoryForm";
import { CookingHistoryList } from "@/components/app/CookingHistoryList";
import { MealPlanEntryForm } from "@/components/app/MealPlanEntryForm";
import { ShoppingGenerationReview } from "@/components/app/ShoppingGenerationReview";
import { removeRecipeMedia } from "@/lib/media/storage";
import { toast } from "sonner";
import {
  ChevronLeft,
  Pencil,
  Archive,
  ArchiveRestore,
  Trash2,
  Clock,
  Users,
  ExternalLink,
  FolderOpen,
  ChefHat,
  CalendarPlus,
  ShoppingCart,
} from "lucide-react";
import { useState } from "react";
import {
  generateCandidates,
  toGenerationIngredients,
  buildDirectRecipeContext,
  type GeneratedCandidateItem,
} from "@/lib/shopping-generate";

export const Route = createFileRoute("/_authenticated/app/recipes/$recipeId/")({
  head: () => ({ meta: [{ title: "Recipe — Simmeri" }] }),
  component: RecipeDetail,
});

function RecipeDetail() {
  const { recipeId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showCollectionPicker, setShowCollectionPicker] = useState(false);
  const [showMarkCooked, setShowMarkCooked] = useState(false);
  const [showAddToPlan, setShowAddToPlan] = useState(false);
  const [generatedCandidates, setGeneratedCandidates] = useState<GeneratedCandidateItem[] | null>(null);

  const collectionsQuery = useQuery({
    queryKey: ["collections", true],
    queryFn: () => listCollections(true),
  });
  const membershipQuery = useQuery({
    queryKey: ["collection-memberships", recipeId],
    queryFn: () => listCollectionIdsForRecipe(recipeId),
  });
  const memberCollections = (collectionsQuery.data ?? []).filter((c) =>
    (membershipQuery.data ?? []).includes(c.id),
  );

  const { data, isLoading, error } = useQuery({
    queryKey: ["recipe", recipeId],
    queryFn: async () => {
      const detail = await getRecipeDetail(recipeId);
      if (!detail) return null;
      const kit = await supabase.from("kitchen_items").select("*").is("archived_at", null);
      if (kit.error) throw kit.error;
      const readiness = computeReadiness(
        detail.ingredients.map((i) => ({
          display_name: i.display_name,
          importance: i.importance as "core" | "supporting" | "seasoning" | "optional",
        })),
        kit.data ?? [],
      );
      return { ...detail, readiness, kitchenItems: kit.data ?? [] };
    },
  });

  const archiveMut = useMutation({
    mutationFn: async () => archiveRecipe(recipeId),
    onSuccess: () => {
      toast.success("Archived");
      qc.invalidateQueries();
    },
  });
  const unarchiveMut = useMutation({
    mutationFn: async () => unarchiveRecipe(recipeId),
    onSuccess: () => {
      toast.success("Restored");
      qc.invalidateQueries();
    },
  });
  const deleteMut = useMutation({
    mutationFn: async () => {
      // Best-effort Storage cleanup before the row (and its DB-cascaded
      // cooking_history/cooking_photos rows) are deleted. Never blocks
      // recipe deletion — a cleanup failure here is swallowed, not thrown.
      try {
        const cleanupByBucket = new Map<string, string[]>();
        const addPath = (bucket: string, path: string) => {
          cleanupByBucket.set(bucket, [...(cleanupByBucket.get(bucket) ?? []), path]);
        };

        // Only a direct-upload cover's object needs cleanup here — a
        // cooking-photo-sourced cover's object is already collected below
        // via that recipe's own cooking-history photos.
        if (
          data?.recipe.cover_source === "direct_upload" &&
          data.recipe.cover_storage_bucket &&
          data.recipe.cover_storage_path
        ) {
          addPath(data.recipe.cover_storage_bucket, data.recipe.cover_storage_path);
        }

        const historyEntries = await listCookingHistory(recipeId);
        const photos = await listCookingPhotosForHistoryIds(historyEntries.map((h) => h.id));
        for (const photo of photos) addPath(photo.storage_bucket, photo.storage_path);

        for (const [bucket, paths] of cleanupByBucket) {
          await removeRecipeMedia(bucket, paths).catch(() => {});
        }
      } catch {
        // Best-effort only.
      }

      await deleteRecipe(recipeId);
    },
    onSuccess: () => {
      toast.success("Deleted");
      qc.invalidateQueries();
      navigate({ to: "/app/recipes" });
    },
  });

  function handleGenerateShoppingItems() {
    if (!data) return;
    const context = buildDirectRecipeContext({
      id: data.recipe.id,
      title: data.recipe.title,
      servings: data.recipe.servings,
    });
    const generated = generateCandidates(
      [{ context, ingredients: toGenerationIngredients(data.ingredients) }],
      data.kitchenItems,
    );
    setGeneratedCandidates(generated);
  }

  if (isLoading) return <div className="text-cocoa/70">Loading…</div>;
  if (error) return <div className="text-terracotta">Failed to load recipe.</div>;
  if (!data)
    return (
      <div className="text-cocoa">
        Recipe not found.{" "}
        <Link to="/app/recipes" className="text-olive-deep underline">
          Back
        </Link>
      </div>
    );

  const { recipe, ingredients, steps, readiness } = data;
  const grouped: Record<string, typeof ingredients> = {
    core: [],
    supporting: [],
    seasoning: [],
    optional: [],
  };
  for (const ing of ingredients) grouped[ing.importance]?.push(ing);
  const groupLabel: Record<string, string> = {
    core: "Core",
    supporting: "Supporting",
    seasoning: "Seasoning",
    optional: "Optional",
  };

  return (
    <div className="mx-auto max-w-3xl">
      <Link to="/app/recipes" className="mb-3 inline-flex items-center gap-1 text-sm text-cocoa hover:underline">
        <ChevronLeft className="h-4 w-4" /> Back to recipes
      </Link>

      <div className="mb-3 overflow-hidden rounded-3xl border border-border/70">
        <RecipeCoverImage
          bucket={recipe.cover_storage_bucket}
          path={recipe.cover_storage_path}
          alt={`${recipe.title} cover photo`}
          className="aspect-[16/9] w-full"
        />
      </div>
      <div className="mb-6">
        <CoverPhotoUploader recipe={recipe} />
      </div>

      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold text-olive-deep">{recipe.title}</h1>
          {recipe.description && <p className="mt-1 text-cocoa/80">{recipe.description}</p>}
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-cocoa/70">
            {recipe.cook_time_minutes != null && (
              <span className="inline-flex items-center gap-1">
                <Clock className="h-4 w-4" /> {recipe.cook_time_minutes} min cook
              </span>
            )}
            {recipe.prep_time_minutes != null && <span>{recipe.prep_time_minutes} min prep</span>}
            {recipe.servings != null && (
              <span className="inline-flex items-center gap-1">
                <Users className="h-4 w-4" /> Serves {recipe.servings}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowMarkCooked(true)}
            className="inline-flex items-center gap-1 rounded-full bg-olive-deep px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-olive"
          >
            <ChefHat className="h-3.5 w-3.5" /> Mark as cooked
          </button>
          <button
            type="button"
            onClick={() => setShowAddToPlan(true)}
            className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1.5 text-sm text-cocoa hover:bg-cream-deep/40"
          >
            <CalendarPlus className="h-3.5 w-3.5" /> Add to Meal Plan
          </button>
          <button
            type="button"
            onClick={handleGenerateShoppingItems}
            className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1.5 text-sm text-cocoa hover:bg-cream-deep/40"
          >
            <ShoppingCart className="h-3.5 w-3.5" /> Add missing ingredients
          </button>
          <Link
            to="/app/recipes/$recipeId/edit"
            params={{ recipeId }}
            className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1.5 text-sm text-cocoa hover:bg-cream-deep/40"
          >
            <Pencil className="h-3.5 w-3.5" /> Edit
          </Link>
          {recipe.archived_at ? (
            <button
              onClick={() => unarchiveMut.mutate()}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1.5 text-sm text-cocoa hover:bg-cream-deep/40"
            >
              <ArchiveRestore className="h-3.5 w-3.5" /> Restore
            </button>
          ) : (
            <button
              onClick={() => archiveMut.mutate()}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1.5 text-sm text-cocoa hover:bg-cream-deep/40"
            >
              <Archive className="h-3.5 w-3.5" /> Archive
            </button>
          )}
          <button
            onClick={() => setConfirmDelete(true)}
            className="inline-flex items-center gap-1 rounded-full border border-terracotta/40 bg-background px-3 py-1.5 text-sm text-terracotta hover:bg-terracotta/10"
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </button>
        </div>
      </header>

      {recipe.source_url && shouldShowSourceLink(recipe.source_url) && (
        <section className="mb-6 rounded-3xl border border-border/70 bg-cream/40 p-5">
          <h2 className="mb-2 font-display text-lg font-semibold text-olive-deep">Source</h2>
          <p className="text-sm text-cocoa/80">
            {recipe.source_title || safeHostname(recipe.source_url) || "Original recipe"}
          </p>
          <a
            href={recipe.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-olive-deep underline underline-offset-2"
          >
            <ExternalLink className="h-3.5 w-3.5" /> View original recipe
          </a>
        </section>
      )}

      <section className="mb-6 rounded-3xl border border-border/70 bg-background p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold text-olive-deep">Collections</h2>
          <button
            type="button"
            onClick={() => setShowCollectionPicker(true)}
            className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-xs text-cocoa hover:bg-cream-deep/40"
          >
            <FolderOpen className="h-3 w-3" />
            {memberCollections.length > 0 ? "Manage" : "Add to collections"}
          </button>
        </div>
        {memberCollections.length === 0 ? (
          <p className="text-sm text-cocoa/60">Not in any collection yet.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {memberCollections.map((c) => (
              <li key={c.id}>
                <Link
                  to="/app/collections/$collectionId"
                  params={{ collectionId: c.id }}
                  className="inline-flex items-center rounded-full border border-border px-3 py-1 text-xs text-cocoa hover:bg-cream-deep/40"
                >
                  {c.name}
                  {c.archived_at ? " (archived)" : ""}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {showCollectionPicker && (
        <CollectionPicker recipeId={recipeId} onClose={() => setShowCollectionPicker(false)} />
      )}

      <section className={`mb-6 rounded-3xl border p-5 ${readinessTone(readiness.label)}`}>
        <div className="flex items-center gap-3">
          <span className="rounded-full border bg-background px-3 py-1 text-sm font-medium">
            {readinessDisplay(readiness.label)}
          </span>
          <span className="text-sm">{readiness.short}</span>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 text-sm">
          <ExpList label="Available" items={readiness.explanation.available} />
          <ExpList label="Running low" items={readiness.explanation.running_low} />
          <ExpList label="Check first" items={readiness.explanation.needs_check} />
          <ExpList label="Missing core" items={readiness.explanation.missing_core} />
          <ExpList label="Missing supporting" items={readiness.explanation.missing_supporting} />
          <ExpList label="Missing seasoning" items={readiness.explanation.missing_seasoning} />
          <ExpList label="Optional (ignored)" items={readiness.explanation.ignored_optional} />
        </div>
      </section>

      <section className="mb-6 rounded-3xl border border-border/70 bg-background p-5">
        <h2 className="mb-3 font-display text-xl font-semibold text-olive-deep">Ingredients</h2>
        {ingredients.length === 0 && <p className="text-sm text-cocoa/60">No ingredients yet.</p>}
        {(["core", "supporting", "seasoning", "optional"] as const).map((key) =>
          grouped[key].length ? (
            <div key={key} className="mb-4 last:mb-0">
              <h3 className="mb-2 text-xs uppercase tracking-wide text-cocoa/60">
                {groupLabel[key]}
              </h3>
              <ul className="flex flex-col gap-1.5 text-sm text-cocoa">
                {grouped[key].map((i) => (
                  <li key={i.id}>
                    <span className="font-medium">{i.display_name}</span>
                    {(i.quantity_text || i.unit) && (
                      <span className="text-cocoa/70">
                        {" — "}
                        {[i.quantity_text, i.unit].filter(Boolean).join(" ")}
                      </span>
                    )}
                    {i.preparation_note && (
                      <span className="text-cocoa/60"> ({i.preparation_note})</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ) : null,
        )}
      </section>

      <section className="mb-6 rounded-3xl border border-border/70 bg-background p-5">
        <h2 className="mb-3 font-display text-xl font-semibold text-olive-deep">Steps</h2>
        {steps.length === 0 && <p className="text-sm text-cocoa/60">No steps yet.</p>}
        <ol className="flex flex-col gap-3">
          {steps.map((s, i) => (
            <li key={s.id} className="flex gap-3">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-olive-deep/10 text-xs font-medium text-olive-deep">
                {i + 1}
              </span>
              <p className="text-sm text-cocoa">{s.instruction}</p>
            </li>
          ))}
        </ol>
      </section>

      {recipe.notes && (
        <section className="mb-6 rounded-3xl border border-border/70 bg-cream/40 p-5">
          <h2 className="mb-2 font-display text-lg font-semibold text-olive-deep">Notes</h2>
          <p className="whitespace-pre-wrap text-sm text-cocoa">{recipe.notes}</p>
        </section>
      )}

      <section className="rounded-3xl border border-border/70 bg-background p-5">
        <h2 className="mb-3 font-display text-xl font-semibold text-olive-deep">Cooking History</h2>
        <CookingHistoryList recipeId={recipeId} recipe={recipe} />
      </section>

      {showMarkCooked && (
        <CookingHistoryForm
          mode="create"
          recipeId={recipeId}
          onDone={() => {
            setShowMarkCooked(false);
            qc.invalidateQueries({ queryKey: ["cooking-history", recipeId] });
          }}
          onClose={() => setShowMarkCooked(false)}
        />
      )}

      {showAddToPlan && (
        <MealPlanEntryForm
          mode="create"
          recipe={recipe}
          onDone={() => {
            setShowAddToPlan(false);
            qc.invalidateQueries({ queryKey: ["meal-plan-entries"] });
          }}
          onClose={() => setShowAddToPlan(false)}
        />
      )}

      {generatedCandidates && (
        <ShoppingGenerationReview
          candidates={generatedCandidates}
          onClose={() => setGeneratedCandidates(null)}
        />
      )}

      {confirmDelete && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        >
          <div className="w-full max-w-sm rounded-3xl bg-background p-6 shadow-[var(--shadow-paper)]">
            <h3 className="font-display text-lg font-semibold text-cocoa">Delete recipe?</h3>
            <p className="mt-1 text-sm text-cocoa/70">
              This permanently deletes "{recipe.title}" and its ingredients & steps.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setConfirmDelete(false)}
                className="rounded-full border border-border px-4 py-2 text-sm text-cocoa"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteMut.mutate()}
                disabled={deleteMut.isPending}
                className="rounded-full bg-terracotta px-4 py-2 text-sm font-medium text-white hover:bg-terracotta/90 disabled:opacity-60"
              >
                {deleteMut.isPending ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ExpList({ label, items }: { label: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wide text-cocoa/60">{label}</div>
      <p className="text-cocoa">{items.join(", ")}</p>
    </div>
  );
}
