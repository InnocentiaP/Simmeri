# Current Sprint — Course Submission MVP

## Active roadmap

The active roadmap is the **Course Submission MVP**, defined in full in `docs/sprints/COURSE_SUBMISSION_MVP_PLAN.md`. That document is the authoritative implementation plan (architecture decisions, database/RLS design, auth strategy, and Checkpoints A–E). This file tracks live status only — read the plan document for design detail.

The former generic Phase 0 → Phase 1 sequencing (`docs/sprints/PHASE_01_APP_FOUNDATION.md`) remains valid as the long-term product roadmap but is superseded for immediate work by the Course Submission MVP plan. See that file's status notice for detail.

## Status

**Phase 0 repository audit:** complete (see conversation history / prior audit deliverable — TanStack Start + Vite + Nitro + Supabase confirmed, no Next.js/Prisma).

**Checkpoint A (documentation, environment hygiene, Vercel/Nitro build spike, baseline deploy):**
- Implementation: **complete, locally validated.**
  - `vite.config.ts` pins the Nitro build target to the `vercel` preset.
  - `vercel.json` added (`buildCommand`, `framework: null`).
  - `package.json` declares `engines.node >=22.12.0`.
  - `.gitignore` updated (`.env`, `.env.*`, `!.env.example`, `.vercel/`).
  - `.env.example` added; `.env` untracked from git (`git rm --cached`) while preserved on disk.
  - `npm run build` succeeds locally and confirms the Nitro `vercel` preset produces a correct Build Output API v3 directory (`.vercel/output/static` + a real `__server.func` serverless function).
- **Production deployment: still pending.** Nothing has been committed or pushed. The repository is not yet connected to a Vercel project, so no `.vercel.app` URL exists yet.

**Checkpoint B (authentication, `@supabase/ssr` session architecture, profiles/preferences, protected `/app` shell) and all later checkpoints (C, D, E): not yet authorized.** No implementation of Checkpoint B may begin until Checkpoint A's production deployment is confirmed working.

## Immediate next action

1. Commit the Checkpoint A changes.
2. Push the branch.
3. Merge/sync with the fork as needed.
4. Connect the repository to a Vercel project and deploy the baseline (landing page only, no new features).
5. Smoke-test the resulting `.vercel.app` URL: landing page renders correctly, early-access form still writes to Supabase, no build/runtime errors.

Once that baseline deployment is confirmed working, Checkpoint B may be separately authorized and this file updated accordingly.

## Required reading

- `CLAUDE.md`
- `AGENTS.md`
- `docs/product/RecipeVault_Master_PRD_Implementation_Baseline_v1.3.html`
- `docs/product/SIMMERI_MASTER_BUILD_BRIEF.md`
- `docs/sprints/COURSE_SUBMISSION_MVP_PLAN.md`
- `package.json`, lockfiles, and build configuration
- router and route files
- Supabase integration files and existing migrations

## Prohibited actions (until explicitly re-authorized per checkpoint)

- do not implement Checkpoint B, C, D, or E
- do not install new dependencies (e.g. `@supabase/ssr`) ahead of Checkpoint B's authorization
- do not create new migrations ahead of Checkpoint B's authorization
- do not commit or push without explicit instruction
- do not modify the landing page
- do not use force push
