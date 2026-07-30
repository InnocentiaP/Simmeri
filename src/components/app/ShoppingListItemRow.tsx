import { Pencil, Trash2 } from "lucide-react";
import type { ShoppingListItem } from "@/lib/api";

interface ShoppingListItemRowProps {
  item: ShoppingListItem;
  onTogglePurchased: (item: ShoppingListItem) => void;
  onEdit: (item: ShoppingListItem) => void;
  onDelete: (item: ShoppingListItem) => void;
  togglePending?: boolean;
}

// No "Needed for" provenance line yet — shopping_item_sources and
// generation-driven items are Checkpoint 3. Every item here is manually
// added, so there is nothing to attribute.
export function ShoppingListItemRow({
  item,
  onTogglePurchased,
  onEdit,
  onDelete,
  togglePending,
}: ShoppingListItemRowProps) {
  return (
    <li className="flex items-start gap-3 rounded-xl border border-border/60 bg-background p-3">
      <label className="mt-0.5 flex items-center">
        <input
          type="checkbox"
          checked={item.is_purchased}
          disabled={togglePending}
          onChange={() => onTogglePurchased(item)}
          aria-label={item.is_purchased ? `Mark ${item.display_name} unpurchased` : `Mark ${item.display_name} purchased`}
          className="h-4 w-4"
        />
      </label>
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-medium ${item.is_purchased ? "text-cocoa/50 line-through" : "text-cocoa"}`}>
          {item.display_name}
          {(item.quantity_text || item.unit) && (
            <span className="font-normal text-cocoa/60">
              {" — "}
              {[item.quantity_text, item.unit].filter(Boolean).join(" ")}
            </span>
          )}
        </p>
        {item.note && <p className="mt-0.5 text-xs text-cocoa/60">{item.note}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={() => onEdit(item)}
          aria-label={`Edit ${item.display_name}`}
          title="Edit"
          className="rounded-full p-1.5 text-cocoa hover:bg-cream-deep/40"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => onDelete(item)}
          aria-label={`Delete ${item.display_name}`}
          title="Delete"
          className="rounded-full p-1.5 text-terracotta hover:bg-terracotta/10"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </li>
  );
}
