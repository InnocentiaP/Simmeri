# Course Submission MVP — Implementation Plan (Simmeri / RecipeVault)

> **Status: Approved.** This is the authoritative implementation plan for the active roadmap — the graded Course Submission MVP. It supersedes the former generic Phase 0 → Phase 1 sequencing for immediate work. See `docs/sprints/CURRENT_SPRINT.md` for the live checkpoint status (what's done, what's pending, what's authorized next). The long-term Simmeri/RecipeVault product roadmap (`docs/product/RecipeVault_Master_PRD_Implementation_Baseline_v1.3.html`, `docs/product/SIMMERI_MASTER_BUILD_BRIEF.md`, `docs/sprints/PHASE_01_APP_FOUNDATION.md`) remains valid beyond this submission and is not being discarded.

## Context

The project priority changed: a graded course submission is due. It must be a deployed, functional web app with real Supabase-backed CRUD, built on the already-audited stack (TanStack Start + Vite + Nitro + Supabase, no Next.js/Prisma), preserving the existing landing page. This is a scoped vertical slice of the long-term Simmeri/RecipeVault PRD — auth, Recipe CRUD, Kitchen CRUD, deterministic Cooking Readiness, and a real-data dashboard — deployed to a working `.vercel.app` URL. Implementation proceeds checkpoint by checkpoint with review points in between.

Research performed as part of Phase 0 follow-up (read-only) resolved every open question from the original repository audit in the context of this new scope. Those resolutions are locked in below as **Architecture Decisions** and drive every checkpoint.

---

## Architecture Decisions (resolved)

| Question | Decision | Why |
|---|---|---|
| Package manager | **npm** authoritative for local dev/validation. `bun.lock`/`bunfig.toml` left untouched, not regenerated (per explicit instruction) — `package-lock.json` becomes the actively maintained lockfile, `bun.lock` will drift and that's accepted. | User directive. |
| SSR session model | **`@supabase/ssr`**, cookie-based. New dependency. Replaces the existing bearer-token middleware pair. | User directive; also the only model that works cleanly for SSR'd protected routes without every navigation round-tripping a token by hand. |
| RLS ownership pattern | Denormalize `user_id` directly onto every child table (`recipe_ingredients`, `recipe_steps`, `kitchen_items`), not just the parent (`recipes`). Policies become `user_id = auth.uid()` everywhere — no `EXISTS` subqueries. | Simpler, faster, and easier to unit-verify than join-based policies; standard Supabase-recommended pattern. Set server-side from the authenticated context, never trusted from client input. |
| Ingredient matching for readiness | **No canonical ingredient catalog in this MVP.** `recipe_ingredients.display_name` is matched against `kitchen_items.ingredient_name` by normalized (trim + lowercase) text equality. | Master Ingredient Catalog is out of the MVP's explicit scope (recipe ingredients carry `display_name`/`raw_text` only, not an `ingredientId` FK). This is a documented limitation, not an oversight — flagged again in Risks. |
| Readiness computation location | **Pure TypeScript domain module**, invoked from a `createServerFn` behind the auth middleware — not a raw SQL view, not client-side. | Business rules (weights, label thresholds, explanations) are branchy and read better in TypeScript; keeping it a pure function (data in, label+reasons out) makes it trivially unit-testable without a live DB, while still running server-side so nothing sensitive leaks to the client. |
| Testing | Vitest + Testing Library + jsdom, approved. No Playwright. | User directive. |
| Deployment target | Nitro `vercel` preset (confirmed available in the installed `nitro@3.0.260603-beta`), pinned explicitly via `vite.config.ts`, plus a minimal `vercel.json` safety net. | See Checkpoint A — this was the critical open technical risk from the audit and is now fully resolved with file-level evidence, and confirmed working by a successful local `npm run build`. |

---

## Vercel / Nitro Deployment — Resolved Technical Spike

`@lovable.dev/vite-tanstack-config` exposes a first-class `nitro` option on `defineConfig({...})` (documented in its own `.d.ts`: *"Set `preset` (e.g. `{ preset: "vercel" }`) to hard-pin a target"*). The Cloudflare default (`defaultPreset: "cloudflare-module"`) is only a fallback and is force-overridden to Cloudflare **only** inside Lovable's own sandbox (`LOVABLE_SANDBOX`/`DEV_SERVER__PROJECT_PATH` env vars) — neither is set on Vercel's build machines, so an explicit preset flows straight through.

**Minimal safe change** (Checkpoint A — implemented and locally validated):

`vite.config.ts` — one key added to the existing `defineConfig({...})` call:
```ts
export default defineConfig({
  tanstackStart: { server: { entry: "server" } },
  nitro: { preset: "vercel" },
});
```
`nitro@3.0.260603-beta` (installed) ships a `vercel` preset (`node_modules/nitro/dist/_presets.mjs`) that writes Vercel's Build Output API v3 directly to `.vercel/output/` — Vercel's platform consumes that with zero further config once it exists after `vite build` runs. Confirmed locally: `npm run build` logged `nitro:vercel` and generated `.vercel/output/static` plus a real `__server.func` serverless function.

`vercel.json` (repo root, minimal):
```json
{ "buildCommand": "npm run build", "framework": null }
```
`framework: null` stops Vercel guessing an unrelated framework preset (TanStack Start has no native Vercel detection entry); `buildCommand` pins the existing `"build": "vite build"` script explicitly. No `outputDirectory` is set — the Build Output API directory supersedes it.

**Ancillary setting (not a code change, a dashboard setting):** `@tanstack/react-start` requires Node `>=22.12.0`, `nitro` requires `^20.19.0 || >=22.12.0`. `package.json` now declares `"engines": { "node": ">=22.12.0" }` so Vercel's Node version selection matches what the framework requires, rather than relying on Vercel's account-level default.

---

## Database Schema Design (all migrations additive, RLS on every table, owner-only)

One new migration file per checkpoint (B, C, D), building on the existing `20260727200157_...` migration (untouched).

**Checkpoint B migration** — `profiles`, `user_preferences`:
```sql
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "owner select" on public.profiles for select to authenticated using (id = auth.uid());
create policy "owner update" on public.profiles for update to authenticated using (id = auth.uid());
create policy "owner insert" on public.profiles for insert to authenticated with check (id = auth.uid());

create table public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  language text not null default 'en',
  measurement_system text not null default 'metric' check (measurement_system in ('metric','imperial')),
  timezone text not null default 'UTC',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.user_preferences enable row level security;
create policy "owner all" on public.user_preferences for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Auto-provision on signup (SECURITY DEFINER trigger, standard Supabase pattern)
create function public.handle_new_user() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id);
  insert into public.user_preferences (user_id) values (new.id);
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
```

**Checkpoint C migration** — `recipes`, `recipe_ingredients`, `recipe_steps`:
```sql
create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  servings integer,
  prep_time_minutes integer,
  cook_time_minutes integer,
  notes text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.recipes enable row level security;
create policy "owner all" on public.recipes for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create table public.recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  raw_text text not null,
  display_name text not null,
  quantity_text text,
  unit text,
  preparation_note text,
  importance text not null default 'supporting' check (importance in ('core','supporting','seasoning','optional')),
  position integer not null default 0
);
alter table public.recipe_ingredients enable row level security;
create policy "owner all" on public.recipe_ingredients for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create table public.recipe_steps (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  instruction text not null,
  position integer not null default 0
);
alter table public.recipe_steps enable row level security;
create policy "owner all" on public.recipe_steps for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
```
`user_id` on child tables is set server-side from the authenticated context in the server function/mutation, never accepted from client-submitted `data`.

**Checkpoint D migration** — `kitchen_items` (+ optional stretch `shopping_list_items`):
```sql
create table public.kitchen_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  ingredient_name text not null,
  status text not null default 'unknown' check (status in ('available','running_low','out_of_stock','unknown')),
  storage_location text not null default 'pantry' check (storage_location in ('pantry','refrigerator','freezer','spice_rack','other')),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.kitchen_items enable row level security;
create policy "owner all" on public.kitchen_items for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
```
Stretch (only if time allows, after Checkpoint E core is done): `shopping_list_items(id, user_id, recipe_id nullable fk, ingredient_text, quantity_text, is_purchased boolean default false, created_at)`, same owner-only RLS pattern.

---

## Cooking Readiness — Domain Design

New file `src/domain/readiness.ts` (pure, no imports from Supabase/React — fully unit-testable):

```ts
type Presence = "present" | "present_warning" | "needs_checking" | "missing";
const WEIGHT = { core: 5, supporting: 3, seasoning: 1, optional: 0 } as const;

function presenceFor(status: KitchenStatus | "not_in_kitchen"): Presence { /* available→present, running_low→present_warning, unknown→needs_checking, out_of_stock|not_in_kitchen→missing */ }

export function calculateReadiness(ingredients: ReadinessIngredientInput[]): {
  label: "Ready to Cook" | "Check First" | "Almost Ready" | "Needs Shopping" | "Not Ready";
  reasons: string[];
}
```

Deterministic label rules (in priority order — never a raw "count of missing" heuristic):
1. Any **Core** ingredient missing → **Not Ready**.
2. Else any Supporting/Seasoning ingredient missing → **Needs Shopping**.
3. Else any ingredient `needs_checking` (Unknown status, or no matching kitchen item at all) → **Check First**.
4. Else any ingredient `present_warning` (Running Low) → **Almost Ready**.
5. Else (everything Available) → **Ready to Cook**.

Optional ingredients are excluded from every rule above (weight 0, never block). `reasons` is a plain string array built alongside the label (e.g. `"Missing core ingredient: chicken breast"`, `"2 supporting ingredients running low"`) so the UI can render an explanation without re-deriving it.

Server boundary: `src/lib/server/recipes.server-fns.ts` exposes `getRecipeReadiness = createServerFn().middleware([requireAuth]).validator(z.object({ recipeId: z.string().uuid() })).handler(...)` — loads the recipe's ingredients and the user's kitchen items (RLS-scoped client from `context`), normalizes ingredient name → kitchen status via case-insensitive trim match, calls `calculateReadiness`, returns `{ label, reasons }`. The dashboard's "Ready to Cook"/"Almost Ready" counts call this per active recipe (or a batched variant) server-side, never client-side.

---

## Auth Architecture (replaces the currently-unused bearer-token scaffolding)

- **New dependency:** `@supabase/ssr` (peer-compatible with installed `@supabase/supabase-js@2.110.9`).
- `src/integrations/supabase/client.ts` → rewritten to use `createBrowserClient` from `@supabase/ssr` (cookie-backed session storage instead of `localStorage`, so the same session is readable server-side).
- New `src/integrations/supabase/server-client.server.ts` → `getServerSupabase()` builds a request-scoped client via `createServerClient` (`@supabase/ssr`), wired to `getCookie`/`setCookie`/`deleteCookie` from `@tanstack/react-start/server` (confirmed exported, already used in the existing `auth-middleware.ts`). Uses the **publishable** key only — RLS-scoped as the calling user, never service-role.
- `src/integrations/supabase/client.server.ts` (existing service-role admin client) is **kept but untouched and unused by any user-facing flow**, per instruction — reserved for a future genuinely-admin task, not normal session handling.
- `src/integrations/supabase/auth-attacher.ts` (client-side bearer-token middleware) is **removed** — cookies ride along automatically on same-origin server-fn calls, making manual token-attachment redundant.
- `src/integrations/supabase/auth-middleware.ts` → rewritten as `requireAuth`, a server `createMiddleware` that calls `getServerSupabase()` then `supabase.auth.getUser()`; throws an unauthorized error if absent, else `return next({ context: { supabase, userId } })`. Every recipe/kitchen/readiness server function adds this middleware.
- `src/start.ts` → drop `attachSupabaseAuth` from `functionMiddleware`; keep `errorMiddleware` + `createCsrfMiddleware` as-is (CSRF protection matters *more* now that auth is cookie-based, and it's already wired — no change needed there).
- **Route guard:** new `src/routes/app/route.tsx` layout route with `beforeLoad: async ({ context }) => { const { user } = await getCurrentUser(); if (!user) throw redirect({ to: '/login' }) }`, where `getCurrentUser` is a small `createServerFn` reading the session via `getServerSupabase()`. This works identically for SSR page loads and client-side navigations (TanStack Start server functions are isomorphic), avoiding separate client/server auth-check code paths.
- **PKCE callback route:** `@supabase/ssr` uses the PKCE flow (`?code=...`), so a new `src/routes/auth/callback.tsx` is required to call `supabase.auth.exchangeCodeForSession(code)` and redirect to `/app` (signup/login confirmation) or `/reset-password` (password recovery), based on a `type`/`next` param.

---

## Checkpoint A — Documentation, Environment Hygiene, Vercel Spike, Baseline Deploy

1. **Objective:** Get the *current* app (landing page only, no new features) deploying to a working `.vercel.app` URL, and fix the `.env` tracking issue, before any feature code is written — de-risks deployment early.
2. **Dependencies:** None (first checkpoint).
3. **Files to create:** `vercel.json`; `.env.example` (placeholder names only, mirroring current `.env` keys: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_PROJECT_ID`, and their `VITE_`-prefixed twins, plus new `SUPABASE_SERVICE_ROLE_KEY=` placeholder documented as **never** VITE-prefixed).
4. **Files to modify:** `vite.config.ts` (add `nitro: { preset: "vercel" }`); `package.json` (add `"engines": { "node": ">=22.12.0" }`); `.gitignore` (add `.env`, `.env.*`, then `!.env.example`, plus `.vercel/`).
5. **Routes:** none.
6. **Database migration design:** none.
7. **RLS policies:** none.
8. **Server/client boundaries:** none — this checkpoint is pure build/deploy config.
9. **Validation:** none beyond `npm run lint` / `npm run build` locally.
10. **Tests:** none yet (test infra lands in Checkpoint E).
11. **Acceptance criteria:** `npm run build` succeeds locally producing `.vercel/output` (confirmed); `git rm --cached .env` applied (file preserved on disk, untracked going forward — done); pushing the branch and connecting it in Vercel produces a working `.vercel.app` URL serving the unmodified landing page, including the early-access form still writing to Supabase (pending).
12. **Risks:** Nitro's `vercel` preset was new territory for this repo — resolved: the first real local build succeeded and produced the expected Build Output API v3 directory and a real serverless function. Residual risk is specific to Vercel's own build environment (Node runtime function size limits, etc.), not visible from a local build alone.
13. **Rollback strategy:** Vercel deployments are immutable; rollback = re-promote the previous working deployment from the Vercel dashboard or `vercel rollback`. No DB changes in this checkpoint, so no data rollback needed.
14. **Estimated complexity:** Low–Medium (mostly config; medium only because it's an unverified-until-tried Nitro preset — now verified locally).

## Checkpoint B — Authentication, Session Architecture, Profiles/Preferences, Protected `/app` Shell

1. **Objective:** Real Supabase Auth (signup/login/logout/forgot-reset password), cookie-based SSR sessions, auto-provisioned profile/preferences, and a protected `/app` shell with responsive nav — no product data yet.
2. **Dependencies:** Checkpoint A deployed and stable.
3. **Files to create:** `src/integrations/supabase/server-client.server.ts`; `src/routes/login.tsx`, `src/routes/signup.tsx`, `src/routes/forgot-password.tsx`, `src/routes/reset-password.tsx`, `src/routes/auth/callback.tsx`; `src/routes/app/route.tsx` (layout + guard), `src/routes/app/index.tsx` (bare shell/placeholder dashboard), `src/routes/app/settings.tsx`; `src/components/app/AppShellDesktopNav.tsx`, `src/components/app/AppShellMobileNav.tsx` (built on existing `sidebar.tsx`/`sheet.tsx` primitives); `src/lib/server/auth.server-fns.ts` (`getCurrentUser`); `supabase/migrations/<ts>_profiles_and_preferences.sql` (schema above).
4. **Files to modify:** `src/integrations/supabase/client.ts` (→ `createBrowserClient`); `src/integrations/supabase/auth-middleware.ts` (→ cookie-based `requireAuth`); `src/start.ts` (drop bearer middleware); `src/routes/__root.tsx` (mount `<Toaster />`, since it's currently unwired anywhere); `src/components/landing/Navbar.tsx` (swap the `href="#early-access"` "Log in" anchor for a router `<Link to="/login">`); `package.json` (add `@supabase/ssr`).
5. **Routes:** `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/auth/callback`, `/app` (layout), `/app/` (index), `/app/settings`.
6. **Database migration design:** `profiles` + `user_preferences` + `handle_new_user` trigger, as specified above.
7. **RLS policies:** owner-only select/insert/update on `profiles`; owner-only all on `user_preferences` (both shown above).
8. **Server/client boundaries:** `requireAuth` middleware wraps every future protected server function; `getCurrentUser` server fn backs the `/app` route guard; browser client used directly for `signInWithPassword`/`signUp`/`signOut`/`resetPasswordForEmail` calls (standard supabase-js client calls, no server fn needed for these since `@supabase/ssr`'s browser client manages the cookie itself).
9. **Validation:** Zod schemas for login/signup/forgot/reset forms via `react-hook-form` + shadcn `form.tsx` + `@hookform/resolvers/zod` (all already installed, currently unused — first real consumer). Safe generic error messages on auth failure (no user-enumeration leaks — Supabase's own error messages are already generic enough by default).
10. **Tests:** unit tests for the `beforeLoad` guard logic (extracted as a small testable function taking `{ user }` → redirect-or-not) and for the auth Zod schemas' edge cases (invalid email, short password, mismatched confirm-password).
11. **Acceptance criteria:** unauthenticated visit to any `/app/*` route redirects to `/login` with no flash of protected content; successful signup auto-creates `profiles`/`user_preferences` rows; login/logout round-trip works via cookies (verified by a hard browser refresh on `/app` staying authenticated); password reset email link lands on `/reset-password` via `/auth/callback` and successfully updates the password; landing page and early-access form remain visually/functionally unchanged.
12. **Risks:** PKCE callback redirect URL must be registered in Supabase Auth settings (production `.vercel.app` URL + local dev URL) or the flow silently fails — must be configured in Supabase dashboard, not just code. Removing the bearer-token middleware is a real behavior change from the audited baseline — verify no other code path still expects an `Authorization` header before deleting `auth-attacher.ts`.
13. **Rollback strategy:** migration is purely additive (new tables/trigger) — reversible by a follow-up down-migration dropping the trigger/tables if needed; no existing data touched. Code rollback via redeploying the prior Vercel deployment (Checkpoint A's).
14. **Estimated complexity:** High (this checkpoint carries all the new architectural risk — new dependency, new session model, first protected routes).

**Not yet authorized.** Requires a separate explicit go-ahead after Checkpoint A's production deployment is confirmed working (see `docs/sprints/CURRENT_SPRINT.md`).

## Checkpoint C — Recipe CRUD, Ingredients, Steps, Ownership/RLS

1. **Objective:** Full manual recipe CRUD with reorderable ingredients (with importance) and steps, owned and RLS-isolated per user.
2. **Dependencies:** Checkpoint B (auth + `requireAuth` middleware + `/app` shell) merged and working.
3. **Files to create:** `src/routes/app/recipes/index.tsx` (list), `src/routes/app/recipes/new.tsx` (create), `src/routes/app/recipes/$recipeId.tsx` (detail), `src/routes/app/recipes/$recipeId.edit.tsx` (edit); `src/lib/server/recipes.server-fns.ts` (`listRecipes`, `getRecipe`, `createRecipe`, `updateRecipe`, `archiveRecipe`, `deleteRecipe`, plus ingredient/step sub-mutations `upsertIngredients`, `upsertSteps` — batched per-recipe save rather than one call per row, simpler transactionally); `src/components/recipes/RecipeForm.tsx`, `RecipeIngredientsEditor.tsx` (add/edit/reorder/remove rows, `position` maintained on button-based reorder — buttons/keyboard first, no forced drag-and-drop), `RecipeStepsEditor.tsx`, `RecipeCard.tsx`; `src/lib/schemas/recipe.ts` (Zod schemas: recipe, ingredient row, step row); `supabase/migrations/<ts>_recipes.sql` (schema above).
4. **Files to modify:** `src/routes/app/index.tsx` (wire in a "recent recipes" / quick-action section — full dashboard data lands in Checkpoint D but the route already exists from B).
5. **Routes:** `/app/recipes`, `/app/recipes/new`, `/app/recipes/$recipeId`, `/app/recipes/$recipeId/edit`.
6. **Database migration design:** `recipes`, `recipe_ingredients`, `recipe_steps` as specified above.
7. **RLS policies:** owner-only `for all` on all three tables (denormalized `user_id`).
8. **Server/client boundaries:** all mutations go through `createServerFn().middleware([requireAuth])` — client never writes directly to `recipes`/`recipe_ingredients`/`recipe_steps` via the browser Supabase client (unlike the early-access form's direct-insert pattern), because `user_id` must be set from the authenticated server context, not trusted client input. Reads also go through server fns for one consistent boundary and easier testing.
9. **Validation:** Zod schemas enforce required `title`, sane numeric ranges for servings/prep/cook time, `importance` enum, non-empty `instruction`/`display_name`; React Hook Form + shadcn `form.tsx` for inline field errors; server-side re-validation in the `createServerFn().validator(...)` (never trust client validation alone).
10. **Tests:** Zod schema unit tests (valid/invalid recipe payloads); a component test for `RecipeIngredientsEditor` reorder behavior (position array updates correctly on move-up/move-down).
11. **Acceptance criteria:** a user can create a recipe with ≥1 ingredient and ≥1 step, see it in their list, open detail, edit every field including reordering ingredients/steps, archive it (disappears from default list, still fetchable), and hard-delete it; a second test user cannot see or mutate the first user's recipes (manual RLS check, formalized in Checkpoint E).
12. **Risks:** Reorder UX (buttons vs. drag) needs to stay keyboard-accessible — plan explicitly avoids drag-and-drop-only controls.
13. **Rollback strategy:** additive migration, reversible via down-migration dropping the three new tables if the checkpoint needs to be backed out; no cross-table cascades touch pre-existing data (`early_access_signups`, `profiles`, `user_preferences` untouched).
14. **Estimated complexity:** Medium–High (most UI surface area of the whole MVP — three related editable collections in one form flow).

**Not yet authorized.**

## Checkpoint D — Kitchen Inventory CRUD, Cooking Readiness, Real-Data Dashboard

1. **Objective:** Kitchen CRUD with search/filter, the deterministic readiness engine wired end-to-end, and a dashboard reflecting real per-user aggregates.
2. **Dependencies:** Checkpoint C (recipes/ingredients exist to compute readiness against).
3. **Files to create:** `src/routes/app/kitchen/index.tsx`; `src/domain/readiness.ts` (pure module, as specified above) + `src/domain/readiness.test.ts`; `src/lib/server/kitchen.server-fns.ts` (`listKitchenItems`, `createKitchenItem`, `updateKitchenItem`, `archiveKitchenItem`, `deleteKitchenItem`); `src/lib/server/recipes.server-fns.ts` additions (`getRecipeReadiness`, `listRecipeReadinessSummary` for dashboard counts); `src/lib/server/dashboard.server-fns.ts` (`getDashboardSummary`: active recipe count, kitchen item count, ready/almost-ready counts, 5 most-recent recipes); `src/components/kitchen/KitchenItemForm.tsx`, `KitchenItemList.tsx` (search + status/location filters), `ReadinessBadge.tsx` (label + reasons tooltip/expandable); `src/lib/schemas/kitchen.ts`.
4. **Files to modify:** `src/routes/app/index.tsx` (real dashboard: cards for the four counts + recent-recipes list + quick actions, replacing Checkpoint B/C's placeholder content — **no hardcoded numbers**); `src/routes/app/recipes/$recipeId.tsx` (render live readiness label + reasons via `getRecipeReadiness`).
5. **Routes:** `/app/kitchen`; `/app/` (dashboard, now data-complete).
6. **Database migration design:** `kitchen_items` as specified above.
7. **RLS policies:** owner-only `for all` on `kitchen_items`.
8. **Server/client boundaries:** readiness is *only* computable server-side (`getRecipeReadiness` server fn) — the pure `calculateReadiness` function itself has zero I/O and is imported by both the server fn (real use) and the Vitest suite (unit tests), never called from browser code directly. Kitchen CRUD follows the same server-fn-for-writes pattern established in Checkpoint C.
9. **Validation:** Zod schema for kitchen item (`ingredient_name` required, `status`/`storage_location` enums); search/filter are client-side query-string state against a server-fn-fetched list.
10. **Tests:** the bulk of the domain test suite lives here — `readiness.test.ts` covers all five label branches plus edge cases (all-optional recipe, empty kitchen, ingredient name matched case-insensitively/with whitespace); Kitchen status-transition tests.
11. **Acceptance criteria:** creating/editing/archiving a kitchen item works and is owner-isolated; a recipe's readiness label changes correctly when the underlying kitchen item's status changes; dashboard counts match real data, zero hardcoded values; a brand-new user sees an honest empty dashboard.
12. **Risks:** name-matching without a canonical ingredient catalog is the single biggest known MVP limitation (documented, not hidden).
13. **Rollback strategy:** additive migration; readiness/dashboard are pure read-side features with no destructive mutations, so rollback is just redeploying the prior checkpoint's build.
14. **Estimated complexity:** Medium.

**Not yet authorized.**

## Checkpoint E — Validation, Tests, Responsive Review, Security Verification, Final Deploy, Submission Audit

1. **Objective:** Close out cross-cutting quality gates and ship the graded submission.
2. **Dependencies:** Checkpoints A–D complete.
3. **Files to create:** `vitest.config.ts`; `src/test/setup.ts`; `docs/SUBMISSION.md` (evaluator-facing: URL, test steps, known limitations).
4. **Files to modify:** `package.json` (add `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`, `jsdom`; add `"test": "vitest run"`).
5. **Routes:** none new.
6. **Database migration design:** none new, unless RLS verification surfaces a gap.
7. **RLS policies:** verification, not new policies — documented manual two-test-user runbook in `docs/SUBMISSION.md`, not a mocked Vitest test.
8. **Server/client boundaries:** final grep-based audit confirming no server-only import is reachable from a non-`.server.ts` module.
9. **Validation:** confirm every form has loading, empty, success, and error states.
10. **Tests:** full Vitest run — readiness domain rules, route-guard function, recipe/kitchen Zod schemas, ≥1 RTL component test per CRUD form. Owner-isolation covered by the manual RLS runbook, not automated.
11. **Acceptance criteria:** `npm run lint`, `npm run build`, `npm run test` all pass; responsive check at common breakpoints; production `.vercel.app` URL live end-to-end.
12. **Risks:** last-minute Vercel environment-variable misconfiguration — checked against the explicit list below.
13. **Rollback strategy:** `vercel rollback` to the last known-good deployment; migrations remain additive throughout.
14. **Estimated complexity:** Medium.

**Not yet authorized.**

---

## Vercel Deployment Details

- **Environment variables (Vercel Project Settings):** `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` (all safe/public-by-design). **`SUPABASE_SERVICE_ROLE_KEY` is deliberately NOT set on Vercel** unless a specific future admin task requires it.
- **Supabase Auth redirect configuration:** set Site URL to the production `.vercel.app` URL; add that URL (with `/auth/callback`, `/reset-password` covered by a `/**` wildcard) to the Redirect URLs allow-list. Do not enable a broad `*.vercel.app` wildcard. Skip preview-deployment auth testing for this submission.
- **Password-reset redirect:** `resetPasswordForEmail(email, { redirectTo: '<origin>/auth/callback?next=/reset-password' })`.
- **Preview vs. production:** preview builds will succeed but auth flows won't work against them — documented as intentional in `docs/SUBMISSION.md`.
- **Direct navigation to SSR routes:** Nitro's `vercel` preset produces real serverless functions, so deep links into `/app/recipes/$id` are expected to work through SSR + the `beforeLoad` guard.
- **Rollback:** `vercel rollback` or "Promote to Production" on a previous deployment — no custom rollback tooling needed.

---

## Recommended Implementation Order & Critical Path

**A → B → C → D → E**, strictly sequential — each checkpoint's acceptance criteria gate the next. The **critical path to a working `.vercel.app` submission** is A (deploy proven early) → B (auth) → C (recipes) → D (kitchen + readiness + dashboard) — E is polish/hardening on top of an already-functionally-complete app.

**Cut list if time becomes limited (cut from the bottom first):**
1. Stretch Shopping List (never start it).
2. Vitest component tests for individual forms (keep domain/schema unit tests).
3. Search/filter on Kitchen list (keep basic CRUD).
4. Reorder buttons on ingredients/steps (keep add/edit/remove).
5. Never cut: auth, RLS, Recipe CRUD, Kitchen CRUD, readiness calculation, real-data dashboard, a live `.vercel.app` deploy.

**Exact definition of done for the course submission:**
- Landing page at `/` is pixel-identical to today's, early-access form still works.
- A new user can sign up, confirm/login, and land in a protected `/app` shell; logout and forgot/reset-password work; refreshing any `/app/*` URL preserves the session.
- The user can create, view, edit, archive, and delete a recipe with ingredients (with importance) and steps, all reorderable.
- The user can create, view, edit, archive/remove, search, and filter Kitchen items.
- A recipe detail page shows a real, explainable readiness label computed from that user's actual Kitchen data.
- The dashboard shows real counts and a recent-recipes list, with correct empty states for a brand-new account.
- A second test account cannot see or modify the first account's data (RLS-verified).
- `npm run lint`, `npm run build`, `npm run test` all pass locally.
- The app is live at a working `.vercel.app` URL, reproducible by an evaluator starting from a fresh signup.
- `docs/SUBMISSION.md` documents the URL, how to exercise each feature, out-of-scope items, and the known ingredient-matching limitation.
