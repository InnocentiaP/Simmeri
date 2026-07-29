# Simmeri

Simmeri is a cozy, AI-assisted personal cooking workspace: capture recipes, track a lightweight kitchen inventory, see an explainable cooking-readiness status, and manage your own recipe collection — all backed by Supabase.

## Current MVP features

- Email/password authentication (signup, login, logout, forgot/reset password)
- Protected `/app` application shell alongside the public marketing site at `/`
- Manual recipe creation with ingredients (with importance) and steps
- My Recipes: create, view, edit, archive, and delete recipes
- Kitchen inventory: track ingredient status (available, running low, out of stock, unknown) and storage location
- Deterministic, explainable Cooking Readiness for each recipe, derived from your current Kitchen state
- Real-data dashboard reflecting your own recipes and kitchen items
- Account settings and preferences

## Technology stack

- [TanStack Start](https://tanstack.com/start) + [TanStack Router](https://tanstack.com/router) + [Vite](https://vitejs.dev/)
- [Nitro](https://nitro.build/) (Vercel preset) for the server/build output
- [Supabase](https://supabase.com/) for authentication and PostgreSQL (with row-level security)
- React 19, TypeScript, Tailwind CSS, shadcn/ui

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

## Scripts

```sh
npm run dev      # start the local dev server
npm run build    # production build (Nitro/Vercel output)
npm run lint      # lint the codebase
```

## Production

Live at: https://simmeri.vercel.app

## Further documentation

For the full development workflow, architecture decisions, and current sprint status, see [`SETUP_GUIDE.md`](./SETUP_GUIDE.md), [`CLAUDE.md`](./CLAUDE.md), and `docs/sprints/CURRENT_SPRINT.md`.
