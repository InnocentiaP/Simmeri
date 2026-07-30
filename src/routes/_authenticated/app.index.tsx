import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { computeReadiness, readinessDisplay, readinessTone } from "@/lib/readiness";
import { BookOpen, Plus, Refrigerator, ChefHat } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { RecipeCoverImage } from "@/components/app/RecipeCoverImage";

export const Route = createFileRoute("/_authenticated/app/")({
  head: () => ({ meta: [{ title: "Home — Simmeri" }] }),
  component: Dashboard,
});

function useDashboardData() {
  return useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const [recipesRes, ingredientsRes, kitchenRes] = await Promise.all([
        supabase.from("recipes").select("*").is("archived_at", null).order("created_at", { ascending: false }),
        supabase.from("recipe_ingredients").select("*"),
        supabase.from("kitchen_items").select("*").is("archived_at", null),
      ]);
      if (recipesRes.error) throw recipesRes.error;
      if (ingredientsRes.error) throw ingredientsRes.error;
      if (kitchenRes.error) throw kitchenRes.error;
      const recipes = recipesRes.data ?? [];
      const ingredients = ingredientsRes.data ?? [];
      const kitchen = kitchenRes.data ?? [];
      const readinessByRecipe = new Map<string, ReturnType<typeof computeReadiness>>();
      for (const r of recipes) {
        const rIng = ingredients
          .filter((i) => i.recipe_id === r.id)
          .map((i) => ({
            display_name: i.display_name,
            importance: i.importance as "core" | "supporting" | "seasoning" | "optional",
          }));
        readinessByRecipe.set(r.id, computeReadiness(rIng, kitchen));
      }
      return { recipes, kitchen, readinessByRecipe };
    },
  });
}

function Dashboard() {
  const { user } = useAuth();
  const { data, isLoading, error } = useDashboardData();

  if (isLoading) return <div className="text-cocoa/70">Loading your kitchen…</div>;
  if (error)
    return <div className="rounded-xl border border-terracotta/40 bg-terracotta/5 p-4 text-terracotta">Failed to load. Refresh to try again.</div>;

  const recipes = data?.recipes ?? [];
  const kitchen = data?.kitchen ?? [];
  const readinessByRecipe = data?.readinessByRecipe ?? new Map();
  const ready = [...readinessByRecipe.values()].filter((r) => r.label === "ready_to_cook").length;
  const almost = [...readinessByRecipe.values()].filter((r) => r.label === "almost_ready").length;
  const recent = recipes.slice(0, 4);

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6">
        <p className="text-sm text-cocoa/70">Welcome back{user?.email ? `, ${user.email.split("@")[0]}` : ""}.</p>
        <h1 className="font-display text-3xl font-semibold text-olive-deep">Your kitchen at a glance</h1>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Active recipes" value={recipes.length} />
        <Stat label="Kitchen items" value={kitchen.length} />
        <Stat label="Ready to cook" value={ready} tone="ready" />
        <Stat label="Almost ready" value={almost} tone="warm" />
      </div>

      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        <QuickAction to="/app/recipes/new" icon={Plus} label="Add recipe" />
        <QuickAction to="/app/recipes" icon={BookOpen} label="My recipes" />
        <QuickAction to="/app/kitchen" icon={Refrigerator} label="Update kitchen" />
      </div>

      <section className="mt-10">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold text-olive-deep">Recent recipes</h2>
          <Link to="/app/recipes" className="text-sm text-cocoa hover:underline">
            View all
          </Link>
        </div>
        {recent.length === 0 ? (
          <EmptyState />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {recent.map((r) => {
              const rd = readinessByRecipe.get(r.id);
              return (
                <li key={r.id}>
                  <Link
                    to="/app/recipes/$recipeId"
                    params={{ recipeId: r.id }}
                    className="flex gap-3 rounded-2xl border border-border/70 bg-background p-4 transition hover:shadow-[var(--shadow-soft)]"
                  >
                    <RecipeCoverImage
                      bucket={r.cover_storage_bucket}
                      path={r.cover_storage_path}
                      alt={`${r.title} cover photo`}
                      className="h-16 w-16 shrink-0 rounded-xl"
                    />
                    <div className="min-w-0 flex-1">
                      <h3 className="font-display text-lg font-semibold text-cocoa">{r.title}</h3>
                      {r.description && <p className="mt-1 line-clamp-2 text-sm text-cocoa/70">{r.description}</p>}
                      {rd && (
                        <div className="mt-3 flex items-center gap-2">
                          <span className={`rounded-full border px-2.5 py-1 text-xs ${readinessTone(rd.label)}`}>
                            {readinessDisplay(rd.label)}
                          </span>
                          <span className="text-xs text-cocoa/60">{rd.short}</span>
                        </div>
                      )}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "ready" | "warm" }) {
  const toneCls =
    tone === "ready"
      ? "text-olive-deep"
      : tone === "warm"
        ? "text-caramel"
        : "text-cocoa";
  return (
    <div className="rounded-2xl border border-border/70 bg-background p-4">
      <div className={`font-display text-3xl font-semibold ${toneCls}`}>{value}</div>
      <div className="mt-1 text-xs uppercase tracking-wide text-cocoa/60">{label}</div>
    </div>
  );
}

function QuickAction({ to, icon: Icon, label }: { to: string; icon: typeof Plus; label: string }) {
  return (
    <Link
      to={to as any}
      className="flex items-center gap-3 rounded-2xl border border-border/70 bg-background p-4 hover:bg-cream-deep/40"
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-olive-deep/10 text-olive-deep">
        <Icon className="h-4 w-4" />
      </span>
      <span className="text-sm font-medium text-cocoa">{label}</span>
    </Link>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center rounded-3xl border border-dashed border-border bg-cream/40 p-8 text-center">
      <ChefHat className="mb-3 h-8 w-8 text-olive-deep" />
      <h3 className="font-display text-lg font-semibold text-cocoa">No recipes yet</h3>
      <p className="mt-1 max-w-sm text-sm text-cocoa/70">Add your first recipe and Simi will help you see what you can cook tonight.</p>
      <Link
        to="/app/recipes/new"
        className="mt-4 rounded-full bg-olive-deep px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-olive"
      >
        Add your first recipe
      </Link>
    </div>
  );
}
