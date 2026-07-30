import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { useAuth } from "@/lib/auth";
import {
  listCollections,
  listCollectionIdsForRecipe,
  addRecipeToCollection,
  removeRecipeFromCollection,
  createCollection,
} from "@/lib/api";
import { CollectionForm } from "./CollectionForm";

interface CollectionPickerProps {
  recipeId: string;
  onClose: () => void;
}

// Only ever lists the user's ACTIVE collections (listCollections(false)) —
// archived collections never receive new memberships by default, since
// they simply never appear here.
export function CollectionPicker({ recipeId, onClose }: CollectionPickerProps) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const collectionsQuery = useQuery({
    queryKey: ["collections", false],
    queryFn: () => listCollections(false),
  });
  const membershipQuery = useQuery({
    queryKey: ["collection-memberships", recipeId],
    queryFn: () => listCollectionIdsForRecipe(recipeId),
  });

  const memberSet = new Set(membershipQuery.data ?? []);

  function invalidateAfterMembershipChange() {
    qc.invalidateQueries({ queryKey: ["collection-memberships", recipeId] });
    qc.invalidateQueries({ queryKey: ["collection-membership-counts"] });
    qc.invalidateQueries({ queryKey: ["collection-recipes"] });
  }

  const toggleMut = useMutation({
    mutationFn: async ({ collectionId, checked }: { collectionId: string; checked: boolean }) => {
      if (checked) {
        if (!user) throw new Error("Not signed in");
        await addRecipeToCollection(collectionId, recipeId, user.id);
      } else {
        await removeRecipeFromCollection(collectionId, recipeId);
      }
    },
    onMutate: ({ collectionId }) => setPendingId(collectionId),
    onSuccess: invalidateAfterMembershipChange,
    onError: (error: Error) => toast.error(error.message),
    onSettled: () => setPendingId(null),
  });

  const createMut = useMutation({
    mutationFn: (name: string) => {
      if (!user) throw new Error("Not signed in");
      return createCollection(user.id, name);
    },
    onSuccess: () => {
      toast.success("Collection created");
      setShowCreate(false);
      qc.invalidateQueries({ queryKey: ["collections"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const isLoading = collectionsQuery.isLoading || membershipQuery.isLoading;
  const hasError = Boolean(collectionsQuery.error || membershipQuery.error);
  const collections = collectionsQuery.data ?? [];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Manage collections for this recipe"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <div className="w-full max-w-sm rounded-3xl bg-background p-6 shadow-[var(--shadow-paper)]">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-lg font-semibold text-cocoa">Manage collections</h3>
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-1 text-sm text-olive-deep hover:underline"
          >
            <Plus className="h-3.5 w-3.5" /> New
          </button>
        </div>

        {isLoading && <p className="text-sm text-cocoa/70">Loading…</p>}
        {hasError && <p className="text-sm text-terracotta">Couldn't load collections.</p>}

        {!isLoading && !hasError && collections.length === 0 && (
          <p className="text-sm text-cocoa/70">
            You don't have any collections yet.{" "}
            <Link to="/app/collections" className="text-olive-deep underline">
              Create one
            </Link>{" "}
            to get started, or use "New" above.
          </p>
        )}

        {!isLoading && !hasError && collections.length > 0 && (
          <ul className="flex max-h-72 flex-col gap-2 overflow-y-auto">
            {collections.map((c) => {
              const checked = memberSet.has(c.id);
              const busy = pendingId === c.id;
              return (
                <li key={c.id}>
                  <label className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm text-cocoa">
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={busy}
                      onChange={(e) => toggleMut.mutate({ collectionId: c.id, checked: e.target.checked })}
                    />
                    {c.name}
                  </label>
                </li>
              );
            })}
          </ul>
        )}

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-border px-4 py-2 text-sm text-cocoa"
          >
            Done
          </button>
        </div>
      </div>

      {showCreate && (
        <CollectionForm
          title="New collection"
          submitLabel="Create"
          isPending={createMut.isPending}
          onSubmit={(name) => createMut.mutate(name)}
          onClose={() => setShowCreate(false)}
        />
      )}
    </div>
  );
}
