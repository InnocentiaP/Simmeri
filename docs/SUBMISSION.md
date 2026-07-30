# Simmeri — Submission Document

## 1. Product summary

Simmeri is a personal cooking workspace: capture recipes (manually, from pasted text, from a public recipe webpage, or with AI assistance), track a lightweight kitchen inventory, see an explainable cooking-readiness status, plan meals on a calendar, generate shopping lists from planned meals or recipes, and record cooking history — all owner-isolated per authenticated user on Supabase Postgres with row-level security.

## 2. Core problem and target users

Home cooks save recipes across scattered sources (websites, notes, screenshots) and rarely revisit them, forget what's actually in their kitchen, and struggle to turn "recipes I like" into "what should I cook tonight and what do I need to buy." Simmeri targets people who want a low-friction personal recipe + kitchen + planning workspace, not a social recipe network.

## 3. Live URL

Production: **https://simmeri.vercel.app** (current deployment tracking `main`; replace with the final graded deployment URL if a new one is cut for submission).

## 4. Main implemented features

- Email/password authentication: signup, login, logout, forgot/reset password, protected `/app` shell.
- Manual Recipe CRUD (title, description, servings, prep/cook time, personal notes, ingredients with importance, steps) with archive and delete.
- Deterministic Recipe Import from pasted text or a public recipe URL (JSON-LD-aware, SSRF-hardened URL fetch).
- **Gemini-powered "Improve with AI"** recipe extraction layered on top of the deterministic import (see §5).
- Kitchen inventory (status + storage location) with search/filter and archive.
- Deterministic, explainable Cooking Readiness per recipe, derived from current Kitchen state.
- Collections (group recipes into named, user-defined lists).
- Cooking History with optional cooking-result photos.
- Meal Planning (day/week views, move/duplicate/skip/cook/remove, readiness-aware).
- Shopping Lists: manual items, plus deterministic **generation** from a recipe, multiple selected recipes, or a planner day/week, with conservative unit-aware merging and full source provenance ("needed for…").
- Purchase-to-Kitchen: explicitly confirmed, per-item create/update into Kitchen after marking items purchased.
- Real-data dashboard (active recipes, kitchen items, ready-to-cook/almost-ready counts, today's meals, recent recipes, quick actions).
- Account settings (display name, language/measurement/timezone preferences).

## 5. AI feature explanation

The AI feature is the **Gemini Recipe Import Assistant**, reachable from `/app/recipes/import`:

1. **Deterministic import runs first.** Pasting text or fetching a URL always produces a regex/JSON-LD-based structured draft with zero AI involvement — this path works even if AI is unavailable.
2. **AI is explicit, never automatic.** The user reviews the deterministic draft, then may click **"Improve with AI"** at any time; nothing calls Gemini without that click, and nothing calls it a second time without another explicit click ("Try AI again").
3. **Gemini runs server-side only**, via a single TanStack Start server function (`improveRecipeDraftWithAI`) that is the sole place `GEMINI_API_KEY` is read. The browser never talks to Gemini directly and never receives the key.
4. **Structured, validated output.** The request asks Gemini for JSON matching a fixed schema (native `responseSchema`), and the response is independently re-validated server-side with Zod before it ever reaches the UI — a malformed or non-conforming response is rejected outright, never partially accepted.
5. **Review and edit before save.** The AI result replaces the on-screen draft, clearly labeled **"AI-generated draft"**, with the copy "AI drafts can vary. Review every field before saving." Every field remains editable in the same form used for manual entry, and a **"Reset to original draft"** action restores the pre-AI snapshot.
6. **No automatic database write.** Saving still requires the user's explicit "Save recipe" click, which goes through the same `saveRecipe`/`save_recipe_with_details` transactional path used by manual and deterministic-import recipes — the AI path never writes to Postgres itself.
7. Prompt design defends against prompt injection (system-instruction/user-content channel separation, explicit "treat this as untrusted data" framing) and includes conservative-extraction rules for preparation-phrase separation, section headings, optional markers, and source-language preservation (including Indonesian and mixed-language recipes).

## 6. Technology stack

- **Frontend/framework:** TanStack Start + TanStack Router + Vite, React 19, TypeScript.
- **Styling:** Tailwind CSS + shadcn/ui primitives.
- **Server runtime:** Nitro (Vercel preset) — TanStack Start server functions are the only server-side RPC surface.
- **Database/auth:** Supabase (PostgreSQL with row-level security, Supabase Auth).
- **AI:** Google Gemini, called via a direct server-side REST request (no AI SDK dependency).
- **Testing:** Node's built-in `node:test` + `node:assert/strict`, run via `npm test`.
- **Deployment:** Vercel, Nitro `vercel` build preset.

## 7. Required production environment variables (names only)

| Variable | Where used |
|---|---|
| `SUPABASE_URL` | Server-side Supabase client |
| `SUPABASE_PUBLISHABLE_KEY` | Server-side Supabase client (anon key) |
| `SUPABASE_PROJECT_ID` | Supabase project reference |
| `VITE_SUPABASE_URL` | Browser Supabase client |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Browser Supabase client (anon key) |
| `VITE_SUPABASE_PROJECT_ID` | Browser Supabase client |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only; reserved for a genuinely admin task; not required for normal app operation; **never** exposed to the browser |
| `GEMINI_API_KEY` | Server-only; used exclusively by `src/lib/import/gemini-client.server.ts` for "Improve with AI"; **never** exposed to the browser |

No secret values are recorded anywhere in this repository — see `.env.example` for the authoritative name list.

## 8. Demo account strategy

No credentials are stored in this repository or in Git history. For grading, create a fresh account directly at `/signup` (email/password) — this is the fastest path and avoids sharing any real credential. If a pre-seeded demo account is provided separately to the evaluator, it will be shared out-of-band (e.g. in the assignment submission form or a private message), never committed to source control.

## 9. Recommended evaluator demo flow

1. Visit the landing page (`/`).
2. Register a new account at `/signup` (or log in with a provided demo account).
3. Land on the dashboard (`/app`) — real, per-account data (starts empty for a new account).
4. Go to **Add Recipe → Import a recipe**, and import a recipe from pasted text or a public recipe URL.
5. Click **Improve with AI** and review the labeled AI draft.
6. Edit any field, then **Save recipe**.
7. Add a few items to **Kitchen** (some matching the recipe's ingredients).
8. Open the recipe and observe its **Cooking Readiness** label update based on Kitchen state.
9. **Add to Meal Plan** for today or this week.
10. From the planner, **generate a shopping preview** and add it to a shopping list.
11. Mark an item **purchased**, then **update Kitchen from purchased items**.
12. **Mark the recipe as cooked**, optionally attaching a cooking photo.

## 10. Known limitations

- No canonical ingredient catalog: Kitchen/readiness/shopping matching is by normalized (trim + lowercase) ingredient name text, not a shared ingredient identity — near-duplicate names (e.g. "tomato" vs "tomatoes") can under- or over-match. This is a deliberately documented MVP limitation, not an oversight.
- No bilingual ingredient matching: the AI import assistant now preserves source language (including Indonesian) faithfully, but Kitchen/readiness matching itself is still plain-text, so an ingredient extracted as "telur" will not automatically match a Kitchen item named "eggs."
- No automated test runner wired into CI; `npm test` runs the full pure-logic suite locally/in any CI step that runs `npm install && npm test`.
- The in-memory AI rate limiter is best-effort and per-instance, not a durable, cross-instance quota.
- Timezone handling for meal planning uses local-`Date` arithmetic, not full IANA timezone awareness.

## 11. Future roadmap (explicitly out of scope for this submission)

- **Wave 3 — canonical ingredients:** a shared ingredient catalog with aliases, powering exact-identity matching across Recipes, Kitchen, and Shopping.
- **Bilingual ingredient aliases:** mapping equivalent ingredient names across languages (e.g. "beras" ↔ "rice") for Kitchen/readiness matching.
- **Recommendations:** Tonight's Deck-style suggestion surfaces beyond the current dashboard's basic ready-to-cook/almost-ready counts.
- Paid subscription / entitlements (explicitly deferred per the product PRD until a separate monetization sprint is approved).

## 12. Security notes

- **Row-level security everywhere:** every user-owned table (`recipes`, `recipe_ingredients`, `recipe_steps`, `kitchen_items`, `collections`, `cooking_history`, `cooking_photos`, `meal_plan_entries`, `shopping_lists`, `shopping_list_items`, `shopping_item_sources`, `profiles`, `user_preferences`) has owner-only RLS policies (`auth.uid() = user_id`), plus ownership-consistency triggers on tables with a second user-owned foreign key, so a crafted cross-user reference is rejected at the database layer, not just hidden in the UI.
- **`GEMINI_API_KEY` is server-only**, read exclusively inside `src/lib/import/gemini-client.server.ts`; it is never referenced in any client-shipped file and never appears in any API response.
- **`SUPABASE_SERVICE_ROLE_KEY` is server-only** and unused by any normal user-facing flow — the app operates under RLS using the anon/publishable key everywhere a user is authenticated.
- **SSRF-safe URL import**: the deterministic (and AI) recipe-URL fetch path blocks private/loopback/link-local/reserved IP ranges (including the cloud-metadata address), pins DNS resolution to the exact validated address at connect time, caps redirects/response size/timeout, and only accepts `text/html` responses — the AI path reuses this fetcher unmodified and only ever gives Gemini the already-cleaned, truncated text, never raw URL access.
- **No AI auto-save**: the Gemini path never writes to the database; every save (manual, deterministic import, or AI-assisted) goes through the same explicit, user-confirmed `saveRecipe` call.
