# Simmeri Master Build Brief

## 1. Purpose

Continue the existing Simmeri landing-page repository and develop it into a cohesive product with:

1. A public marketing website.
2. An authenticated personal cooking web application.

The complete product loop is:

**Capture → Review → Organize → Decide → Plan → Shop → Cook → Remember**

The Master PRD contains the detailed product requirements and business rules. This brief translates those requirements into repository-level boundaries and a controlled delivery strategy.

## 2. Current repository observations

Based on the current project walkthrough, the repository already contains:

- a completed landing page
- `AGENTS.md`
- `package.json`
- Vite/TanStack-related project files
- `src/router.tsx`
- `src/routeTree.gen.ts`
- `src/server.ts`
- `src/start.ts`
- `src/routes/_root.tsx`
- `src/routes/index.tsx`
- `src/components/landing/`
- `src/components/ui/`
- `src/integrations/supabase/`
- Supabase client/server/auth integration files
- `supabase/migrations/`
- public Simmeri assets and food images

The repository also contains generated/build directories such as `.output`, `.tanstack`, `.wrangler`, and `node_modules`.

These observations are not a substitute for a code audit. `package.json`, source files, and existing migrations remain authoritative.

## 3. Product boundary

### Public area

- Existing landing page at `/`
- Login
- Sign up
- Forgot password
- Reset password
- Privacy and terms placeholders when approved

### Authenticated application

Target route namespace: `/app`, adapted to the existing TanStack routing conventions.

Future destinations:

- Home
- Recipe Inbox
- My Recipes
- Recipe Detail
- Add Recipe
- Kitchen
- Shopping
- Tonight's Deck
- Meal Plan
- Collections
- Cooking History
- Settings
- Account and Plan

Do not replace the public landing page with the application dashboard.

## 4. Architecture boundary

- Preserve the current Vite/TanStack/Supabase architecture confirmed by the repository audit.
- Do not migrate to Next.js or Prisma.
- Supabase should remain the baseline for authentication, PostgreSQL persistence, row-level security, and supported storage/server capabilities.
- Business rules must not be scattered across presentation components.
- Separate UI, routing, validation, domain logic, data access, authentication, authorization, media handling, and future entitlement logic.
- Client-side user IDs are not authoritative for ownership.
- Personal resources require authenticated ownership controls and RLS.

## 5. Visual boundary

The existing Simmeri identity is approved:

- warm cream, beige, caramel, cocoa, terracotta, olive, and sage
- editorial serif headings with readable sans-serif UI text
- soft rounded cards, restrained shadows, warm surfaces
- Simi used selectively as a helper
- responsive desktop, tablet, and mobile behavior

Claude Code is the primary implementation tool. Antigravity is the later visual-review and polish tool. Visual polish must not be performed concurrently on the same branch while Claude is implementing the same feature.

## 6. Controlled delivery roadmap

### Phase 0 — Repository audit

- detect exact framework, packages, router, runtime, and scripts
- inspect current landing page
- inspect Supabase authentication, clients, migrations, tables, RLS, and storage
- identify current environment requirements
- identify conflicts between PRD and repository
- propose Phase 1 architecture
- no code changes

### Phase 1 — Application foundation

- public/protected route boundary
- authentication flow
- session handling
- user profile and essential preferences
- responsive authenticated application shell
- onboarding, loading, empty, error, and expired-session states
- landing-page login integration
- minimum required migrations and RLS
- no recipe, kitchen, shopping, planning, AI, or billing functionality yet

### Phase 2 — Recipe foundation

- manual recipe creation
- Recipe Inbox baseline
- My Recipes
- Recipe Detail
- recipe media baseline

### Phase 3 — Kitchen and shopping

- canonical ingredients
- Kitchen inventory and activity
- cooking readiness
- Shopping List

### Phase 4 — Cooking lifecycle

- Cook This
- Cooking History
- cooking-result photos
- confirmed post-cooking Kitchen updates
- collections and dashboard suggestions

### Phase 5 — Decision and planning

- Tonight's Deck
- shortlist
- daily and weekly planning
- shopping preview

### Phase 6 — Account hardening and freemium baseline

- settings
- privacy, export, and account deletion
- entitlement architecture and UI without live billing
- minimal internal operations
- accessibility, security, performance, and responsive hardening

### Separate approval only

- production AI recipe extraction
- protected external URL fetching infrastructure
- background jobs
- payment checkout
- billing portal and webhooks
- public sharing/community features

## 7. Definition of done per phase

Every implementation phase must report:

- files changed
- routes changed
- migrations and RLS policies
- environment variables
- real vs mocked functionality
- build/typecheck/lint/test results
- security and ownership verification
- known limitations
- risks
- next recommended phase

Do not continue automatically to the next phase.
