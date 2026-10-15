# Current Sprint — Gap-Closing Roadmap

## Roadmap (October 2026)

The Course Submission MVP (`docs/sprints/COURSE_SUBMISSION_MVP_PLAN.md`) is complete and shipped, along with Waves 1–2 (import, media, collections, cooking history, meal planning, shopping) and Wave 3 Checkpoint 3.1 (canonical ingredient catalog, inert). That plan is now historical.

The active roadmap closes the gap between what the landing page promises and what the app does:

| Phase | Scope | Status |
|---|---|---|
| 0 | Revive infrastructure: resume Supabase project, verify schema, Gemini model update | Done |
| 1 | Cooking loop: cooking rating ("loved it"), recipe favorites, confirmed post-cooking Kitchen update, "last time you cooked this" on recipe detail | **In review** (branch `feat/phase-1-cooking-loop`) |
| 2 | Smart ingredient matching: Wave 3 Checkpoints 3.2 + 3.3 (`docs/plans/WAVE_3_CANONICAL_INGREDIENTS_AND_RECOMMENDATIONS_PLAN.md`), shared readiness hook | Not started |
| 3 | Suggestions + Tonight's Deck: Wave 3 Checkpoints 3.4 + 3.5, dashboard suggestions, `/app/tonight` with swipe (via the installed `motion` library) layered on top of button + keyboard controls | **In review** — done before Phase 2 by owner request; recommendations use today's exact-name matching and improve automatically once Phase 2 lands |
| 4 | Trust: data export, onboarding (kitchen staples), timezone actually applied | Not started |
| 5 | Landing copy alignment (copy only, no redesign) for promises deferred below; also update `TonightsDeck.tsx` copy ("Three ideas", "short deck instead of an endless feed") to match the endless deck | Not started |

Deferred (not in this roadmap): screenshot import, offline/PWA, household sharing, drag-and-drop planner, Free/Premium entitlements and billing.

## Phase 0 outcome (complete, October 2026)

The original Supabase project had been paused for inactivity. It was resumed from the dashboard and came back with its full schema intact (all 13 migrations present), so no new project, re-migration, or `.env` change was needed.

- [x] Supabase project resumed; tables, RLS, and storage verified.
- [x] Gemini model updated from deprecated `gemini-3.5-flash` to `gemini-3.8-flash` (`src/lib/import/gemini-client.server.ts`); stray `;;` removed.
- [x] Local smoke test passed: login/signup, recipe + cover upload, kitchen + readiness, URL import + AI.

Notes:
- The free-tier project pauses again after 7 days without activity; resume it from the dashboard (possible within 90 days). Choosing a long-term database/hosting for commercial launch is deferred until the app is close to launch.
- Development stays on the hosted project; local Supabase (`npx supabase start`, requires Docker Desktop) remains an option.

## Phase 1 — cooking loop

- Migration `20261015010000_cooking_rating_and_favorites.sql`: `cooking_history.rating` (`loved`/`good`/`meh`, nullable) and `recipes.favorited_at` (nullable) + partial index. Additive; existing RLS covers both columns.
- Rating picker in `CookingHistoryForm`, rating badge in `CookingHistoryList`.
- `PostCookKitchenDialog` (+ pure `src/lib/post-cook-kitchen.ts`, tested): after Mark as cooked (Recipe Detail and Planner), offers Still have it / Running low / Used up for matching Kitchen items. Defaults to no change; ambiguous matches require an explicit pick.
- `LastCookedSummary` on Recipe Detail (date, rating, note, photos of the latest cook).
- Favorite toggle on Recipe Detail; Favorites filter and heart on My Recipes.

## Phase 3 — Tonight's Deck

- `src/lib/recommendations/score.ts` (tested): deterministic scoring — readiness (ready 100 / almost 60 / check first 40 / needs shopping 10, opt-in), favorite +25, last rating (loved +15 / good +5 / meh −15), never cooked +15, recently cooked −40/−25/−10, planned this week +10, ≤ 30 min +10, mood match +30; ties break on recipe id. Recipes missing a core ingredient are never recommended. Each pick carries plain-language reasons.
- Moods: Surprise me, Quick (≤ 30 min), Use what's running low, Something new, An old favorite.
- `src/lib/recommendations/deck-state.ts` (tested): session-only Not tonight / Shortlist / Undo, kept in sessionStorage for the current day only; never written to the database.
- `/app/tonight`: endless within the user's own collection (owner request, replacing the PRD's 5–8 card cap) — cookable-now recipes first, then ones needing a shop, then ones missing a core ingredient, each clearly labeled. Swipe left/right via `motion`, buttons for every action, keyboard ← / → / Z, reduced-motion support, shortlist comparison, and "Go through skipped ones again" once every recipe has been seen. "Cook this tonight" adds a dinner entry for today (no cooking-history record) and opens the recipe; "Plan a day" opens the meal-plan form and removes the recipe from the deck so swiping can continue for the next day. Already-planned recipes rank lower.
- Dashboard "Tonight's picks" (top 3 with reasons); "Tonight" added to the app nav (second item, so Shopping moves to the drawer on mobile).

## Working rules

- One branch per phase; update this file at the start of each phase.
- Migrations stay additive and are applied with `npx supabase db push`; regenerate types afterwards.
- Landing page changes are authorized only in Phase 5, and only copy changes.
- Do not commit or push without explicit instruction. No force push.
- Validation per phase: `npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run build`, plus manual QA with two test accounts for RLS isolation.
