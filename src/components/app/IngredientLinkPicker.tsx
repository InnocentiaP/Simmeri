import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Search } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { linkIngredientNames, listKitchenItems } from "@/lib/api";

interface IngredientLinkPickerProps {
  ingredientName: string;
  onClose: () => void;
}

// "I have this": the recipe calls an ingredient by a name that doesn't match
// anything in Kitchen ("cabe"), but the user has it under another name
// ("cabai merah"). Picking that Kitchen item saves a personal link, and the
// two names count as the same ingredient everywhere — readiness, shopping
// lists, Tonight's Deck, and Kitchen updates. Links can be removed in
// Settings.
export function IngredientLinkPicker({ ingredientName, onClose }: IngredientLinkPickerProps) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);

  const kitchenQuery = useQuery({
    queryKey: ["kitchen-items-active"],
    queryFn: () => listKitchenItems(false),
  });

  const items = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const all = kitchenQuery.data ?? [];
    return needle ? all.filter((k) => k.ingredient_name.toLowerCase().includes(needle)) : all;
  }, [kitchenQuery.data, query]);

  async function pick(kitchenName: string) {
    if (!user || saving) return;
    setSaving(true);
    try {
      await linkIngredientNames(user.id, ingredientName, kitchenName);
      // Every readiness/shopping view depends on the matcher.
      await qc.invalidateQueries();
      toast.success(`Got it — “${ingredientName}” now counts as “${kitchenName}”.`);
      onClose();
    } catch (e) {
      const message =
        typeof e === "object" && e !== null && "message" in e
          ? String((e as { message: unknown }).message)
          : null;
      toast.error(message || "Couldn't save that match.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ingredient-link-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <div className="flex max-h-[80vh] w-full max-w-md flex-col rounded-3xl bg-background p-6 shadow-[var(--shadow-paper)]">
        <h3 id="ingredient-link-title" className="font-display text-lg font-semibold text-cocoa">
          Is “{ingredientName}” in your Kitchen?
        </h3>
        <p className="mb-3 mt-1 text-sm text-cocoa/70">
          Pick the Kitchen item it's saved as. Meri will treat both names as the same ingredient
          from now on.
        </p>

        <div className="relative mb-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-cocoa/50" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search your Kitchen…"
            aria-label="Search your Kitchen"
            className="w-full rounded-full border border-border bg-background py-2 pl-9 pr-3 text-sm"
          />
        </div>

        {kitchenQuery.isLoading && <p className="text-sm text-cocoa/70">Loading Kitchen…</p>}
        {!kitchenQuery.isLoading && items.length === 0 && (
          <p className="text-sm text-cocoa/70">
            {query ? "Nothing in your Kitchen matches that." : "Your Kitchen is empty."}
          </p>
        )}
        <ul className="flex flex-col gap-1 overflow-y-auto">
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                disabled={saving}
                onClick={() => pick(item.ingredient_name)}
                className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm text-cocoa hover:bg-cream-deep/40 disabled:opacity-60"
              >
                <span>{item.ingredient_name}</span>
                <span className="text-xs text-cocoa/50">{item.status.replace(/_/g, " ")}</span>
              </button>
            </li>
          ))}
        </ul>

        <div className="mt-4 flex justify-end">
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
