import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Search } from "lucide-react";
import type { KitchenItem } from "@/lib/api";

export const Route = createFileRoute("/_authenticated/app/kitchen")({
  head: () => ({ meta: [{ title: "Kitchen — Simmeri" }] }),
  component: Kitchen,
});

const STATUSES = [
  { value: "available", label: "Available" },
  { value: "running_low", label: "Running low" },
  { value: "out_of_stock", label: "Out of stock" },
  { value: "unknown", label: "Unknown" },
] as const;

const LOCATIONS = [
  { value: "pantry", label: "Pantry" },
  { value: "refrigerator", label: "Refrigerator" },
  { value: "freezer", label: "Freezer" },
  { value: "spice_rack", label: "Spice rack" },
  { value: "other", label: "Other" },
] as const;

function Kitchen() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [locationFilter, setLocationFilter] = useState<string>("all");
  const [showAdd, setShowAdd] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["kitchen"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("kitchen_items")
        .select("*")
        .is("archived_at", null)
        .order("ingredient_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<KitchenItem> }) => {
      const { error } = await supabase.from("kitchen_items").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries(),
    onError: (e: Error) => toast.error(e.message),
  });

  const removeMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("kitchen_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Removed");
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    const list = data ?? [];
    const needle = q.trim().toLowerCase();
    return list.filter((k) => {
      if (needle && !k.ingredient_name.toLowerCase().includes(needle)) return false;
      if (statusFilter !== "all" && k.status !== statusFilter) return false;
      if (locationFilter !== "all" && k.storage_location !== locationFilter) return false;
      return true;
    });
  }, [data, q, statusFilter, locationFilter]);

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold text-olive-deep">Kitchen</h1>
          <p className="text-sm text-cocoa/70">Track what you have on hand.</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="inline-flex items-center gap-1.5 rounded-full bg-olive-deep px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-olive"
        >
          <Plus className="h-4 w-4" /> Add ingredient
        </button>
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-cocoa/50" />
          <input
            placeholder="Search ingredients…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full rounded-full border border-border bg-background py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-olive-deep/40"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-full border border-border bg-background px-3 py-2 text-sm"
        >
          <option value="all">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <select
          value={locationFilter}
          onChange={(e) => setLocationFilter(e.target.value)}
          className="rounded-full border border-border bg-background px-3 py-2 text-sm"
        >
          <option value="all">All locations</option>
          {LOCATIONS.map((l) => (
            <option key={l.value} value={l.value}>
              {l.label}
            </option>
          ))}
        </select>
      </div>

      {isLoading && <div className="text-cocoa/70">Loading…</div>}
      {error && <div className="text-terracotta">Failed to load kitchen.</div>}

      {!isLoading && filtered.length === 0 && (
        <div className="rounded-3xl border border-dashed border-border bg-cream/40 p-8 text-center">
          <p className="text-cocoa">
            {q || statusFilter !== "all" || locationFilter !== "all"
              ? "No ingredients match your filters."
              : "Your kitchen is empty. Add ingredients to see what you can cook."}
          </p>
        </div>
      )}

      {filtered.length > 0 && (
        <div className="overflow-hidden rounded-3xl border border-border/70 bg-background">
          <table className="w-full text-sm">
            <thead className="bg-cream-deep/40 text-left text-xs uppercase tracking-wide text-cocoa/70">
              <tr>
                <th className="px-4 py-3">Ingredient</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3 w-10" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((k) => (
                <tr key={k.id} className="border-t border-border/50">
                  <td className="px-4 py-3 font-medium text-cocoa">{k.ingredient_name}</td>
                  <td className="px-4 py-3">
                    <select
                      value={k.status}
                      onChange={(e) =>
                        updateMut.mutate({ id: k.id, patch: { status: e.target.value } })
                      }
                      className="rounded-lg border border-border bg-background px-2 py-1 text-sm"
                    >
                      {STATUSES.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={k.storage_location}
                      onChange={(e) =>
                        updateMut.mutate({ id: k.id, patch: { storage_location: e.target.value } })
                      }
                      className="rounded-lg border border-border bg-background px-2 py-1 text-sm"
                    >
                      {LOCATIONS.map((l) => (
                        <option key={l.value} value={l.value}>
                          {l.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => removeMut.mutate(k.id)}
                      aria-label={`Remove ${k.ingredient_name}`}
                      className="rounded-full border border-border p-1.5 text-terracotta hover:bg-terracotta/10"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showAdd && <AddItemDialog onClose={() => setShowAdd(false)} />}
    </div>
  );
}

function AddItemDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [status, setStatus] = useState<string>("available");
  const [location, setLocation] = useState<string>("pantry");
  const mut = useMutation({
    mutationFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      const { error } = await supabase.from("kitchen_items").insert({
        user_id: user.id,
        ingredient_name: name.trim(),
        status,
        storage_location: location,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Added");
      qc.invalidateQueries();
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return toast.error("Name is required");
          mut.mutate();
        }}
        className="w-full max-w-md rounded-3xl bg-background p-6 shadow-[var(--shadow-paper)]"
      >
        <h3 className="font-display text-lg font-semibold text-olive-deep">Add ingredient</h3>
        <div className="mt-4 flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-cocoa">Ingredient name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-cocoa">Status</span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
            >
              {STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-cocoa">Storage location</span>
            <select
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
            >
              {LOCATIONS.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-border px-4 py-2 text-sm text-cocoa"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={mut.isPending}
            className="rounded-full bg-olive-deep px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-olive disabled:opacity-60"
          >
            {mut.isPending ? "Adding…" : "Add"}
          </button>
        </div>
      </form>
    </div>
  );
}
