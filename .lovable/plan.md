
# Simmeri Course Submission MVP — Implementation Plan

## Scope

Add a functional authenticated web app to the existing Simmeri repo without touching the landing page, navbar, footer, mascot assets, or early-access flow. Stack stays: Vite + TanStack Start/Router + Supabase + Tailwind + shadcn/ui + npm + Nitro `vercel` preset.

## 1. Database (single additive Supabase migration)

Tables (all with `id uuid pk`, `user_id uuid references auth.users on delete cascade`, `created_at`, `updated_at`, plus GRANTs to `authenticated` + `service_role`, RLS enabled, owner-only policies `auth.uid() = user_id` for SELECT/INSERT/UPDATE/DELETE):

- `profiles` — `id = auth.users.id`, `display_name`, `onboarding_completed bool default false`.
- `user_preferences` — `language text default 'en'`, `measurement_system text check in ('metric','us') default 'metric'`, `timezone text default 'UTC'`.
- `recipes` — `title`, `description`, `servings int`, `prep_time_minutes int`, `cook_time_minutes int`, `notes`, `archived_at timestamptz`.
- `recipe_ingredients` — `recipe_id fk → recipes on delete cascade`, `raw_text`, `display_name`, `quantity_text`, `unit`, `preparation_note`, `importance text check in ('core','supporting','seasoning','optional')`, `position int`. Denormalized `user_id` for RLS via `auth.uid() = user_id`.
- `recipe_steps` — `recipe_id fk`, `instruction text`, `position int`, denormalized `user_id`.
- `kitchen_items` — `ingredient_name`, `normalized_name text` (generated: `lower(trim(ingredient_name))`), `status text check in ('available','running_low','out_of_stock','unknown')`, `storage_location text check in ('pantry','refrigerator','freezer','spice_rack','other')`, `archived_at timestamptz`.

Trigger `handle_new_user()` on `auth.users` insert → creates `profiles` + `user_preferences` rows. `update_updated_at_column()` trigger on each table.

Indexes: `recipes(user_id, archived_at)`, `recipe_ingredients(recipe_id, position)`, `recipe_steps(recipe_id, position)`, `kitchen_items(user_id, normalized_name)`.

## 2. Routes (TanStack file routing under `src/routes/`)

Preserved: `index.tsx` (landing).

New public:
- `login.tsx`, `signup.tsx`, `forgot-password.tsx`, `reset-password.tsx`, `auth.callback.tsx`.

New protected under `_authenticated/`:
- `_authenticated/route.tsx` — `ssr: false` gate, redirects to `/login` if no session (integration-managed pattern).
- `_authenticated/app.index.tsx` → `/app` (dashboard).
- `_authenticated/app.recipes.index.tsx` → `/app/recipes`.
- `_authenticated/app.recipes.new.tsx` → `/app/recipes/new`.
- `_authenticated/app.recipes.$recipeId.index.tsx` → `/app/recipes/:recipeId`.
- `_authenticated/app.recipes.$recipeId.edit.tsx` → `/app/recipes/:recipeId/edit`.
- `_authenticated/app.kitchen.tsx` → `/app/kitchen`.
- `_authenticated/app.settings.tsx` → `/app/settings`.

Landing "Log in" CTA points to `/login`. Register `attachSupabaseAuth` in `src/start.ts` (append; don't replace existing middleware).

## 3. Data access

All reads/writes use the browser `supabase` client with RLS — no server functions needed for MVP. TanStack Query for cache; each mutation invalidates the relevant keys. `useAuth` hook wraps `supabase.auth` with `onAuthStateChange` in `__root.tsx` invalidating router + queries on identity transitions.

## 4. Readiness engine (`src/lib/readiness.ts`)

Pure function `computeReadiness(ingredients, kitchenItems) → { label, explanation }`. Normalize names with `lower(trim())`. Rules per spec:

```text
missing core          → not_ready
else missing support  → needs_shopping
else any unknown      → check_first
else any running_low  → almost_ready
else                  → ready_to_cook
optional              → ignored as blocker
```

Explanation groups: available / running low / needs check / missing core / missing supporting / ignored optional. Consumed by Recipe Detail, My Recipes cards, Dashboard aggregates.

## 5. App shell

`AppShell` component: desktop sidebar (Home, My Recipes, Add Recipe, Kitchen, Settings) + top bar with profile menu (display name, logout). Mobile: top bar + bottom nav. Uses existing brand tokens and shadcn primitives. No marketing illustrations.

## 6. Screens

- **Dashboard** — real counts (active recipes, kitchen items, ready-to-cook, almost-ready), recent recipes list, quick actions. Real empty state.
- **My Recipes** — grid/list of cards (title, times, servings, readiness chip + short reason, edit/archive). Search input (client filter), archived toggle. Empty/loading/error states.
- **Add / Edit Recipe** — RHF + Zod. Ingredient rows (raw_text, display_name, quantity_text, unit, prep note, importance select, drag/keyboard reorder via up/down buttons). Step rows (instruction, reorder). Save writes recipe + replaces ingredient/step rows atomically per submit.
- **Recipe Detail** — full render, ingredients grouped by importance, steps ordered, readiness result + explanation, edit/archive/delete (delete uses AlertDialog).
- **Kitchen** — table/list of items with inline status/location edit, add-item dialog, search, filter by status/location, archive/remove.
- **Settings** — display name, language, measurement system, timezone; sign out; delete-account note (out of scope button disabled with tooltip).

All screens: loading skeletons, empty states, toast feedback via existing Sonner, validation errors inline, retry buttons on server errors, focus rings, labels, keyboard reorder, ≥44px touch targets.

## 7. Auth flow

Supabase email/password. `signUp` with `emailRedirectTo = ${origin}/auth/callback`. `/reset-password` public route calls `updateUser({ password })` after Supabase recovery link. `_authenticated/route.tsx` calls `supabase.auth.getUser()` in `beforeLoad` (client-only) and redirects to `/login?redirect=…` when unauthenticated. Sign-out: cancel queries → clear cache → `signOut()` → `navigate('/login', { replace: true })`.

## 8. Preserved

Landing `/` and all `src/components/landing/*`, navbar, footer, early-access form, mascot/food assets, `vercel.json`, Nitro `vercel` preset, Node engines, existing `.env.example`.

## 9. Out of scope (not built)

URL/AI import, OCR, media upload, Cooking History, Tonight's Deck, Meal Planning, Shopping List, community, freemium/billing, admin.

## 10. Validation before reporting

`npm run build` (Nitro vercel output), `tsgo` typecheck, spot-check routes via preview, verify RLS by logging in as user A then querying user B's row (should return empty), confirm landing untouched.

## 11. Deliverables at end

Files changed, routes added, migration SQL summary, tables + RLS policies list, real features verified, remaining manual config (Supabase Auth redirect URLs for prod + preview in dashboard — but on Lovable Cloud this is managed; note it), build/typecheck output, known limitations, redeploy steps (push to GitHub → Vercel auto-build; env vars already present via Lovable Cloud injection).

## Technical notes

- Denormalized `user_id` on `recipe_ingredients` / `recipe_steps` lets RLS use `auth.uid() = user_id` directly instead of joining to `recipes` — faster policies and simpler grants.
- All CRUD goes through the browser Supabase client under RLS; no service-role key usage.
- `_authenticated` layout uses `ssr: false` because Supabase session lives in localStorage.
- Migration is a single call; all `CREATE TABLE` followed by GRANT → RLS → policies as required.
