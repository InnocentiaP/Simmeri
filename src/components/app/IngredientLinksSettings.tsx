import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowRight, Trash2 } from "lucide-react";
import { deleteIngredientLink, listIngredientLinks } from "@/lib/api";

// Settings → "Ingredient matches": the personal links made with "I have
// this" on a recipe, with a way to undo a wrong one.
export function IngredientLinksSettings() {
  const qc = useQueryClient();
  const linksQuery = useQuery({ queryKey: ["ingredient-links"], queryFn: listIngredientLinks });

  const removeMut = useMutation({
    mutationFn: (id: string) => deleteIngredientLink(id),
    onSuccess: async () => {
      // Readiness and shopping everywhere depend on these links.
      await qc.invalidateQueries();
      toast.success("Match removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const links = linksQuery.data ?? [];

  return (
    <section className="mt-6 rounded-3xl border border-border/70 bg-background p-5">
      <h2 className="font-display text-lg font-semibold text-olive-deep">Ingredient matches</h2>
      <p className="mt-1 text-sm text-cocoa/70">
        Names you told Meri are the same ingredient (with “I have this” on a recipe). They count as
        a match for readiness, shopping lists, and Tonight's Deck.
      </p>

      {linksQuery.isLoading && <p className="mt-3 text-sm text-cocoa/70">Loading…</p>}
      {linksQuery.error && (
        <p className="mt-3 text-sm text-cocoa/70">
          Ingredient matches aren't available yet. (The Phase 2 database update may still need to be
          applied.)
        </p>
      )}
      {!linksQuery.isLoading && !linksQuery.error && links.length === 0 && (
        <p className="mt-3 text-sm text-cocoa/60">No personal matches yet.</p>
      )}

      {links.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2">
          {links.map((link) => (
            <li
              key={link.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-border/60 px-3 py-2 text-sm text-cocoa"
            >
              <span className="flex flex-wrap items-center gap-2">
                {link.alias_normalized}
                <ArrowRight className="h-3.5 w-3.5 text-cocoa/50" aria-label="counts as" />
                {link.target_normalized}
              </span>
              <button
                type="button"
                disabled={removeMut.isPending}
                onClick={() => removeMut.mutate(link.id)}
                aria-label={`Remove match ${link.alias_normalized} to ${link.target_normalized}`}
                className="rounded-full border border-terracotta/40 p-1.5 text-terracotta hover:bg-terracotta/10 disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
