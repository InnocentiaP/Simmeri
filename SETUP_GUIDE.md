# Setup Guide — VS Code + Claude Code

## 1. Start from the current Git repository

Use the same repository folder that contains the Lovable landing page and Antigravity updates.

Before starting:

```powershell
git status
git branch --show-current
git remote -v
```

Prefer a clean working tree. Sync the fork and local `main` first, then create a dedicated branch:

```powershell
git switch main
git pull origin main
git switch -c chore/phase-0-repository-audit
```

The audit should not create code changes, but the branch keeps the workflow explicit.

## 2. Copy this pack into the repository root

After extraction, the repository should include:

```text
CLAUDE.md
docs/
  product/
    RecipeVault_Master_PRD_Implementation_Baseline_v1.3.html
    SIMMERI_MASTER_BUILD_BRIEF.md
  sprints/
    CURRENT_SPRINT.md
    PHASE_01_APP_FOUNDATION.md
```

Keep the existing `AGENTS.md`. Do not overwrite it.

You do not need to create the sample Next.js/Prisma folders shown in the PRD.

## 3. Open the existing folder in VS Code

```powershell
code .
```

Claude Code works from the repository itself, so the codebase does not need to be manually attached file by file.

## 4. Begin in Plan Mode

From the project terminal:

```powershell
claude --permission-mode plan
```

Or use the Claude Code VS Code interface and select Plan mode.

## 5. First prompt to Claude Code (historical — already completed)

> **Status: this step is done.** The Phase 0 repository and architecture audit described below has already been performed and accepted. It's kept here for reference on how the project was bootstrapped. For current work, skip to step 7.

```text
Read CLAUDE.md and every file it references, including AGENTS.md, the Master PRD, the Master Build Brief, CURRENT_SPRINT.md, package.json, router configuration, Supabase integration, existing migrations, and the landing-page route.

Perform the authorized Phase 0 repository and architecture audit only.

Do not edit files.
Do not install dependencies.
Do not create migrations.
Do not commit or push.

Inspect the actual repository rather than assuming Next.js, Prisma, or a generic Lovable stack.

Return the exact structured deliverable required by CURRENT_SPRINT.md, then stop and wait for approval.
```

## 6. Audit review (historical — already completed)

The audit covered exact TanStack architecture, authoritative lockfile/package manager, existing Supabase project/auth state, current migration and RLS state, and whether `.env` was tracked. It was reviewed and accepted, and the project priority subsequently changed to the Course Submission MVP (see step 7) — so the audit's original "proposed Phase 1 schema" was superseded before Phase 1 implementation began.

## 7. Current workflow — Course Submission MVP

The active workflow is **not** the former generic Phase 0 → Phase 1 sequencing. The repository audit is complete, and the current authorized roadmap is the Course Submission MVP, checkpoint by checkpoint:

- Plan: `docs/sprints/COURSE_SUBMISSION_MVP_PLAN.md` (architecture decisions, database/RLS design, auth strategy, Checkpoints A–E, definition of done).
- Live status: `docs/sprints/CURRENT_SPRINT.md` (what's implemented, what's deployed, what's authorized next).

Each checkpoint (A: environment/Vercel baseline, B: auth, C: Recipe CRUD, D: Kitchen/readiness/dashboard, E: tests/hardening/final deploy) requires its own explicit authorization before implementation begins — check `CURRENT_SPRINT.md` for the current checkpoint before instructing Claude to implement further work. A representative prompt for authorizing the next checkpoint:

```text
Checkpoint A's production deployment is confirmed working at <the .vercel.app URL>.

Implement Checkpoint B only, according to:
- CLAUDE.md
- AGENTS.md
- docs/sprints/COURSE_SUBMISSION_MVP_PLAN.md
- docs/sprints/CURRENT_SPRINT.md

Do not implement Checkpoint C, D, or E yet.
Do not commit or push.

Before editing, summarize the exact files, routes, migrations, and RLS policies you will change.
Then implement, validate, report, and stop after Checkpoint B.
```

The long-term product roadmap (`docs/sprints/PHASE_01_APP_FOUNDATION.md` and beyond) resumes only after the course submission ships — see that file's status notice.

## 8. Git workflow after review

After you have reviewed the diff and local validation:

```powershell
git status
git diff
git add .
git commit -m "Add Simmeri authenticated app foundation"
git push -u origin <your-branch-name>
```

Create a Pull Request from the fork branch to the main repository. Do not let Claude and Antigravity edit the same branch at the same time.

## 9. Antigravity handoff

After a functional phase is merged:

1. Sync the fork.
2. Create a separate visual-polish branch.
3. Use Antigravity for responsive checks, browser walkthroughs, visual refinements, and isolated UI issues.
4. Merge visual changes through a separate Pull Request.
