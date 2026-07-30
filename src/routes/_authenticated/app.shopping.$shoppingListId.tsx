import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronLeft, Pencil, Archive, ArchiveRestore, Trash2, Plus, ChefHat } from "lucide-react";
import {
  getShoppingList,
  listShoppingListItems,
  renameShoppingList,
  archiveShoppingList,
  restoreShoppingList,
  deleteShoppingList,
  deleteShoppingListItem,
  markShoppingListItemPurchased,
  markShoppingListItemUnpurchased,
  type ShoppingListItem,
} from "@/lib/api";
import { ShoppingListForm } from "@/components/app/ShoppingListForm";
import { ShoppingItemForm } from "@/components/app/ShoppingItemForm";
import { ShoppingListItemRow } from "@/components/app/ShoppingListItemRow";
import { KitchenUpdateConfirmDialog } from "@/components/app/KitchenUpdateConfirmDialog";

export const Route = createFileRoute("/_authenticated/app/shopping/$shoppingListId")({
  head: () => ({ meta: [{ title: "Shopping List — Simmeri" }] }),
  component: ShoppingListDetail,
});

function ShoppingListDetail() {
  const { shoppingListId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [showRename, setShowRename] = useState(false);
  const [confirmDeleteList, setConfirmDeleteList] = useState(false);
  const [itemForm, setItemForm] = useState<null | "create" | { edit: ShoppingListItem }>(null);
  const [showKitchenConfirm, setShowKitchenConfirm] = useState(false);
  const [pendingToggleId, setPendingToggleId] = useState<string | null>(null);

  // RLS-scoped: a nonexistent id and another user's list id are
  // indistinguishable here — both resolve to null, matching the same
  // pattern already used by Collections' getCollection().
  const listQuery = useQuery({
    queryKey: ["shopping-list", shoppingListId],
    queryFn: () => getShoppingList(shoppingListId),
  });

  const itemsQuery = useQuery({
    queryKey: ["shopping-list-items", shoppingListId],
    queryFn: () => listShoppingListItems(shoppingListId),
    enabled: Boolean(listQuery.data),
  });

  function invalidateItems() {
    qc.invalidateQueries({ queryKey: ["shopping-list-items", shoppingListId] });
    qc.invalidateQueries({ queryKey: ["shopping-list-item-states"] });
  }

  const renameMut = useMutation({
    mutationFn: (name: string) => renameShoppingList(shoppingListId, name),
    onSuccess: () => {
      toast.success("Renamed");
      setShowRename(false);
      qc.invalidateQueries({ queryKey: ["shopping-list", shoppingListId] });
      qc.invalidateQueries({ queryKey: ["shopping-lists"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const archiveMut = useMutation({
    mutationFn: () => archiveShoppingList(shoppingListId),
    onSuccess: () => {
      toast.success("Archived");
      qc.invalidateQueries({ queryKey: ["shopping-list", shoppingListId] });
      qc.invalidateQueries({ queryKey: ["shopping-lists"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const restoreMut = useMutation({
    mutationFn: () => restoreShoppingList(shoppingListId),
    onSuccess: () => {
      toast.success("Restored");
      qc.invalidateQueries({ queryKey: ["shopping-list", shoppingListId] });
      qc.invalidateQueries({ queryKey: ["shopping-lists"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteListMut = useMutation({
    mutationFn: () => deleteShoppingList(shoppingListId),
    onSuccess: () => {
      toast.success("Shopping list deleted");
      qc.invalidateQueries({ queryKey: ["shopping-lists"] });
      navigate({ to: "/app/shopping" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteItemMut = useMutation({
    mutationFn: (item: ShoppingListItem) => deleteShoppingListItem(item.id),
    onSuccess: () => {
      toast.success("Item removed");
      invalidateItems();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleMut = useMutation({
    mutationFn: (item: ShoppingListItem) =>
      item.is_purchased ? markShoppingListItemUnpurchased(item.id) : markShoppingListItemPurchased(item.id),
    onMutate: (item) => setPendingToggleId(item.id),
    onSuccess: invalidateItems,
    onError: (e: Error) => toast.error(e.message),
    onSettled: () => setPendingToggleId(null),
  });

  if (listQuery.isLoading) return <div className="text-cocoa/70">Loading…</div>;

  if (!listQuery.data) {
    return (
      <div className="text-cocoa">
        Shopping list not found.{" "}
        <Link to="/app/shopping" className="text-olive-deep underline">
          Back to shopping
        </Link>
      </div>
    );
  }

  const list = listQuery.data;
  const items = itemsQuery.data ?? [];
  const unpurchased = items.filter((i) => !i.is_purchased);
  const purchased = items.filter((i) => i.is_purchased);

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        to="/app/shopping"
        className="mb-3 inline-flex items-center gap-1 text-sm text-cocoa hover:underline"
      >
        <ChevronLeft className="h-4 w-4" /> Back to shopping
      </Link>

      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold text-olive-deep">{list.name}</h1>
          {list.archived_at && (
            <span className="mt-2 inline-block rounded-full bg-cocoa/10 px-2 py-0.5 text-xs text-cocoa">
              Archived list
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowRename(true)}
            className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1.5 text-sm text-cocoa hover:bg-cream-deep/40"
          >
            <Pencil className="h-3.5 w-3.5" /> Rename
          </button>
          {list.archived_at ? (
            <button
              type="button"
              onClick={() => restoreMut.mutate()}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1.5 text-sm text-cocoa hover:bg-cream-deep/40"
            >
              <ArchiveRestore className="h-3.5 w-3.5" /> Restore
            </button>
          ) : (
            <button
              type="button"
              onClick={() => archiveMut.mutate()}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1.5 text-sm text-cocoa hover:bg-cream-deep/40"
            >
              <Archive className="h-3.5 w-3.5" /> Archive
            </button>
          )}
          <button
            type="button"
            onClick={() => setConfirmDeleteList(true)}
            className="inline-flex items-center gap-1 rounded-full border border-terracotta/40 bg-background px-3 py-1.5 text-sm text-terracotta hover:bg-terracotta/10"
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </button>
        </div>
      </header>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setItemForm("create")}
          className="inline-flex items-center gap-1.5 rounded-full bg-olive-deep px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-olive"
        >
          <Plus className="h-4 w-4" /> Add item
        </button>
        {purchased.length > 0 && (
          <button
            type="button"
            onClick={() => setShowKitchenConfirm(true)}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-4 py-2 text-sm text-cocoa hover:bg-cream-deep/40"
          >
            <ChefHat className="h-4 w-4" /> Update Kitchen from purchased items
          </button>
        )}
      </div>

      {itemsQuery.isLoading && <div className="text-cocoa/70">Loading items…</div>}
      {itemsQuery.error && (
        <div className="rounded-xl border border-terracotta/40 bg-terracotta/5 p-4 text-terracotta">
          Failed to load items.
        </div>
      )}

      {!itemsQuery.isLoading && !itemsQuery.error && items.length === 0 && (
        <div className="rounded-3xl border border-dashed border-border bg-cream/40 p-8 text-center">
          <p className="text-sm text-cocoa/70">No items yet. Add your first item above.</p>
        </div>
      )}

      {!itemsQuery.isLoading && !itemsQuery.error && items.length > 0 && (
        <div className="flex flex-col gap-6">
          <section>
            <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-cocoa/60">
              To buy ({unpurchased.length})
            </h2>
            {unpurchased.length === 0 ? (
              <p className="text-sm text-cocoa/50">Nothing left to buy.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {unpurchased.map((item) => (
                  <ShoppingListItemRow
                    key={item.id}
                    item={item}
                    togglePending={pendingToggleId === item.id}
                    onTogglePurchased={(i) => toggleMut.mutate(i)}
                    onEdit={(i) => setItemForm({ edit: i })}
                    onDelete={(i) => {
                      if (window.confirm(`Delete "${i.display_name}"?`)) deleteItemMut.mutate(i);
                    }}
                  />
                ))}
              </ul>
            )}
          </section>

          {purchased.length > 0 && (
            <section>
              <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-cocoa/60">
                Purchased ({purchased.length})
              </h2>
              <ul className="flex flex-col gap-2">
                {purchased.map((item) => (
                  <ShoppingListItemRow
                    key={item.id}
                    item={item}
                    togglePending={pendingToggleId === item.id}
                    onTogglePurchased={(i) => toggleMut.mutate(i)}
                    onEdit={(i) => setItemForm({ edit: i })}
                    onDelete={(i) => {
                      if (window.confirm(`Delete "${i.display_name}"?`)) deleteItemMut.mutate(i);
                    }}
                  />
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      {showRename && (
        <ShoppingListForm
          title="Rename shopping list"
          submitLabel="Save"
          defaultName={list.name}
          isPending={renameMut.isPending}
          onSubmit={(name) => renameMut.mutate(name)}
          onClose={() => setShowRename(false)}
        />
      )}

      {itemForm === "create" && (
        <ShoppingItemForm
          mode="create"
          shoppingListId={shoppingListId}
          onDone={() => {
            setItemForm(null);
            invalidateItems();
          }}
          onClose={() => setItemForm(null)}
        />
      )}
      {itemForm !== null && typeof itemForm === "object" && (
        <ShoppingItemForm
          mode="edit"
          shoppingListId={shoppingListId}
          item={itemForm.edit}
          onDone={() => {
            setItemForm(null);
            invalidateItems();
          }}
          onClose={() => setItemForm(null)}
        />
      )}

      {showKitchenConfirm && (
        <KitchenUpdateConfirmDialog
          purchasedItems={purchased}
          onClose={() => setShowKitchenConfirm(false)}
        />
      )}

      {confirmDeleteList && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        >
          <div className="w-full max-w-sm rounded-3xl bg-background p-6 shadow-[var(--shadow-paper)]">
            <h3 className="font-display text-lg font-semibold text-cocoa">Delete shopping list?</h3>
            <p className="mt-1 text-sm text-cocoa/70">
              This permanently deletes "{list.name}" and its items. Your Kitchen Inventory is never affected.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteList(false)}
                className="rounded-full border border-border px-4 py-2 text-sm text-cocoa"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => deleteListMut.mutate()}
                disabled={deleteListMut.isPending}
                className="rounded-full bg-terracotta px-4 py-2 text-sm font-medium text-white hover:bg-terracotta/90 disabled:opacity-60"
              >
                {deleteListMut.isPending ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
