# Simmeri Project Instructions

## Required references

Read these before planning or implementation:

- @docs/product/RecipeVault_Master_PRD_Implementation_Baseline_v1.3.html
- @docs/product/SIMMERI_MASTER_BUILD_BRIEF.md
- @docs/sprints/COURSE_SUBMISSION_MVP_PLAN.md
- @docs/sprints/CURRENT_SPRINT.md
- @AGENTS.md
- @package.json

The actual repository is the technical source of truth.
The PRD is the product and domain source of truth.

## Existing project boundary

- Continue the existing Simmeri repository created in Lovable and later updated in Antigravity.
- Preserve the completed public landing page at `/`.
- Do not rebuild or redesign completed landing-page sections.
- Add the authenticated application inside the same repository under an application route namespace such as `/app`, adapted to the existing router.
- Preserve existing branding, copy, assets, responsive behavior, early-access behavior, and working functionality unless the current sprint explicitly authorizes a change.

## Technology guardrails

Inspect the repository before naming the exact stack.

The repository appears to contain TanStack/Vite-style application files and Supabase integration, but `package.json` and the current source are authoritative.

- Do not migrate to Next.js.
- Do not introduce Prisma.
- Do not replace the existing router, build system, package manager, Supabase integration, or authentication approach.
- Do not create a parallel replacement application.
- Use only TanStack packages actually installed and configured.
- Do not introduce a new ORM, auth provider, backend, storage provider, job runner, AI provider, or billing provider without explicit approval.
- Adapt conceptual PRD architecture to the existing repository rather than forcing the PRD's sample Next.js folder structure.

## Repository safety

- Treat `.output/`, `.tanstack/`, `.wrangler/`, `node_modules/`, and generated route-tree files as generated artifacts unless repository documentation states otherwise.
- Do not manually edit generated files when a source file or generator is responsible for them.
- Do not edit `.lovable/plan.md` as application implementation code.
- Do not modify unrelated files.
- Do not delete existing migrations or working assets.
- Use additive, reversible Supabase migrations.
- Never expose service-role keys or secrets to client code.

## Product rules

- Imported recipes require user review before approval.
- Kitchen inventory uses status, not precise quantity, for the MVP.
- Cooking readiness is derived and explainable.
- Shopping items merge only by canonical ingredient identity.
- Planning never reserves or consumes inventory.
- Cooking never silently deducts inventory.
- Swipe must have visible button and keyboard alternatives.
- Personal cooking photos are private by default.
- Billing and paid checkout require a separately approved sprint.
- Do not silently delete user-owned data after downgrade.

## Development workflow

- Implement only the scope in `docs/sprints/CURRENT_SPRINT.md`.
- Begin with repository inspection and a plan.
- Stop when a required architecture decision is unresolved.
- Before editing, report the proposed files, routes, database objects, policies, and risks.
- Do not commit or push unless explicitly instructed.
- Do not use force push.
- Run the repository's configured validation commands after implementation.
- Report files changed, migrations, policies, tests, limitations, risks, and deferred work.
