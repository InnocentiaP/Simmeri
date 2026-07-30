import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Home,
  BookOpen,
  Plus,
  Refrigerator,
  Settings,
  LogOut,
  Menu,
  X,
  FolderOpen,
  CalendarDays,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

// Ordered so the mobile bottom nav's slice(0, 5) below shows the five
// highest-frequency items (the core Plan/Cook loop) — Collections, Add
// Recipe, and Settings are still fully reachable via the drawer and the
// desktop sidebar, just not the mobile bottom bar. "Shopping" is added to
// this array by a later checkpoint, once it exists.
const nav = [
  { to: "/app" as const, label: "Home", icon: Home, exact: true },
  { to: "/app/recipes" as const, label: "My Recipes", icon: BookOpen, exact: false },
  { to: "/app/planner" as const, label: "Meal Plan", icon: CalendarDays, exact: false },
  { to: "/app/kitchen" as const, label: "Kitchen", icon: Refrigerator, exact: true },
  { to: "/app/collections" as const, label: "Collections", icon: FolderOpen, exact: false },
  { to: "/app/recipes/new" as const, label: "Add Recipe", icon: Plus, exact: true },
  { to: "/app/settings" as const, label: "Settings", icon: Settings, exact: true },
];

export function AppShell({ children }: { children?: ReactNode }) {
  const [openMobile, setOpenMobile] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const isActive = (to: string, exact: boolean) =>
    exact ? pathname === to : pathname === to || pathname.startsWith(to + "/");

  async function handleSignOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    toast.success("Signed out");
    navigate({ to: "/login", replace: true });
  }

  return (
    <div className="min-h-screen bg-cream/40 text-foreground">
      {/* Top bar */}
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border/60 bg-background/90 px-4 backdrop-blur">
        <div className="flex items-center gap-3">
          <button
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/60 md:hidden"
            aria-label="Toggle menu"
            onClick={() => setOpenMobile((v) => !v)}
          >
            {openMobile ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
          <Link to="/app" className="flex items-center gap-2">
            <img src="/images/simmeri/simi-logo.png" alt="Simmeri" className="h-8 w-auto" />
            <span className="font-display text-lg font-semibold text-olive-deep">Simmeri</span>
          </Link>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-muted-foreground sm:inline">
            {user?.email}
          </span>
          <button
            onClick={handleSignOut}
            className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background px-3 py-1.5 text-sm text-cocoa hover:bg-cream-deep/50"
          >
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </button>
        </div>
      </header>

      <div className="flex">
        {/* Desktop sidebar */}
        <aside className="hidden w-56 shrink-0 border-r border-border/60 bg-background/60 p-3 md:block">
          <nav className="flex flex-col gap-1">
            {nav.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.to, item.exact);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition-colors ${
                    active
                      ? "bg-olive-deep text-primary-foreground"
                      : "text-cocoa hover:bg-cream-deep/50"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Mobile drawer */}
        {openMobile && (
          <div className="fixed inset-0 top-14 z-30 bg-background/95 p-4 md:hidden">
            <nav className="flex flex-col gap-1">
              {nav.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.to, item.exact);
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setOpenMobile(false)}
                    className={`flex items-center gap-2.5 rounded-xl px-3 py-3 text-base transition-colors ${
                      active
                        ? "bg-olive-deep text-primary-foreground"
                        : "text-cocoa hover:bg-cream-deep/50"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        )}

        <main className="min-h-[calc(100vh-3.5rem)] flex-1 p-4 pb-24 sm:p-6 md:p-8 md:pb-8">
          {children ?? <Outlet />}
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex justify-around border-t border-border/60 bg-background/95 px-2 py-1.5 backdrop-blur md:hidden">
        {nav.slice(0, 5).map((item) => {
          const Icon = item.icon;
          const active = isActive(item.to, item.exact);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`flex min-w-[56px] flex-col items-center justify-center rounded-lg px-2 py-1 text-[11px] ${
                active ? "text-olive-deep" : "text-cocoa/70"
              }`}
            >
              <Icon className="mb-0.5 h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
