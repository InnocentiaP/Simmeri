# Simmeri

Simmeri is a cozy, AI-assisted personal cooking workspace: capture recipes, track a lightweight kitchen inventory, see an explainable cooking-readiness status, plan meals, generate shopping lists, and manage your own recipe collection — all backed by Supabase. See [`docs/SUBMISSION.md`](./docs/SUBMISSION.md) for the full submission write-up, demo flow, and security notes.

## Current features

- Email/password authentication (signup, login, logout, forgot/reset password)
- Protected `/app` application shell alongside the public marketing site at `/`
- Manual recipe creation with ingredients (with importance) and steps
- My Recipes: create, view, edit, archive, and delete recipes
- Deterministic recipe import from pasted text or a public recipe URL (SSRF-hardened fetch), plus an explicit **"Improve with AI"** step (Google Gemini, server-side only) that produces a reviewable, editable draft — nothing is saved automatically; see `docs/SUBMISSION.md` §5
- Kitchen inventory: track ingredient status (available, running low, out of stock, unknown) and storage location
- Deterministic, explainable Cooking Readiness for each recipe, derived from your current Kitchen state
- Collections, Cooking History (with optional photos), Meal Planning (day/week), and Shopping Lists with deterministic generation from recipes/meal plans
- Real-data dashboard reflecting your own recipes, kitchen items, and upcoming meals
- Account settings and preferences

## Technology stack

- [TanStack Start](https://tanstack.com/start) + [TanStack Router](https://tanstack.com/router) + [Vite](https://vitejs.dev/)
- [Nitro](https://nitro.build/) (Vercel preset) for the server/build output
- [Supabase](https://supabase.com/) for authentication and PostgreSQL (with row-level security)
- React 19, TypeScript, Tailwind CSS, shadcn/ui
- [Google Gemini](https://ai.google.dev/) (server-side REST call, no SDK) for the optional "Improve with AI" recipe-import assistant

## Local setup

```sh
git clone <this-repository-url>
cd pixel-perfect-clone
npm install
```

Create a `.env` file (see `.env.example`) with the following variables:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_PROJECT_ID`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_PROJECT_ID`
- `SUPABASE_SERVICE_ROLE_KEY` (server-only; not required for normal development)
- `GEMINI_API_KEY` (server-only; only required to use "Improve with AI" on `/app/recipes/import` — every other feature works without it)

No secret values are committed anywhere in this repository; `.env.example` lists variable names only.

## Scripts

```sh
npm run dev      # start the local dev server
npm run build    # production build (Nitro/Vercel output)
npm run lint      # lint the codebase
npm test         # run the pure-logic test suite (node:test)
```

## Production

Live at: https://simmeri.vercel.app

## Further documentation

For the full development workflow, architecture decisions, and current sprint status, see [`SETUP_GUIDE.md`](./SETUP_GUIDE.md), [`CLAUDE.md`](./CLAUDE.md), and `docs/sprints/CURRENT_SPRINT.md`.
