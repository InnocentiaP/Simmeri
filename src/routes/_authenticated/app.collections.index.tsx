import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Pencil, Archive, ArchiveRestore, Trash2, FolderOpen } from "lucide-react";
import { useAuth } from "@/lib/auth";
import {
  listCollections,
  listAllCollectionMembershipCollectionIds,
  createCollection,
  renameCollection,
  archiveCollection,
  restoreCollection,
  deleteCollection,
  type Collection,
} from "@/lib/api";
import { CollectionForm } from "@/components/app/CollectionForm";

export const Route = createFileRoute("/_authenticated/app/collections/")({
  head: () => ({ meta: [{ title: "Collections — Simmeri" }] }),
  component: CollectionsList,
});

type FormMode = null | "create" | { rename: Collection };

function CollectionsList() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [showArchived, setShowArchived] = useState(false);
  const [formMode, setFormMode] = useState<FormMode>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["collections", showArchived],
    queryFn: () => listCollections(showArchived),
  });

  const membershipQuery = useQuery({
    queryKey: ["collection-membership-counts"],
    queryFn: listAllCollectionMembershipCollectionIds,
  });

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const id of membershipQuery.data ?? []) map.set(id, (map.get(id) ?? 0) + 1);
    return map;
  }, [membershipQuery.data]);

  function invalidateCollections() {
    qc.invalidateQueries({ queryKey: ["collections"] });
  }

  const createMut = useMutation({
    mutationFn: (name: string) => {
      if (!user) throw new Error("Not signed in");
      return createCollection(user.id, name);
    },
    onSuccess: () => {
      toast.success("Collection created");
      setFormMode(null);
      invalidateCollections();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const renameMut = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => renameCollection(id, name),
    onSuccess: () => {
      toast.success("Collection renamed");
      setFormMode(null);
      invalidateCollections();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const archiveMut = useMutation({
    mutationFn: (id: string) => archiveCollection(id),
    onSuccess: () => {
      toast.success("Collection archived");
      invalidateCollections();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const restoreMut = useMutation({
    mutationFn: (id: string) => restoreCollection(id),
    onSuccess: () => {
      toast.success("Collection restored");
      invalidateCollections();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteCollection(id),
    onSuccess: () => {
      toast.success("Collection deleted");
      setConfirmDeleteId(null);
      invalidateCollections();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const collections = data ?? [];

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold text-olive-deep">Collections</h1>
          <p className="text-sm text-cocoa/70">Group your recipes however makes sense to you.</p>
        </div>
        <button
          type="button"
          onClick={() => setFormMode("create")}
          className="inline-flex items-center gap-1.5 rounded-full bg-olive-deep px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-olive"
        >
          <Plus className="h-4 w-4" /> New collection
        </button>
      </header>

      <label className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-2 text-sm text-cocoa">
        <input
          type="checkbox"
          checked={showArchived}
          onChange={(e) => setShowArchived(e.target.checked)}
        />
        Show archived
      </label>

      {isLoading && <div className="text-cocoa/70">Loading…</div>}
      {error && (
        <div className="rounded-xl border border-terracotta/40 bg-terracotta/5 p-4 text-terracotta">
          Failed to load collections.
        </div>
      )}

      {!isLoading && !error && collections.length === 0 && (
        <div className="flex flex-col items-center rounded-3xl border border-dashed border-border bg-cream/40 p-8 text-center">
          <FolderOpen className="mb-3 h-8 w-8 text-olive-deep" />
          <h3 className="font-display text-lg font-semibold text-cocoa">
            {showArchived ? "No archived collections." : "No collections yet."}
          </h3>
          {!showArchived && (
            <p className="mt-1 max-w-sm text-sm text-cocoa/70">
              Create a collection to group recipes for a trip, a season, or anything else.
            </p>
          )}
        </div>
      )}

      <ul className="grid gap-3 sm:grid-cols-2">
        {collections.map((c) => (
          <li key={c.id} className="flex flex-col rounded-2xl border border-border/70 bg-background p-4">
            <Link to="/app/collections/$collectionId" params={{ collectionId: c.id }} className="block">
              <h3 className="font-display text-lg font-semibold text-cocoa">{c.name}</h3>
              <p className="mt-1 text-sm text-cocoa/60">
                {counts.get(c.id) ?? 0} {(counts.get(c.id) ?? 0) === 1 ? "recipe" : "recipes"}
              </p>
              {c.archived_at && (
                <span className="mt-2 inline-block rounded-full bg-cocoa/10 px-2 py-0.5 text-xs text-cocoa">
                  Archived
                </span>
              )}
            </Link>
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border/50 pt-3 text-sm">
              <button
                type="button"
                onClick={() => setFormMode({ rename: c })}
                className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-xs text-cocoa hover:bg-cream-deep/40"
              >
                <Pencil className="h-3 w-3" /> Rename
              </button>
              {c.archived_at ? (
                <button
                  type="button"
                  onClick={() => restoreMut.mutate(c.id)}
                  disabled={restoreMut.isPending}
                  className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-xs text-cocoa hover:bg-cream-deep/40 disabled:opacity-60"
                >
                  <ArchiveRestore className="h-3 w-3" /> Restore
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => archiveMut.mutate(c.id)}
                  disabled={archiveMut.isPending}
                  className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-xs text-cocoa hover:bg-cream-deep/40 disabled:opacity-60"
                >
                  <Archive className="h-3 w-3" /> Archive
                </button>
              )}
              <button
                type="button"
                onClick={() => setConfirmDeleteId(c.id)}
                className="inline-flex items-center gap-1 rounded-full border border-terracotta/40 px-3 py-1 text-xs text-terracotta hover:bg-terracotta/10"
              >
                <Trash2 className="h-3 w-3" /> Delete
              </button>
            </div>
          </li>
        ))}
      </ul>

      {formMode === "create" && (
        <CollectionForm
          title="New collection"
          submitLabel="Create"
          isPending={createMut.isPending}
          onSubmit={(name) => createMut.mutate(name)}
          onClose={() => setFormMode(null)}
        />
      )}
      {formMode !== null && typeof formMode === "object" && (
        <CollectionForm
          title="Rename collection"
          submitLabel="Save"
          defaultName={formMode.rename.name}
          isPending={renameMut.isPending}
          onSubmit={(name) => renameMut.mutate({ id: formMode.rename.id, name })}
          onClose={() => setFormMode(null)}
        />
      )}

      {confirmDeleteId && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        >
          <div className="w-full max-w-sm rounded-3xl bg-background p-6 shadow-[var(--shadow-paper)]">
            <h3 className="font-display text-lg font-semibold text-cocoa">Delete collection?</h3>
            <p className="mt-1 text-sm text-cocoa/70">
              This removes the collection and its memberships. Your recipes are never deleted or
              modified.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteId(null)}
                className="rounded-full border border-border px-4 py-2 text-sm text-cocoa"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => deleteMut.mutate(confirmDeleteId)}
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
