import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Pencil, Archive, ArchiveRestore, Trash2, ShoppingCart } from "lucide-react";
import {
  listShoppingLists,
  listAllShoppingListItemStates,
  createShoppingList,
  renameShoppingList,
  archiveShoppingList,
  restoreShoppingList,
  deleteShoppingList,
  type ShoppingList,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { ShoppingListForm } from "@/components/app/ShoppingListForm";

export const Route = createFileRoute("/_authenticated/app/shopping/")({
  head: () => ({ meta: [{ title: "Shopping — Simmeri" }] }),
  component: ShoppingListsIndex,
});

type FormMode = null | "create" | { rename: ShoppingList };

function ShoppingListsIndex() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [showArchived, setShowArchived] = useState(false);
  const [formMode, setFormMode] = useState<FormMode>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["shopping-lists", showArchived],
    queryFn: () => listShoppingLists(showArchived),
  });

  const itemStatesQuery = useQuery({
    queryKey: ["shopping-list-item-states"],
    queryFn: listAllShoppingListItemStates,
  });

  const counts = useMemo(() => {
    const map = new Map<string, { purchased: number; unpurchased: number }>();
    for (const s of itemStatesQuery.data ?? []) {
      const entry = map.get(s.shopping_list_id) ?? { purchased: 0, unpurchased: 0 };
      if (s.is_purchased) entry.purchased += 1;
      else entry.unpurchased += 1;
      map.set(s.shopping_list_id, entry);
    }
    return map;
  }, [itemStatesQuery.data]);

  function invalidateShoppingLists() {
    qc.invalidateQueries({ queryKey: ["shopping-lists"] });
  }

  const createMut = useMutation({
    mutationFn: (name: string) => {
      if (!user) throw new Error("Not signed in");
      return createShoppingList(user.id, name);
    },
    onSuccess: () => {
      toast.success("Shopping list created");
      setFormMode(null);
      invalidateShoppingLists();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const renameMut = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => renameShoppingList(id, name),
    onSuccess: () => {
      toast.success("Shopping list renamed");
      setFormMode(null);
      invalidateShoppingLists();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const archiveMut = useMutation({
    mutationFn: (id: string) => archiveShoppingList(id),
    onSuccess: () => {
      toast.success("Shopping list archived");
      invalidateShoppingLists();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const restoreMut = useMutation({
    mutationFn: (id: string) => restoreShoppingList(id),
    onSuccess: () => {
      toast.success("Shopping list restored");
      invalidateShoppingLists();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteShoppingList(id),
    onSuccess: () => {
      toast.success("Shopping list deleted");
      setConfirmDeleteId(null);
      invalidateShoppingLists();
      qc.invalidateQueries({ queryKey: ["shopping-list-item-states"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const lists = data ?? [];

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold text-olive-deep">Shopping</h1>
          <p className="text-sm text-cocoa/70">Keep track of what you need to buy.</p>
        </div>
        <button
          type="button"
          onClick={() => setFormMode("create")}
          className="inline-flex items-center gap-1.5 rounded-full bg-olive-deep px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-olive"
        >
          <Plus className="h-4 w-4" /> New list
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
          Failed to load shopping lists.
        </div>
      )}

      {!isLoading && !error && lists.length === 0 && (
        <div className="flex flex-col items-center rounded-3xl border border-dashed border-border bg-cream/40 p-8 text-center">
          <ShoppingCart className="mb-3 h-8 w-8 text-olive-deep" />
          <h3 className="font-display text-lg font-semibold text-cocoa">
            {showArchived ? "No archived lists." : "No shopping lists yet."}
          </h3>
          {!showArchived && (
            <p className="mt-1 max-w-sm text-sm text-cocoa/70">
              Create a list to start tracking what you need to buy.
            </p>
          )}
        </div>
      )}

      <ul className="grid gap-3 sm:grid-cols-2">
        {lists.map((list) => {
          const count = counts.get(list.id) ?? { purchased: 0, unpurchased: 0 };
          return (
            <li key={list.id} className="flex flex-col rounded-2xl border border-border/70 bg-background p-4">
              <Link to="/app/shopping/$shoppingListId" params={{ shoppingListId: list.id }} className="block">
                <h3 className="font-display text-lg font-semibold text-cocoa">{list.name}</h3>
                <p className="mt-1 text-sm text-cocoa/60">
                  {count.unpurchased} to buy · {count.purchased} purchased
                </p>
                {list.archived_at && (
                  <span className="mt-2 inline-block rounded-full bg-cocoa/10 px-2 py-0.5 text-xs text-cocoa">
                    Archived
                  </span>
                )}
              </Link>
              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border/50 pt-3 text-sm">
                <button
                  type="button"
                  onClick={() => setFormMode({ rename: list })}
                  className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-xs text-cocoa hover:bg-cream-deep/40"
                >
                  <Pencil className="h-3 w-3" /> Rename
                </button>
                {list.archived_at ? (
                  <button
                    type="button"
                    onClick={() => restoreMut.mutate(list.id)}
                    disabled={restoreMut.isPending}
                    className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-xs text-cocoa hover:bg-cream-deep/40 disabled:opacity-60"
                  >
                    <ArchiveRestore className="h-3 w-3" /> Restore
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => archiveMut.mutate(list.id)}
                    disabled={archiveMut.isPending}
                    className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-xs text-cocoa hover:bg-cream-deep/40 disabled:opacity-60"
                  >
                    <Archive className="h-3 w-3" /> Archive
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setConfirmDeleteId(list.id)}
                  className="inline-flex items-center gap-1 rounded-full border border-terracotta/40 px-3 py-1 text-xs text-terracotta hover:bg-terracotta/10"
                >
                  <Trash2 className="h-3 w-3" /> Delete
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {formMode === "create" && (
        <ShoppingListForm
          title="New shopping list"
          submitLabel="Create"
          isPending={createMut.isPending}
          onSubmit={(name) => createMut.mutate(name)}
          onClose={() => setFormMode(null)}
        />
      )}
      {formMode !== null && typeof formMode === "object" && (
        <ShoppingListForm
          title="Rename shopping list"
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
            <h3 className="font-display text-lg font-semibold text-cocoa">Delete shopping list?</h3>
            <p className="mt-1 text-sm text-cocoa/70">
              This permanently deletes the list and its items. Your Kitchen Inventory is never affected.
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
