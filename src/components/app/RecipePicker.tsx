import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { listRecipes, type Recipe } from "@/lib/api";
import { RecipeCoverImage } from "@/components/app/RecipeCoverImage";

interface RecipePickerProps {
  onSelect: (recipe: Recipe) => void;
  onClose: () => void;
}

// Single-selection recipe picker for the Meal Planner — modeled on
// CollectionPicker.tsx's dialog shape, but a row click immediately selects
// and closes (advancing to MealPlanEntryForm) rather than toggling
// membership in place. Only ever lists active recipes (listRecipes(false)),
// matching the same "archived recipes don't appear in pickers" convention
// used by CollectionPicker.
export function RecipePicker({ onSelect, onClose }: RecipePickerProps) {
  const [q, setQ] = useState("");

  const recipesQuery = useQuery({
    queryKey: ["recipes-list", false],
    queryFn: () => listRecipes(false),
  });

  const filtered = useMemo(() => {
    const list = recipesQuery.data ?? [];
    const needle = q.trim().toLowerCase();
    if (!needle) return list;
    return list.filter((r) => r.title.toLowerCase().includes(needle));
  }, [recipesQuery.data, q]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Choose a recipe to plan"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <div className="flex w-full max-w-md flex-col rounded-3xl bg-background p-6 shadow-[var(--shadow-paper)]">
        <h3 className="mb-4 font-display text-lg font-semibold text-cocoa">Choose a recipe</h3>

        <div className="relative mb-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-cocoa/50" />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search your recipes…"
            className="w-full rounded-full border border-border bg-background py-2 pl-9 pr-3 text-sm"
            aria-label="Search your recipes"
          />
        </div>

        {recipesQuery.isLoading && <p className="text-sm text-cocoa/70">Loading…</p>}
        {recipesQuery.error && (
          <p className="text-sm text-terracotta">Couldn't load your recipes.</p>
        )}

        {!recipesQuery.isLoading && !recipesQuery.error && filtered.length === 0 && (
          <p className="text-sm text-cocoa/70">No recipes match "{q}".</p>
        )}

        {!recipesQuery.isLoading && !recipesQuery.error && filtered.length > 0 && (
          <ul className="flex max-h-80 flex-col gap-1.5 overflow-y-auto">
            {filtered.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => onSelect(r)}
                  className="flex w-full items-center gap-3 rounded-xl border border-transparent px-2 py-2 text-left hover:border-border hover:bg-cream-deep/40"
                >
                  <RecipeCoverImage
                    bucket={r.cover_storage_bucket}
                    path={r.cover_storage_path}
                    alt=""
                    className="h-10 w-10 shrink-0 rounded-lg"
                  />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-cocoa">
                    {r.title}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-border px-4 py-2 text-sm text-cocoa"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
