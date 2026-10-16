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
| 6a | Import from anywhere — blogs: one-step URL import (JSON-LD → microdata → automatic AI fallback on the page's recipe section), cleaner text, recipe photo as cover, clearer errors for sites that block apps | **In review** (branch `feat/import-anywhere-6a`) |
| 6b | Screenshot/photo import (Gemini vision): up to 5 images via picker, drag-and-drop, or clipboard paste | **In review** (branch `feat/import-anywhere-6b`) |
| 6c | Video import: YouTube links and uploaded clips (Gemini video); social links get guidance | **In review** (branch `feat/import-anywhere-6c`) |
| 6d | Social-media captions via official oEmbed where available; mobile share target (PWA) | Not started |

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

## Phase 6a — blog import

- `src/lib/import/recipe-page-extract.ts` (tested, incl. real-page checks): schema.org JSON-LD (with @graph, HowToSection, HTML/entity cleanup), microdata fallback, widest recipe photo / og:image, and focused AI input that starts at the recipe card or the most quantity-dense ingredient section instead of the top of the page.
- `extractRecipeFromUrl` now falls back to AI automatically when structured data is missing or incomplete (shared `ai-extract.server.ts`, same per-user rate limit); the review screen labels how the draft was read.
- Recipe photo offered as the cover; downloaded via the SSRF-safe fetcher (`fetchRemoteImage`, ≤ 5 MB, JPEG/PNG/WebP) and uploaded through the normal resize/EXIF-strip cover pipeline.
- Fetcher: page cap raised from 2 MB to 5 MB, honest "compatible" User-Agent, friendly message when a site blocks apps (401/402/403/429/451).
- Known limit: sites with bot protection (e.g. Allrecipes) can't be read; users paste text instead.

## Phase 6b — screenshot / photo import

- New "Photo / screenshot" tab on Import: up to 5 images (Instagram/TikTok caption screenshots, cookbook pages, handwritten cards) via file picker, drag-and-drop, or Ctrl/Cmd+V.
- Browser resizes each image to 1600px JPEG (also strips EXIF) before upload; server re-validates count, base64, per-image (1.5 MB) and total (3 MB) size, and real file type from magic bytes (`src/lib/import/image-payload.ts`, tested).
- `extractRecipeFromImages` sends the images to Gemini with the existing extraction rules plus an image-specific prompt (read only visible text, ignore app UI, never guess unreadable values); same per-user AI rate limit. Images are never stored.
- Review screen labels the draft "Read by Meri from your images"; "Try AI again" re-reads the same images.
- Verified against the live API: an image costs roughly 1,100 input tokens.

## Phase 6c — video import

- New "Video" import tab: paste a public YouTube link or upload a clip (MP4/MOV/WebM/3GP/MPEG, ≤ 200 MB, ≤ 15 min). YouTube links pasted in the URL tab are routed here automatically; Instagram/TikTok/Facebook/X links get guidance instead of a failed fetch.
- Uploads go straight from the browser to the Gemini Files API through a resumable session the server opens (bound to the app origin, so CORS works and the API key never reaches the browser; bytes never pass through our functions). Each file is tagged with its owner, only its owner can have it read, and it is deleted right after reading (Gemini also auto-deletes after 48 h).
- Rate limit is counted when an upload starts, not again on read. YouTube imports keep the watch URL as the recipe source and offer the video thumbnail as cover.
- Prompt: build steps from speech, on-screen text, and visible actions; never estimate unspoken amounts. Tested on a real 5-minute recipe video: complete ingredients and ordered steps, unstated amounts left blank, ~28 s and ~31k tokens at low media resolution.
- Video tab: a pasted TikTok/Instagram/Facebook/X link shows inline guidance and a "How do I save this video?" panel (app's own Save option or the phone's screen recorder only — no third-party downloaders); the link is kept as the recipe source when the saved clip is uploaded.
- `vercel.functions.maxDuration: 60` (vite.config.ts); Gemini video timeout 50 s; a call that waits for upload processing (≤ 20 s) never also runs the AI read.
- Pure rules in `src/lib/import/video-source.ts` (tested): YouTube URL parsing, social-platform detection, upload limits, ownership tag.
- Gemini API key now sent in the `x-goog-api-key` header instead of the URL.

## Deck daily shuffle (follow-up to Phase 3)

- `recommend()` takes an optional `seed`: a repeatable per-recipe nudge of up to 35 points, applied within readiness tiers only (cookable now → needs a shop → missing a core ingredient). The spread is kept below the "cooked in the last 3 days" penalty so recently cooked recipes still sink.
- Tonight's Deck seeds by date (order changes every day) plus a Shuffle button for a new order on demand; dashboard picks use the same daily seed.

## Working rules

- One branch per phase; update this file at the start of each phase.
- Migrations stay additive and are applied with `npx supabase db push`; regenerate types afterwards.
- Landing page changes are authorized only in Phase 5, and only copy changes.
- Do not commit or push without explicit instruction. No force push.
- Validation per phase: `npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run build`, plus manual QA with two test accounts for RLS isolation.
