# Phase 1 — Authenticated Application Foundation

> **Superseded for immediate work.** This brief is part of the long-term Simmeri/RecipeVault product roadmap and remains valid beyond the current submission deadline. For the active graded Course Submission MVP, the authoritative implementation plan is `docs/sprints/COURSE_SUBMISSION_MVP_PLAN.md`, with live status tracked in `docs/sprints/CURRENT_SPRINT.md`. Do not use this file to authorize or scope current implementation work — it is retained for reference and for resuming the long-term roadmap after the course submission ships.

## Status

**Not yet authorized.**

Use this brief only after the Phase 0 audit has been reviewed and explicitly approved.

## Objective

Add the minimum secure authenticated Simmeri application foundation inside the existing repository while preserving the completed public landing page.

## In scope

- public and protected route separation
- login
- sign up
- logout
- forgot password
- reset password
- authenticated session loading and expiry handling
- current-user profile baseline
- essential user preferences needed now
- authenticated `/app` shell, adapted to existing router conventions
- desktop navigation shell
- mobile navigation shell
- onboarding state
- loading, empty, error, permission, and retry states
- landing-page login connection
- safe post-login and post-logout redirects
- minimum additive Supabase migration required for profile/preferences
- RLS policies for all Phase 1 personal data
- tests and validation appropriate to the repository

## Out of scope

- Recipe CRUD
- Recipe Inbox
- recipe import or AI extraction
- media upload
- Ingredient Catalog
- Kitchen
- cooking readiness
- Shopping
- Tonight's Deck
- Meal Plan
- Cooking History
- Collections beyond a disabled future navigation item
- subscriptions, billing, and payment
- admin dashboard
- new framework, ORM, auth provider, storage provider, or backend

## Landing-page constraints

- keep `/` as the existing landing page
- preserve existing sections, copy, design, assets, animations, and early-access behavior
- do not redesign the navbar
- connect the existing Login action to the approved auth route
- do not turn Join Early Access into direct registration without approval

## Data constraints

Create only the minimum approved structures, likely:

- profile linked one-to-one with Supabase Auth user ID
- essential user preferences
- onboarding completion state

The exact schema must follow the approved Phase 0 audit.

- do not duplicate password or auth credential data
- use authenticated ownership and RLS
- use additive, reversible migrations
- do not create all future product tables yet

## Application shell constraints

Future feature destinations may be visible only when clearly marked as unavailable or upcoming. Do not present static placeholders as completed functionality.

The initial app home may show an onboarding-oriented foundation, not fake readiness, recipe, Kitchen, or planning data.

## Acceptance criteria

- unauthenticated users cannot access protected application routes
- authenticated users can enter the app shell
- browser refresh on a protected route preserves or safely restores session state
- login, logout, sign-up, and reset flows behave according to configured Supabase capabilities
- no redirect loops
- profile/preference data is isolated by RLS
- one user cannot read or modify another user's Phase 1 records
- public landing page remains visually and functionally intact
- desktop and mobile application shell is accessible
- no client-side secret exposure
- configured build, typecheck, lint, and tests pass

## Required report

- implementation summary
- files changed
- routes
- migrations
- RLS policies
- environment variables
- tests and validation
- real vs deferred functionality
- risks and limitations
- recommendation for Phase 2

Stop after Phase 1.
