# Simmeri — Wave 3: Canonical Ingredients and Recommendations — Implementation Plan

## Context

Simmeri's Kitchen readiness, Shopping Generation, and purchase-to-Kitchen matching all currently determine "is this the same ingredient?" purely by normalized display text (`trim().toLowerCase()`, sometimes also whitespace-collapsed). This works well for exact, monolingual, identically-spelled matches, but produces false "missing ingredient" results whenever the same real-world ingredient is written differently — across languages ("beras" vs "rice"), plural forms ("egg" vs "eggs"), spelling/formatting ("green onion" vs "green onions"), regional synonyms ("scallion" vs "spring onion"), or ingredient variants ("all-purpose flour" vs "plain flour"). At the same time, several superficially-similar terms must never be silently merged — "beras" (raw rice) is not "nasi" (cooked rice); "milk" is not "coconut milk"; "flour" is not "almond flour." This plan designs a conservative, reviewable, multilingual canonical-ingredient layer that sits **on top of** the existing text-matching system as a first-priority, higher-confidence path — with automatic fallback to today's exact-text behavior for anything not yet canonicalized — so the transition is zero-regression at every step and nothing is ever auto-merged ambiguously.

This document is planning only. No code, migration, or Supabase change has been made. It ends with one complete, self-contained implementation prompt for Checkpoint 3.1 only.

---

## A. Current-State Audit

Verified directly against the repository (branch `plan/wave-3-canonical-ingredients`, identical to latest merged `main`).

### Tables and relevant columns (12 migrations, 15 tables today)

| Table | Ownership | Ingredient-identity-relevant columns |
|---|---|---|
| `recipes` | `user_id` | — |
| `recipe_ingredients` | `user_id` (+`recipe_id` FK) | `display_name text NOT NULL`, `raw_text`, `quantity_text`, `unit`, `preparation_note`, `importance text CHECK IN ('core','supporting','seasoning','optional')`, `position` |
| `recipe_steps` | `user_id` (+`recipe_id` FK) | — |
| `kitchen_items` | `user_id` | `ingredient_name text NOT NULL`, **`normalized_name text GENERATED ALWAYS AS (lower(trim(ingredient_name))) STORED`**, `status CHECK IN ('available','running_low','out_of_stock','unknown')`, `storage_location` |
| `meal_plan_entries` | `user_id` (+`recipe_id` FK) | — |
| `shopping_lists` / `shopping_list_items` | `user_id` | `display_name`, `quantity_text`, `unit` (free text, no canonical concept) |
| `shopping_item_sources` | `user_id` | `recipe_title_snapshot` (denormalized snapshot, never re-derived) |
| `collections` / `collection_recipes` | `user_id` | — |
| `cooking_history` / `cooking_photos` | `user_id` | `cooked_at timestamptz` (indexed `(recipe_id, cooked_at DESC)`) |
| `profiles` / `user_preferences` | `id`/`user_id` | — |

Every constrained-value column uses `text + CHECK (... IN (...))`, never a Postgres `ENUM` type (confirmed: `Enums: { [_ in never]: never }` in `types.ts`) — a new "importance"-like value set should follow this same idiom, not introduce the schema's first enum type.

### The current recipe-ingredient → Kitchen matching algorithm

Single chokepoint: `src/lib/readiness.ts`:
```ts
const norm = (s: string) => s.trim().toLowerCase();
// buildKitchenPresenceIndex: Map<normalizedName, KitchenStatus>, keyed by
//   k.normalized_name ?? norm(k.ingredient_name)
// classifyIngredientPresence: presenceIndex.get(norm(displayName))
//   no match | out_of_stock -> missing; unknown -> needs_check;
//   running_low -> running_low; else -> available
```
This exact pair (`buildKitchenPresenceIndex` + `classifyIngredientPresence`) is reused, unmodified, by **both** `computeReadiness` (readiness.ts) and `buildCandidatesForSource` (shopping-generate.ts) — it is the one shared identity-matching primitive in the whole app. A **third**, independently-implemented near-duplicate normalizer, `normalizeKitchenCandidateName` (`src/lib/kitchen-update-plan.ts`), does the same job (trim/lowercase/whitespace-collapse) for the purchase→Kitchen flow. A **fourth** (`normalizeIngredientName` in `shopping-merge.ts`, whitespace-collapsing) drives shopping-generation merge-key computation. **All four are pure exact-text-equality matchers — zero fuzzy matching, zero synonym/alias table, zero ids, anywhere in the app today.**

### Every place ingredient display names are compared

| File | Function | Purpose |
|---|---|---|
| `src/lib/readiness.ts` | `classifyIngredientPresence` | Recipe ingredient ↔ Kitchen item, for readiness |
| `src/lib/shopping-generate.ts` | `buildCandidatesForSource` (calls the above), `computeMergeKey`/`groupCandidates` (via shopping-merge.ts) | Recipe ingredient ↔ Kitchen item (same call); cross-recipe ingredient ↔ ingredient, for shopping-list merge |
| `src/lib/kitchen-update-plan.ts` | `decideKitchenUpdateTargets`/`normalizeKitchenCandidateName` | Purchased shopping item ↔ existing Kitchen item |
| `supabase/migrations/...kitchen_items` | generated column `normalized_name` | DB-level `lower(trim(...))`, backs the above |

### Every API/RPC that creates or updates recipe ingredients

- `save_recipe_with_details` (RPC, `SECURITY INVOKER`) — the **only** write path. Deletes and re-inserts every `recipe_ingredients`/`recipe_steps` row for the recipe on **every save**, from a client-supplied JSONB array. **This delete-then-reinsert behavior is the single most important constraint on any canonical-assignment design** — a canonical match stored on `recipe_ingredients` must be explicitly re-sent by the client on every save, or it will be silently lost.
- `src/lib/api.ts` → `saveRecipe(values, existingId?)` builds the JSONB payload from exactly `{display_name, raw_text, quantity_text, unit, preparation_note, importance, position}` — no id field today.
- Deterministic import (`src/lib/import/ingredient-parse.ts`), AI import (`ai-draft-schema.ts`/`ai-normalize.ts`), and AI edit (same files + `gemini-prompt.ts`'s `EDIT_SYSTEM_INSTRUCTION`) all produce/consume exactly these same 6 fields. Notably, `EDIT_SYSTEM_INSTRUCTION` **already explicitly forbids** the model from substituting a "canonical" name (e.g. "never change 'beras' to 'rice'") — strong existing precedent that canonical identity must be layered additively, never replacing `display_name`.

### Every API/RPC that creates or updates Kitchen items

`src/routes/_authenticated/app.kitchen.tsx`'s mutations — direct Supabase client calls (no RPC): insert `{user_id, ingredient_name, status, storage_location}`; update touches only `status`/`storage_location`/`archived_at`; rename updates only `ingredient_name`. `normalized_name` is DB-generated, never client-set.

### Purchase-to-Kitchen flow

`app.shopping.$shoppingListId.tsx` → `KitchenUpdateConfirmDialog.tsx` → `decideKitchenUpdateTargets` (`src/lib/kitchen-update-plan.ts`): groups active (non-archived) Kitchen rows by normalized name; 0 matches → create, 1 → update, **2+ → `"ambiguous"`, never silently resolved** (the UI must ask). This "never guess among duplicates" posture is the exact model Wave 3's own matching pipeline should extend, not replace.

### Every readiness consumer

Four independent call sites, each doing its own `kitchen_items` fetch + `computeReadiness` call — **no shared/cached readiness selector exists**: `app.recipes.$recipeId.index.tsx` (one recipe), `app.recipes.index.tsx` (every listed recipe), `app.index.tsx` dashboard (every active recipe), `app.planner.tsx` (one call per distinct recipe referenced in the visible date range, consumed by `MealPlanDayView`/`MealPlanWeekView`). Any Wave 3 readiness change must be threaded through all four independently (or a shared hook introduced — noted as a possible but non-required refactor).

### Shopping-generation dependency on ingredient names

`computeMergeKey(name, unit)` = `` `${normalizeIngredientName(name)}::${canonicalUnit(unit) ?? ""}` `` is the entire cross-recipe "same ingredient" identity today — e.g. "Garlic" (recipe A) and "garlic" (recipe B) merge; "garlic" and "garlic cloves" do not (materially different text). This is exactly the class of false-negative Wave 3 exists to fix for cross-language/cross-spelling cases, while `shopping-merge.ts`'s unit/quantity-combination safety rules (`isUnitMergeEligible`, `combineQuantityTexts`) are a **separate, orthogonal** concern that must be fully preserved.

### Current recommendation capabilities

**None exist behind authentication.** "Tonight's Deck" (`src/components/landing/TonightsDeck.tsx`) is a static, hardcoded, public **marketing mockup** — 3 fixed cards, non-functional buttons (`type="button"` with no `onClick`), zero data fetching. Grepping the entire `src/` tree for "recommend"/"score"/"ranking"/"suggestion" surfaces only this marketing copy. No favorites concept exists anywhere (zero DB column, zero UI). `cooking_history.cooked_at` (indexed `(recipe_id, cooked_at DESC)`) makes "last cooked"/recency-suppression cheaply queryable, but no bulk/aggregate query for it exists yet in `api.ts` — every current `cooking_history` read is scoped to one recipe at a time.

### Known ownership/RLS conventions new tables must follow

1. `id uuid PK DEFAULT gen_random_uuid()` (never `uuid_generate_v4()` — not installed).
2. Denormalized `user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE` on every user-owned row, RLS always checks it **directly**, never via join.
3. `created_at` always; `updated_at` + a `<table>_updated_at` trigger on every table supporting UPDATE (insert/delete-only tables like `shopping_item_sources`/`cooking_photos`/`collection_recipes` omit both the UPDATE grant and `updated_at`).
4. `GRANT ... TO authenticated` then `GRANT ALL ... TO service_role`, **before** `ENABLE ROW LEVEL SECURITY`.
5. Policies named exactly `<table>_select_own`/`_insert_own`/`_update_own`/`_delete_own`, always `auth.uid() = user_id`.
6. A `BEFORE INSERT [OR UPDATE]` **ownership-validation trigger** (`SECURITY INVOKER`, `SET search_path = public`) whenever a table FKs to another *user-owned* table besides `auth.users` — re-checking the referenced row's `user_id` matches `NEW.user_id`, since RLS alone can't see across a foreign key.
7. **No global/shared-catalog table exists anywhere in this schema today.** A globally-readable `canonical_ingredients` table would be the first of its kind — new ground, not an existing pattern to copy (addressed fully in section G).
8. No `pg_trgm`/`unaccent`/full-text-search extension is enabled — any fuzzy-matching infrastructure is net-new.

---

## B. Domain Model Options

| Criterion | Option 1 — Global only | Option 2 — User-owned only | Option 3 — Hybrid (global catalog + user aliases) |
|---|---|---|---|
| Multilingual support | Strong — one curated catalog benefits every user immediately | Weak — every user must independently build "beras=rice" for themselves; the exact problem this plan exists to solve would barely improve | Strong — global catalog carries the curated multilingual/regional alias burden once |
| Privacy | Neutral — catalog itself carries no personal data, but offers no way to keep a personal naming quirk private without it being globally visible | Strong — everything is naturally private | Strong — global rows carry no personal data; a nullable `owner_user_id` column lets a personal correction/nickname stay fully private, invisible to other users' matching (RLS-enforced) |
| RLS complexity | Low (read-only global policy) but no user-correction path at all without another table | Standard (matches every existing table exactly) | Slightly higher than either pure option (one table serves two audiences), but the mechanism (nullable `owner_user_id`) is a single well-understood pattern, not a structural novelty |
| Bootstrap data | Required, and it's the *entire* value — without seed data this option delivers nothing | None needed, but then nothing works until every user manually builds their own catalog from scratch (defeats the goal) | Required for the global side only — same seed effort as Option 1, but with a clear per-user escape hatch for anything the seed missed |
| Maintenance | Centralized, simple to review/audit, but any correction requires a migration/admin action | Fully distributed — no central quality control, duplicate effort across users, drift over time | Centralized quality control for the shared 80% case; distributed, low-ceremony correction path for the remaining 20% |
| User corrections | Impossible without an escape hatch (this option as stated has none) | Trivial (it's all user data already) | Trivial, via the same table, RLS-scoped — and never able to corrupt the global catalog (see §G) |
| Ambiguity handling | Must be solved centrally (a curator decides) — good for consistency, but a global alias that's wrong for one user's dialect/usage is wrong for everyone until fixed centrally | Each user resolves ambiguity independently — no risk of one user's wrong call affecting another, but also no shared benefit | Global aliases are curated conservatively (ambiguous terms simply aren't added as global aliases at all — see §D); ambiguity that remains is resolved per-user via the private-alias escape hatch, with zero cross-user risk |
| Duplicate prevention | A single global namespace makes duplicate/typo canonical rows easy to spot and prevent centrally | No prevention possible across users (and no need to, since it's private) | Global namespace gets the same duplicate-prevention benefit as Option 1; private aliases are scoped per-user so a "duplicate" there is harmless (just redundant for that one user) |
| Scalability | Excellent — one small, slow-growing table, heavily cached/read-mostly | Poor — N users × M ingredients, mostly duplicated effort, table grows with user count for no shared benefit | Excellent for the global table (same as Option 1); the private-alias table grows with genuine per-user customization only, which is inherently small |
| Compatibility with current Supabase model | Introduces the schema's first non-owner-scoped table with no precedent to extend for personalization | Fits the existing owner-scoped pattern perfectly, but doesn't actually solve the stated multilingual problem well | Fits the existing owner-scoped pattern for the *alias* half exactly (nullable `owner_user_id` is a small, well-contained variation, not a new paradigm), while the *catalog* half is deliberately, explicitly the first shared table — introduced carefully and narrowly (§G) rather than assumed safe |

**Recommendation: Option 3 (Hybrid).** A purely global catalog cannot absorb per-user corrections without inventing a second mechanism anyway (so Option 1 degrades into Option 3 the moment you support "fix a wrong match" — a hard requirement per §D/§H). A purely user-owned model fundamentally under-delivers on the stated multilingual/regional problem, since it offers no shared benefit across users for the exact "beras ↔ rice" class of gap that motivated this plan. The hybrid model is not automatically "safe" or "easiest" just because it's shared — its safety comes specifically from: (a) the global catalog being **read-only to every normal user** (writes are `service_role`-only, never reachable from a normal request), and (b) global *aliases* being deliberately restricted to unambiguous terms only, with ambiguity resolved by omission (§D) rather than by guessing. Both properties are designed in explicitly, not assumed.

---

## C. Proposed Data Model

Shared conventions match §A item 7 exactly (`gen_random_uuid()`, GRANT-before-RLS, standard timestamp columns) except where explicitly noted as new ground for the global-table case.

### `canonical_ingredients` (new, global, read-only to normal users)

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid PK DEFAULT gen_random_uuid()` | |
| `canonical_key` | `text NOT NULL` | Stable slug for idempotent seeding, e.g. `"rice_uncooked"`, `"rice_cooked"`, `"green_onion"`. `UNIQUE`. |
| `canonical_name` | `text NOT NULL` | Curator-facing display label (e.g. "Rice (uncooked)"). Shown to users only in small, friendly "matched to: …" hints — never as a replacement for their own `display_name`/`ingredient_name`. |
| `ingredient_state` | `text NULL` | `CHECK (ingredient_state IS NULL OR ingredient_state IN ('raw','cooked','dried','fresh','ground','whole','powder','other'))`. Documents *why* two related concepts are separate rows (e.g. `rice_raw`/`rice_cooked`) — the separation itself comes from being different rows, this column is metadata, not the mechanism. |
| `category` | `text NULL` | Free-text grouping (e.g. `"grain"`, `"dairy"`) for future filtering/UI only — not load-bearing for matching in v1. |
| `status` | `text NOT NULL DEFAULT 'active'` | `CHECK (status IN ('active','deprecated','merged'))`. Lets curators retire/consolidate entries without breaking existing FKs. |
| `merged_into_id` | `uuid NULL REFERENCES canonical_ingredients(id) ON DELETE SET NULL` | Only meaningful when `status='merged'`. Optional/stretch — not required for Checkpoint 3.1, listed here for completeness. |
| `created_at` / `updated_at` | `timestamptz NOT NULL DEFAULT now()` | Standard, with the shared `update_updated_at_column` trigger. |

Rollback: `DROP TABLE public.canonical_ingredients` (cascades `ingredient_aliases` if dropped together, or drop children first).

### `ingredient_aliases` (new, hybrid: global rows + user-private rows in one table)

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid PK DEFAULT gen_random_uuid()` | |
| `canonical_ingredient_id` | `uuid NOT NULL REFERENCES canonical_ingredients(id) ON DELETE CASCADE` | |
| `normalized_alias` | `text NOT NULL` | Lookup key: lowercase, trimmed, whitespace-collapsed, diacritic-stripped — computed and stored **pre-normalized at write time in TypeScript** (no `unaccent` DB extension needed; see §D). |
| `display_alias` | `text NOT NULL` | Original-cased form, for "matched via '…'" UI hints. |
| `language_code` | `text NULL` | ISO 639-1 (e.g. `'en'`, `'id'`); nullable for language-agnostic aliases (misspellings, abbreviations). |
| `region_code` | `text NULL` | e.g. `'US'`/`'UK'` for regional-synonym distinctions. |
| `alias_type` | `text NOT NULL DEFAULT 'synonym'` | `CHECK (alias_type IN ('synonym','regional','plural','misspelling','abbreviation','brand'))`. |
| `confidence` | `real NULL` | `CHECK (confidence IS NULL OR (confidence BETWEEN 0 AND 1))`. Set by non-human sources (AI-suggested, future crowd-sourcing); curated seed rows typically omit it (implicitly max-trust by virtue of `review_status='approved'` + `source='seed'`). |
| `review_status` | `text NOT NULL DEFAULT 'approved'` | `CHECK (review_status IN ('pending','approved','rejected'))`. Seed/admin rows are inserted `'approved'` directly; a future suggestion pipeline could insert `'pending'` rows (out of scope now — the column exists so it's ready). |
| `source` | `text NOT NULL DEFAULT 'seed'` | `CHECK (source IN ('seed','user','ai_suggested','admin'))`. |
| `owner_user_id` | `uuid NULL REFERENCES auth.users(id) ON DELETE CASCADE` | **The hybrid mechanism.** `NULL` = global/curated; non-null = private to that user. |
| `created_at` / `updated_at` | `timestamptz NOT NULL DEFAULT now()` | Standard trigger. |

**Uniqueness** (two partial unique indexes, since Postgres treats `NULL <> NULL` and a naive 3-column `UNIQUE` would allow duplicate global rows):
```sql
CREATE UNIQUE INDEX ingredient_aliases_global_alias_unique_idx
  ON public.ingredient_aliases (normalized_alias) WHERE owner_user_id IS NULL;
CREATE UNIQUE INDEX ingredient_aliases_owner_alias_unique_idx
  ON public.ingredient_aliases (owner_user_id, normalized_alias) WHERE owner_user_id IS NOT NULL;
CREATE INDEX ingredient_aliases_normalized_alias_idx ON public.ingredient_aliases (normalized_alias);
```
One global alias string can only ever point at **one** canonical ingredient — this is the core anti-ambiguity mechanism (§D): a genuinely ambiguous term is resolved by *not creating a global alias for it at all*, not by letting one alias fan out to multiple candidates.

Rollback: `DROP TABLE public.ingredient_aliases`.

### Recipe-ingredient and Kitchen-item canonical assignment

**Decision: nullable columns directly on `recipe_ingredients` and `kitchen_items`, not a separate assignment table** — with one explicit, load-bearing caveat.

| Column | Type | Notes |
|---|---|---|
| `canonical_ingredient_id` | `uuid NULL REFERENCES canonical_ingredients(id) ON DELETE SET NULL` | `SET NULL`, not `CASCADE` — losing the canonical mapping must never delete the user's actual ingredient/Kitchen row (same snapshot-preservation philosophy as `shopping_item_sources`). |
| `match_status` | `text NOT NULL DEFAULT 'unmatched'` | `CHECK (match_status IN ('unmatched','suggested','confirmed'))`. Only `'confirmed'` is ever trusted by readiness/shopping logic (§I/§J). |
| `match_source` | `text NOT NULL DEFAULT 'none'` | `CHECK (match_source IN ('none','exact_alias','user_alias','deterministic_morphology','ai_suggested','manual'))`. |
| `match_confidence` | `real NULL` | `CHECK (match_confidence IS NULL OR (match_confidence BETWEEN 0 AND 1))`. |
| `canonicalized_at` | `timestamptz NULL` | Set whenever `match_status` last changed. |

**Why a column, not a separate assignment table**: a separate table would need its own ownership trigger, its own RLS, and — critically — would not simplify the one real risk here, which is that `save_recipe_with_details` **deletes and re-inserts every `recipe_ingredients` row on every save**. A separate table keyed by `recipe_ingredient_id` would be just as vulnerable to silent loss unless the RPC explicitly re-links it post-insert — no simpler than threading one more field through the JSONB payload the RPC already accepts. **This is why `kitchen_items` (individually, stably updated — safe) and `recipe_ingredients` (bulk-replaced on every save — needs explicit client round-tripping) are not symmetric risks**, and it is called out again in §F/§I.

RLS: **no changes needed.** These are new nullable columns on already-RLS-protected, already-owner-scoped tables — Postgres RLS is row-level, so the existing 4 policies on each table automatically cover the new columns. No new ownership-validation trigger is needed either: unlike every existing FK-triggers-a-check case in this schema, `canonical_ingredients` is not itself user-owned, so there is no "owner" to cross-check — the FK constraint alone (id must exist) is sufficient.

Preserving original text: **`display_name`/`raw_text`/`ingredient_name` are never modified by any part of this design.** Canonical assignment is purely additive metadata sitting beside the existing text fields.

(Per §M, these five columns × two tables are **Checkpoint 3.2** work, not 3.1 — 3.1 ships the catalog only.)

---

## D. Ingredient Identity Rules

**Normalization** (new shared pure function, `normalizeForCanonicalMatch`): trim → lowercase → collapse internal whitespace → strip diacritics via `str.normalize("NFD").replace(/[̀-ͯ]/g, "")` (native JS, no dependency, no DB `unaccent` extension needed since normalization happens before every write/lookup, not at query time) → strip trailing punctuation. This becomes the canonical-matching pipeline's own normalizer; it does **not** replace the four existing normalizers in readiness.ts/shopping-merge.ts/kitchen-update-plan.ts in this plan's scope (zero regression risk to already-tested code) — unifying them is flagged as optional post-Wave-3 cleanup (§P).

**Conservative rules:**

| Concern | Rule |
|---|---|
| Case/whitespace | Always normalized before any comparison (as today). |
| Singular/plural | Only trusted as a *secondary confirmation* on top of an existing alias/name hit (e.g. strip one trailing "s" only when the resulting singular form itself independently resolves to a known term) — never a blind stemmer, to avoid "molasses"→"molasse"-style corruption. |
| Punctuation | Stripped conservatively (hyphens, commas at word boundaries) as part of normalization; never used to *split* a term into parts. |
| Accents/diacritics | Stripped for matching purposes only; `display_alias`/`display_name` retain the original. |
| Preparation descriptors | **Not handled by the canonical matcher at all.** `preparation_note` is already a separate field, populated upstream by the deterministic parser or AI import/edit — the canonical matcher only ever looks at the already-separated `display_name`. If raw unparsed text still contains a prep word (legacy/typed-verbatim Kitchen items), it is conservatively left unmatched rather than the matcher inventing its own prep-stripping logic. |
| Size descriptors | Never treated as part of the matching key (mirrors the existing Gemini prompt rule that "small/medium/large" are not units — same conservative spirit applied here: not identity-relevant). |
| Language aliases / regional synonyms | Curated **global** `ingredient_aliases` rows only, added deliberately (seed data or admin action), never inferred automatically. |
| Cooked vs. uncooked, fresh vs. dried, whole vs. ground | Always **separate `canonical_ingredients` rows**, optionally tagged via `ingredient_state` for grouping — never the same row with a flag that matching logic might ignore. |
| Generic vs. subtype | A subtype (e.g. "almond flour") is **always** a separate canonical row from its generic parent ("flour") unless a curator explicitly adds a global alias — which, per the ambiguity rule below, they should not for a genuinely distinct subtype. |
| Brand names | Only matched via an explicit, curated `alias_type='brand'` global alias (e.g. a specific known brand → its generic equivalent); an unrecognized brand name is left unmatched, never guessed. |
| Ambiguous aliases | **Never added as a global alias at all.** A term that could plausibly mean more than one canonical concept is deliberately omitted from the global catalog — ambiguity is resolved by omission (forcing per-recipe/per-user manual confirmation), not by one alias fanning out to multiple candidates. This is enforced structurally by the partial unique index on `normalized_alias` (§C). |

**Explicit non-equivalences (must never share a canonical row or a global alias):**

| A | B | Why |
|---|---|---|
| beras | nasi | Raw vs. cooked rice — separate rows, `ingredient_state='raw'`/`'cooked'` |
| rice | cooked rice | Same reasoning — "rice" alone should not resolve to a cooked-rice canonical row; see open question in §P about whether bare "rice" should be seeded at all |
| tomato | tomato paste | Fresh ingredient vs. distinct processed product |
| tomato | canned tomatoes | Fresh vs. distinct canned product |
| milk | coconut milk | Entirely different ingredients, not a "state" of milk |
| butter | margarine | Common substitute, not an equivalence |
| onion | onion powder | Fresh/whole ingredient vs. processed derivative |
| garlic | garlic powder | Same pattern |
| flour | almond flour | Generic vs. subtype — subtypes never inherit the generic's matches |
| green onion | leek | Explicitly flagged by the product brief itself as uncertain — **default to separate canonical rows**, never a global alias; a user who genuinely treats them as interchangeable can add a **private** alias (§C's `owner_user_id` escape hatch), never a global one |

**When automatic / suggestion / manual confirmation is required:**

| Tier | `match_status` set | Trigger |
|---|---|---|
| Automatic | `confirmed` | Exact hit against a user-owned alias (checked first) or a global alias (checked second); or a safe morphology confirmation *on top of* one of those hits |
| Suggestion (never auto-applied) | `suggested` | A conservative fuzzy/trigram candidate above a high similarity threshold (Checkpoint 3.2+), or an optional future AI-suggested candidate — always requires an explicit user confirm click |
| Manual required | stays `unmatched` | No alias hit, no confident fuzzy candidate, or the user rejected a suggestion — falls back to today's exact-text behavior with zero regression |

**AI's role**: not required for the first implementation. Deterministic alias lookup + conservative fuzzy matching is expected to cover the large majority of real cases; AI-assisted suggestion is an optional, explicitly-deferred future pipeline step (§E/§P), and even if built, it may only ever produce a `'suggested'` row — it must never silently assign `'confirmed'` status to an ambiguous term, matching the same "AI must not silently create approved state" principle already enforced for AI Recipe Import/Edit.

**Corrections**: a user changes a match via a picker UI → the row is overwritten directly (`match_status='confirmed', match_source='manual'`) — no audit/history table in v1 (explicit YAGNI cut, easy to add later). Corrections persist on the row itself; for `recipe_ingredients`, they only survive a subsequent save if the client explicitly re-sends the same `canonical_ingredient_id`/`match_status` fields through `save_recipe_with_details`'s JSONB payload (§C/§F — the one real risk in this whole design).

**Preventing one user's private naming from leaking into another user's data**: enforced at the RLS layer, not the application layer — a private (`owner_user_id`-scoped) alias is invisible to every other user's `SELECT` query by construction (§G), so it can never be considered a candidate during another user's matching pipeline, full stop.

---

## E. Matching Pipeline

Deterministic-first, in priority order:

1. **Existing confirmed canonical ID** — if `match_status='confirmed'` already, trust it; skip everything below. Never re-evaluated automatically (only an explicit user "re-match" action or a `display_name` edit would re-trigger step 2+).
2. **Alias lookup** (user-owned then global) — normalize the term, look up `ingredient_aliases` where `owner_user_id = auth.uid() OR owner_user_id IS NULL`, preferring a user-owned hit over a global hit when both exist (personal override wins). A hit → `confirmed`, `match_source` = `'user_alias'` or `'exact_alias'`, `match_confidence = 1.0`.
3. **Safe deterministic morphology** — e.g. singular/plural stripping, applied only when the transformed term *also* independently resolves via step 2. → `confirmed`, `match_source='deterministic_morphology'`, `match_confidence≈0.95`.
4. **Conservative candidate suggestion (non-AI)** — trigram/fuzzy similarity search (Checkpoint 3.2+, needs `pg_trgm`) against `normalized_alias`/`canonical_name`, high threshold only. → `suggested`, `match_source` reflects the underlying alias type, `match_confidence` = similarity score.
5. **Optional AI-assisted suggestion** — reusing the existing Gemini architecture (server-side key handling, prompt-injection defenses, Zod validation) *if and when built*; given a short candidate shortlist (from step 4), asks Gemini to pick the best match or abstain. → `suggested` only, never `confirmed`. **Recommended: not built in the first implementation** (§D).
6. **Manual user confirmation** — user searches/picks from the catalog (a picker UI, modeled on the existing `CollectionPicker`/`RecipePicker` convention) to confirm or correct. → `confirmed`, `match_source='manual'`.
7. **Unmatched** — default state; ingredient/Kitchen item behaves exactly as today (§I/§J fallback).

Confidence representation: `real` 0–1 on the ingredient/Kitchen row, set by whichever step produced the current match. Corrections persist by direct overwrite (no history table, §D). Private-alias leakage prevention: RLS-enforced (§D/§G), not an application-layer filter.

---

## F. Migration and Backfill Strategy

- **Checkpoint 3.1**: two new tables only (`canonical_ingredients`, `ingredient_aliases`) + RLS + indexes + a genuine curated starter seed dataset (aliases included, inserted via `ON CONFLICT (canonical_key) DO NOTHING` / `ON CONFLICT ... DO NOTHING` on the alias unique indexes — fully idempotent, safe to re-run). **No columns are added to `recipe_ingredients`/`kitchen_items` in 3.1** — there is nothing yet to backfill, and the catalog is completely inert (referenced by nothing) until 3.2, which is the safest possible way to introduce the first shared/global table into this schema.
- **Checkpoint 3.2**: the five new columns on `recipe_ingredients` and `kitchen_items` (all nullable/defaulted — existing rows simply get `match_status='unmatched'`, everything else `NULL`/`'none'`), plus a **one-time, idempotent, deterministic backfill query** — re-running pipeline step 2 (exact global-alias match only) in bulk over existing rows, setting `confirmed`/`exact_alias`/`1.0` only where the normalized text exactly hits a global alias. Ambiguous/fuzzy candidates are explicitly left `unmatched` by the backfill — never auto-confirmed in bulk.
- **Rollback**: every change is additive — drop the two new tables (3.1) or drop the ten new columns (3.2) — zero impact on `display_name`/`ingredient_name`/any existing data. No destructive rewrite of display text occurs anywhere in this design.
- **Idempotence**: `IF NOT EXISTS`/`ON CONFLICT DO NOTHING` throughout; the backfill UPDATE is naturally idempotent (re-running it just re-confirms already-confirmed rows).
- **Indexes**: FK-column indexes on `recipe_ingredients(canonical_ingredient_id)` and `kitchen_items(canonical_ingredient_id)` (3.2); the alias-table indexes from §C (3.1). `pg_trgm`/GIN trigram indexes are introduced only in 3.2, when fuzzy suggestion UX is actually built — not part of 3.1's minimal footprint.
- **Migration order**: (1) `canonical_ingredients` → (2) `ingredient_aliases` (FK depends on 1) → (3) seed-data `INSERT`s for both, same or a companion migration → *(3.2, separately)* (4) `ALTER recipe_ingredients ADD COLUMN ...` → (5) `ALTER kitchen_items ADD COLUMN ...` → (6) backfill `UPDATE`s.
- **Generated types**: this repo hand-maintains `src/integrations/supabase/types.ts` (no `supabase gen types` step observed in any prior checkpoint this session) — Checkpoint 3.1 must manually add `canonical_ingredients` (alphabetically before `collection_recipes`) and `ingredient_aliases` (alphabetically between `early_access_signups` and `kitchen_items`) Row/Insert/Update/Relationships blocks, matching the exact style of every existing table entry.

---

## G. RLS and Security

| Table | Global readable? | Who may INSERT/UPDATE/DELETE |
|---|---|---|
| `canonical_ingredients` | Yes — `FOR SELECT TO authenticated USING (true)` (**the first such policy in this schema** — treated as new ground, not copied from any precedent) | Nobody via the `authenticated` role — no INSERT/UPDATE/DELETE grant to `authenticated` at all (belt-and-suspenders: even a mistakenly-added future policy would be rejected by the missing GRANT before RLS is evaluated). `GRANT ALL ... TO service_role` only. |
| `ingredient_aliases` | Global rows (`owner_user_id IS NULL`) — yes, to every authenticated user. Private rows — only to their owner. `SELECT ... USING (owner_user_id IS NULL OR owner_user_id = auth.uid())` | `authenticated` may INSERT/UPDATE/DELETE **only rows where `owner_user_id = auth.uid()`** (`WITH CHECK`/`USING` on every mutating policy) — structurally incapable of creating, editing, or deleting a global (`NULL`-owner) row, since no combination of a real `auth.uid()` value ever equals `NULL`. `service_role` (migrations, rare deliberate admin action) is the only path to global rows. |

- **Preventing users from mutating trusted global aliases**: enforced exactly as above — not a convention to remember, a structural impossibility given the `WITH CHECK`/`USING` clauses.
- **Preventing cross-user data leakage**: the same `owner_user_id` scoping on `SELECT` — a private alias is invisible to every other user's queries at the database layer.
- **Seeding global data safely**: migrations run with elevated (superuser/service) privileges in Supabase, so RLS never blocks migration-time seed `INSERT`s regardless of the policies above; no `SECURITY DEFINER` function is needed for seeding.
- **Functions/RPC risk**: **no new `SECURITY DEFINER` function is introduced anywhere in this plan.** Every existing RPC in this codebase is `SECURITY INVOKER` except the one narrow, already-audited exception (`handle_new_user`, invoked only by an `auth.users` trigger with `EXECUTE` revoked from all normal roles) — this plan adds nothing that needs to escalate privilege, since global-catalog writes are `service_role`-only and out-of-band, never reachable from a normal authenticated request.
- **`search_path` hardening**: any future trigger function this plan does introduce (none required for 3.1; possibly one in 3.2 if a "confirm match" RPC is added) would follow the existing `SECURITY INVOKER, SET search_path = public` convention exactly.
- **Ownership validation**: not needed for the new `canonical_ingredient_id` FK on `recipe_ingredients`/`kitchen_items` (§C) — the referenced table isn't user-owned, so there is no cross-owner case to check; the FK constraint itself (row must exist) is the only integrity requirement.
- **No service-role dependency in normal application flows**: confirmed — every normal user-facing action (reading the catalog, creating a private alias, assigning/confirming a match) only ever needs the `authenticated` role. `service_role` is used exclusively for migration-time seeding and rare, deliberate, out-of-band catalog curation — never invoked as part of any request a logged-in user makes.

---

## H. Recipe and Kitchen UX

**Recipe ingredient** (Recipe Edit / import review, friendly wording — no "canonical ID" ever shown):
- **Matched automatically**: a small, quiet indicator (e.g. a subtle checkmark or tinted background) — no interruption; hovering/tapping reveals "Matched to: Rice (uncooked)."
- **Suggested match**: a dismissible chip — "Looks like: Green Onion? [Confirm] [Not quite]" — never applied without the tap.
- **Ambiguous match**: presented identically to "suggested," just with lower visual confidence framing if multiple candidates exist — never auto-picks one.
- **No match**: silent — identical to today's experience, no nagging UI for every unmatched ingredient (avoids interrupting a workflow that already works today).
- **Correcting a match**: an inline "Change match" action opens a small search picker over the catalog (modeled on `CollectionPicker`), searchable by any language's alias text.
- **Preserving original language**: never touched — the picker's search results are labeled with `canonical_name` (a friendly reference label), but the ingredient's own `display_name` is never rewritten by this flow.

**Kitchen item**:
- **Matched automatically**: same quiet-indicator treatment as above.
- **User selects canonical identity**: available as an optional step when adding/editing a Kitchen item — never mandatory (a user can always just type a name and status, exactly as today).
- **User creates an unmatched custom item**: fully supported, identical to today's flow — this is simply the "no match" / "declined to match" state, not a special mode.
- **User changes a wrong assignment**: same "Change match" picker as recipe ingredients.
- **Purchase-to-Kitchen behavior**: `decideKitchenUpdateTargets`'s existing create/update/ambiguous UX (§A) is preserved verbatim; a canonical-aware enhancement (matching a purchased item to a Kitchen row via shared canonical id first) is an explicit, separately-decided extension (§J, flagged open in §P), not assumed as part of this UX.

---

## I. Readiness Integration

**Transition design**: canonical matching is a **first, higher-priority pass**, with automatic, per-ingredient fallback to today's exact-text matching — never a global on/off switch, never a hard cutover.

Rules:
- A **confirmed** canonical match on both the recipe ingredient and a Kitchen item (same `canonical_ingredient_id`) takes priority — presence is read directly from that Kitchen item's status.
- If either side is `unmatched`/`suggested` (not `confirmed`), or no Kitchen item shares that canonical id, fall through to the exact current text-normalization behavior (`classifyIngredientPresence` as it exists today) — **zero regression** for anyone/anything not yet canonicalized.
- `suggested`/ambiguous assignments are **never** trusted for readiness purposes — this is enforced structurally by only ever branching on `match_status === 'confirmed'`.
- Optional-ingredient exclusion, Running Low, and Unknown semantics are completely unchanged (they're orthogonal to *how* a match was found).
- Explanations (`ReadinessExplanation`'s arrays) continue to store the user's own `display_name` text, never `canonical_name` — canonical matching changes *how* presence is determined, never *what* text is shown.

**Pure functions/modules likely to change** (Checkpoint 3.3): `buildKitchenPresenceIndex` gains a second, sibling index keyed by `canonical_ingredient_id` (additive — the existing normalized-name index is untouched); a new function (e.g. `classifyIngredientPresenceCanonicalFirst`) tries the canonical index first, then delegates to the existing, unmodified `classifyIngredientPresence` — added as a new function rather than mutating the existing one's signature, exactly matching how `buildKitchenPresenceIndex`/`classifyIngredientPresence` were themselves additively extracted from `computeReadiness` in Wave 2 with zero behavior change (verified by that extraction's own regression tests).

**Required tests**: all 28 existing `readiness.test.ts` cases must remain green, untouched. New cases: confirmed canonical match takes priority over what would otherwise be a text mismatch; `suggested` status is never trusted; fallback to text matching when canonical data is absent on either side; a recipe with a mix of canonicalized and non-canonicalized ingredients computes correctly end-to-end.

---

## J. Shopping Integration

- `computeMergeKey` gains a canonical-first variant: two candidates sharing the same **confirmed** `canonical_ingredient_id` are recognized as the same ingredient for grouping purposes even when their raw `display_name` text differs (e.g. "beras" from one recipe and "rice" from another) — **this is the actual cross-language duplicate-detection payoff** of the whole design.
- This only changes *grouping* — the existing, separate unit/quantity-combination safety rules (`isUnitMergeEligible`, `combineQuantityTexts`, prep-note-conflict detection) are completely unaffected and still gate whether quantities actually combine numerically.
- **Display name of a merged item**: keep the first contributing source's original `display_name` (matching `groupCandidates`' existing `members[0].displayName` convention) — never substitute `canonical_name`. Never retroactively erase the original label.
- **Provenance snapshots** (`shopping_item_sources`): completely unaffected — still recorded exactly as today.
- **Manual shopping items**: never carry a `canonical_ingredient_id` (no generating ingredient row to derive one from) — unaffected, matched purely by text as today.
- **Unknown units**: unaffected — orthogonal concern, already conservative.
- **Purchased-item Kitchen updates**: a canonical-aware enhancement to `decideKitchenUpdateTargets` (matching a purchased item to an existing Kitchen row via shared canonical id, falling back to today's text match) would require `shopping_list_items` to *also* gain a nullable `canonical_ingredient_id`, propagated from the generating `recipe_ingredient` at generation time. **This is an explicit open decision (§P), not resolved by this plan** — it's a real, additional scoped change (one more nullable column on one more table) that deserves its own deliberate checkpoint rather than being assumed bundled into §I's readiness work.

---

## K. Recommendation Foundation

**Deterministic scoring model** (pure TS module, e.g. `src/lib/recommendations/score.ts`, weights as named constants — tunable without touching matching logic):

| Signal | Example weight | Why this signal exists |
|---|---|---|
| Readiness label | `ready_to_cook: +100`, `almost_ready: +60`, `check_first: +20`, `needs_shopping`/`not_ready`: excluded entirely (or `-1000`) | The primary "can I actually cook this right now" gate — everything else is a tiebreaker on top of this |
| Favorite (net-new; §A confirms nothing exists today) | `+25` | Explicit, unambiguous user preference — the strongest non-readiness signal available |
| Never cooked | `+15` | Encourages exploring the user's own collection rather than only ever resurfacing the same handful of recipes (matches the PRD's own "Never Cooked" dashboard-suggestion category) |
| Recently cooked (suppression) | scaled penalty, e.g. `-30` if `cooked_at` within 7 days, `0` beyond ~30 days | Diversity — avoids the deck feeling repetitive; `cooking_history.cooked_at` is already indexed per-recipe (§A), just needs a new bulk "latest per recipe" query |
| Already planned (upcoming) | `+10` | Continuity signal — surfacing what the user already decided to cook reduces redundant decision-making |
| Cook time | optional light boost/filter for short `cook_time_minutes` | Time-based filtering, explicitly requested |

Deterministic tie-breaking: ties broken by a stable secondary key (e.g. `id`, or `created_at`) — never randomized, so results are reproducible across renders/refreshes and directly testable.

**AI is explicitly not responsible for ranking in the first version** — determinism, explainability, testability, latency, and cost all argue against it; a natural-language "why this pick" blurb generated *alongside* (never influencing) the deterministic score is a plausible post-Wave-3 idea, not part of this plan's committed scope.

---

## L. Tonight's Deck

- **Card count**: 5–8, matching the product brief's own explicit "Limit a session to five to eight cards initially."
- **Eligibility**: exclude archived recipes; default set = `ready_to_cook` + `almost_ready` only (genuinely "what can I cook tonight," not padded with unready recipes).
- **Ranking**: the §K deterministic score.
- **Labels/explanation**: reuse `readinessDisplay`/`readinessTone`/`readiness.explanation` verbatim — no new UI primitives needed for this part.
- **Actions**: Skip (session-only, client state, no DB write — per the product brief's own "Not Tonight is session-specific" rule), Shortlist (session-only comparison list), View Recipe (navigate to detail), Add to Meal Plan (reuse existing `MealPlanEntryForm`), Cook This (reuse existing `CookingHistoryForm`) — **all reuse existing components/flows**; the deck itself needs zero new domain mutations.
- **Too few eligible recipes**: an explicit, friendly empty/sparse state ("Not enough ready-to-cook recipes right now — update your Kitchen or browse My Recipes") rather than silently padding the deck with not-ready recipes.
- **Mobile**: single-card-at-a-time layout; per the product brief's explicit "every gesture must have visible button and keyboard alternatives" rule, buttons are the primary, required interaction.
- **Swipe interaction**: recommended **deferred** — Checkpoint 3.5 ships fully accessible button/keyboard-driven card navigation first; swipe gesture handling (if ever added) is a pure enhancement layered on top later, never a requirement.

---

## M. Phased Implementation Plan

### Checkpoint 3.1 — Canonical catalog foundation
1. **Objective**: introduce the canonical-ingredient catalog and multilingual alias table, fully inert (referenced by nothing else in the app), with pure TS normalization/lookup helpers and full test coverage.
2. **Dependencies**: none.
3. **Files created**: `supabase/migrations/<ts>_canonical_ingredients.sql` (schema + RLS + seed); `src/lib/ingredients/normalize.ts` + `.test.ts` (pure `normalizeForCanonicalMatch`); `src/lib/ingredients/canonical-lookup.ts` + `.test.ts` (pure, operates on already-fetched alias rows — no live DB calls, matches every existing "pure module" convention in this codebase).
4. **Files modified**: `src/integrations/supabase/types.ts` (two new table entries, alphabetically placed, per §F).
5. **Migrations**: one file, per §F/§C exactly — `canonical_ingredients`, `ingredient_aliases`, both partial unique indexes, RLS (§G), seed data covering every example term named throughout this plan (rice_raw/rice_cooked/beras/nasi, egg/eggs, green_onion/scallion/spring_onion, onion, garlic, all_purpose_flour/plain_flour, almond_flour, tomato_fresh/tomato_canned/tomato_paste, milk/coconut_milk, butter, margarine, onion_powder, garlic_powder — roughly 15–20 canonical rows, 30–50 aliases).
6. **RLS**: exactly as specified in §G — no deviation.
7. **Server/client boundaries**: none — no server function, no route, no UI. The catalog is queryable directly via the browser Supabase client (read-only, RLS-enforced) but nothing calls it yet.
8. **Validation**: `npx tsc --noEmit`, targeted ESLint, `node --test` on the two new test files + full existing suite (regression — must be unaffected), `npm run build`.
9. **Tests**: normalization edge cases (case, whitespace, diacritics, safe-plural-only-when-confirmed); lookup-helper tests against a fixture alias set, explicitly including regression tests for every non-equivalence pair in §D (asserting the fixture never accidentally provides a path from one to the other).
10. **Manual QA**: after manually applying the migration in the Supabase SQL editor, run read-only `SELECT` queries confirming the seed data landed correctly and RLS behaves as designed (an authenticated test user can `SELECT` all global rows; cannot `INSERT`/`UPDATE`/`DELETE` any row; can `INSERT` a private alias for themselves; a second test user cannot see the first user's private alias).
11. **Acceptance criteria**: both tables exist with correct constraints/RLS; seed data present and idempotent (safe to re-run the migration); zero existing test regressions; zero UI/behavior change anywhere in the live app.
12. **Risks**: this is the first globally-readable table in the schema — mitigated by the narrow, explicit RLS design in §G (read-only to `authenticated`, write-only to `service_role`) and by shipping it completely inert (nothing references it yet, so even a design mistake here has zero blast radius on the live app).
13. **Rollback**: `DROP TABLE public.ingredient_aliases; DROP TABLE public.canonical_ingredients;`
14. **Cut scope**: seed-data breadth is the first thing to trim if needed — even 5–6 canonical rows with their aliases is enough to prove the design; breadth can grow via later, separate seed migrations.
15. **Complexity**: Low–Medium (schema design is the hard part, already done above; the migration itself is mechanical).

### Checkpoint 3.2 — Assignment and correction UX
1. **Objective**: attach canonical identity to real recipe-ingredient and Kitchen-item rows, with safe automatic matching, a manual-correction picker UI, and a one-time backfill.
2. **Dependencies**: 3.1 merged and its migration applied.
3. **Files** (indicative, not exhaustive): `supabase/migrations/<ts>_recipe_kitchen_canonical_columns.sql` (the 10 new columns + backfill, §F); updates to `src/lib/api.ts` (`saveRecipe`'s JSONB payload gains `canonical_ingredient_id`/`match_status`/etc.; Kitchen CRUD functions gain the same), `RecipeFormValues`/`recipeFormSchema` (RecipeForm.tsx), `save_recipe_with_details` RPC (thread the new fields through its existing per-item JSONB handling — the one genuinely load-bearing change in this checkpoint, per §C's caveat); a new picker component (modeled on `CollectionPicker`); Kitchen item add/edit UI gains an optional match step.
4. **Migrations**: additive columns + idempotent backfill, per §F.
5. **RLS**: none needed (§C) — existing table policies already cover the new columns.
6. **Server/client boundaries**: none — everything here is client-direct Supabase calls plus the existing `save_recipe_with_details` RPC (extended, not replaced), matching every prior checkpoint's established pattern.
7. **Validation/Tests**: matching-pipeline pure-function tests (alias hit, morphology confirmation, fuzzy suggestion threshold — introduces `pg_trgm` here, not in 3.1), picker component behavior, backfill-query correctness (verified via manual SQL, since there's no DB in `node:test`).
8. **Manual QA**: create a recipe with a "beras" ingredient, confirm it can be matched to the seeded canonical row; edit and re-save the recipe, confirm the match survives (the critical delete-reinsert risk from §C, directly verified); correct a wrong match via the picker; add a Kitchen item and confirm/skip a suggested match.
9. **Acceptance criteria**: a canonical match survives a recipe re-save; corrections persist; unmatched remains the safe default; zero readiness/shopping behavior change yet (still Checkpoint 3.3's job).
10. **Risks**: the RPC-threading requirement (§C) is the single highest-risk item in the entire Wave 3 plan — get this checkpoint's manual QA step 8 (re-save survival) exactly right before proceeding.
11. **Rollback**: drop the 10 new columns; revert the RPC to its pre-3.2 body (still additive/backward-compatible either way, since the new JSONB fields are optional).
12. **Cut scope**: fuzzy/`pg_trgm` suggestion is the first thing to cut if needed — exact-alias-only matching (steps 1–3 of §E) still delivers real value and is far simpler to ship correctly.
13. **Complexity**: High (the largest checkpoint in the wave — RPC changes, new UI, backfill, and the highest-risk data-loss class of bug).

### Checkpoint 3.3 — Readiness and shopping integration
1. **Objective**: make canonical matches actually affect Kitchen readiness and Shopping Generation, with automatic fallback, per §I/§J.
2. **Dependencies**: 3.2 merged (real canonical assignments must exist to integrate against).
3. **Files**: `src/lib/readiness.ts` (additive: canonical-aware index + classifier, per §I), `src/lib/shopping-generate.ts`/`shopping-merge.ts` (additive: canonical-first merge key, per §J), the four readiness call sites (§A) updated to pass canonical data through.
4. **Migrations**: none.
5. **RLS**: none.
6. **Server/client boundaries**: none.
7. **Validation/Tests**: full `readiness.test.ts` (28 cases) and `shopping-generate.test.ts`/`shopping-merge.test.ts` regression, plus new canonical-priority/fallback/never-trust-suggested cases per §I, plus cross-language merge cases per §J.
8. **Manual QA**: a recipe using "beras" reads as available when Kitchen has "rice" confirmed to the same canonical id; generating a shopping list across two recipes using "scallion" and "spring onion" (both confirmed to the same canonical id) merges into one line.
9. **Acceptance criteria**: exactly the requirements listed in §I and §J, verbatim.
10. **Risks**: this is where a subtle bug could produce a false "available" — mitigated by the "only `confirmed` is ever trusted" rule being structurally enforced (a single boolean check), not a judgment call scattered across call sites.
11. **Rollback**: revert the additive functions/call-site changes; the underlying 3.1/3.2 schema is untouched either way.
12. **Cut scope**: shopping-merge integration can ship after readiness integration if needed — they're independent, both built on the same canonical-priority-with-fallback primitive.
13. **Complexity**: Medium–High (behavior-sensitive, but the design (fallback-first) is deliberately structured to minimize risk).

### Checkpoint 3.4 — Recommendations foundation
1. **Objective**: ship the deterministic scoring model and a first recommendations surface (dashboard section or dedicated route), per §K.
2. **Dependencies**: 3.3 (readiness must be canonical-aware for scoring to be meaningfully better than today), plus a new `favorites` migration (small, additive, standard owner-scoped table — the one net-new piece of schema in this checkpoint, unrelated to canonical ingredients themselves).
3. **Files**: `supabase/migrations/<ts>_recipe_favorites.sql`; `src/lib/recommendations/score.ts` + `.test.ts`; a bulk "last cooked per recipe" query added to `src/lib/api.ts`; dashboard or new route UI surfacing Ready/Almost/Use-Soon groupings.
4. **Migrations**: one small additive table (`recipe_favorites` or a boolean column on `recipes` — decide at that checkpoint's own design time).
5. **RLS**: standard owner-scoped pattern (§A item 7) — no new ground here, unlike 3.1.
6. **Validation/Tests**: scoring-function unit tests (weight application, exclusion of not-ready recipes, deterministic tie-breaking, empty-state).
7. **Manual QA**: favorite a recipe, confirm it scores/sorts higher; cook a recipe, confirm it's suppressed from top recommendations shortly after.
8. **Acceptance criteria**: per §K.
9. **Risks**: low — purely additive, read-heavy, no write-path risk comparable to 3.2.
10. **Rollback**: drop the favorites table/column; the scoring module is pure and stateless, trivially removable.
11. **Cut scope**: "Use Soon" (whatever specific signal that maps to — e.g. ingredients nearing a self-reported staleness, not currently modeled anywhere) is the most speculative sub-feature here and the first to cut; Ready/Almost Ready alone still deliver value.
12. **Complexity**: Medium.

### Checkpoint 3.5 — Tonight's Deck
1. **Objective**: replace the static marketing mockup's *concept* with a real, authenticated, functional deck, per §L.
2. **Dependencies**: 3.4 (scoring must exist).
3. **Files**: a new authenticated route/component (the existing `src/components/landing/TonightsDeck.tsx` is public marketing content and is explicitly out of scope to modify — a new, separate authenticated component is built instead); reuses `MealPlanEntryForm`/`CookingHistoryForm` for its actions.
4. **Migrations**: none (session-only Skip/Shortlist state, per §L).
5. **Validation/Tests**: eligibility-filter tests, empty-state tests, deterministic ordering tests.
6. **Manual QA**: full flow per §L — 5–8 cards, correct labels, all actions work, empty state when too few eligible recipes, mobile layout, keyboard operability.
7. **Acceptance criteria**: per §L.
8. **Risks**: low — additive UI only, no new domain mutations.
9. **Rollback**: remove the route/component.
10. **Cut scope**: swipe gesture (deferred by design, §L); Shortlist comparison view is the next thing to cut if needed, since Skip/View/Plan/Cook alone deliver the core value.
11. **Complexity**: Medium.

---

## N. Test Strategy

Following the existing `node:test` + `node:assert/strict` convention exclusively (no new framework):

- **Normalization** (`normalize.ts`): case, whitespace, diacritics, punctuation.
- **Exact aliases**: user-owned overrides global; global-only when no user override exists.
- **Multilingual aliases**: beras→rice_raw, nasi→rice_cooked, scallion/spring_onion→green_onion, all_purpose_flour/plain_flour→flour, etc.
- **Pluralization**: safe-only-when-independently-confirmed cases.
- **Ambiguous matches**: fixture asserts no global alias exists for any pair in §D's non-equivalence table.
- **False-positive prevention**: every §D non-equivalence pair as an explicit permanent regression test.
- **Cooked/raw, fresh/dried distinctions**: dedicated cases per pair.
- **Canonical assignment correction**: a `'confirmed'` row can be overwritten by a manual pick; the old assignment is fully replaced, not merged.
- **Owner isolation / RLS**: not automatable in `node:test` (no live DB) — documented as a manual dual-account SQL runbook, matching every prior checkpoint's convention exactly.
- **Readiness**: full existing 28-case regression + new canonical-priority/fallback cases (§I).
- **Shopping generation**: full existing regression + cross-language merge cases (§J).
- **Recommendation ranking**: weight application, exclusion rules, deterministic tie-breaking (never random).
- **Empty-state behavior**: too-few-eligible-recipes for both the dashboard recommendations section and Tonight's Deck.

---

## O. Deployment and Rollback

- **Migration application**: manual, via the Supabase SQL editor — this planning session and every implementation checkpoint's own session must never claim remote execution; each copy-paste implementation prompt (§Q for 3.1) explicitly requires manual application steps.
- **Generated type sync**: hand-maintained (§F) — no `supabase gen types` step exists in this project's workflow today; each checkpoint updates `types.ts` by hand, matching the existing style exactly.
- **Local verification**: `tsc`, targeted ESLint, `node --test`, `npm run build` — identical gate to every prior checkpoint this session.
- **Preview/production deployment**: standard existing Vercel + GitHub PR flow — no change to the deployment model itself.
- **Rollout order**: strictly 3.1 → 3.2 → 3.3 → (3.4, 3.5 in either order, both depending only on 3.3).
- **Feature flags**: **not introduced** — no feature-flag infrastructure exists anywhere in this codebase today, and building one from scratch solely for this wave would be over-engineering. 3.1 is inert-by-construction (nothing references it). From 3.3 onward, the canonical-first-with-automatic-fallback design **is** the safety mechanism — each ingredient/Kitchen-item pair independently either has a confirmed canonical match or falls back to today's exact behavior; there is no global on/off switch to build or maintain.
- **Rollback without losing display text**: guaranteed structurally — every proposed table/column is additive, and `display_name`/`ingredient_name`/`raw_text` are never written to by any part of this design, at any checkpoint.
- **Production smoke tests**: after 3.1, confirm the live app is completely unchanged (pure regression check) plus confirm the two new tables/seed data are queryable via the Supabase dashboard. After 3.3+, confirm a known test recipe's readiness label is unchanged unless it was deliberately canonicalized, and that a deliberately-canonicalized cross-language pair now merges correctly in Shopping Generation.
- **Monitoring/logging**: no new logging infrastructure needed for 3.1 (inert). From 3.2 onward, reuse the existing `devLog`-style dev-only diagnostic convention if any new server-side logic is added (none is currently anticipated, since assignment/correction is all client-direct Supabase calls).

---

## P. Decisions and Open Questions

**Recommended decisions** (recap): Option 3 hybrid catalog model (§B); nullable columns directly on `recipe_ingredients`/`kitchen_items`, not a separate assignment table, with the RPC-threading requirement called out explicitly (§C); global-alias ambiguity resolved by omission, never by one alias pointing at multiple canonical rows (§D); AI is not part of the first matching implementation (§D/§E); no feature-flag infrastructure — fallback-based rollout instead (§O); catalog seeding is SQL/migration-only indefinitely, no admin UI (§P below).

**Assumptions**: Supabase migrations continue to be applied manually by the project owner, exactly as every prior checkpoint this session; the hand-maintained `types.ts` workflow continues (no codegen step introduced); no CI pipeline exists to gate on (`node --test`/`tsc`/`build` remain locally-run checks, matching current practice).

**Unresolved product decisions requiring explicit approval before Checkpoint 3.1 begins:**
1. Should the bare word **"rice"** (no state qualifier) get its own seeded global alias at all, or should only qualified forms ("uncooked rice," "cooked rice," "white rice," etc.) be seeded, leaving bare "rice" to require user disambiguation on first encounter? **Recommendation: do not seed a bare "rice" global alias** — it's genuinely ambiguous even in English. This directly affects how "friction-free" the first-run experience feels and deserves explicit sign-off.
2. Should `shopping_list_items` eventually gain its own `canonical_ingredient_id` (propagated at generation time) to make purchase-to-Kitchen matching canonical-aware too (§J)? Not resolved by this plan — flagged as a real, additional scoped decision for whichever checkpoint takes it on.
3. Exact starter-catalog breadth for Checkpoint 3.1's seed data (this plan proposes ~15–20 canonical rows / 30–50 aliases covering every example term given in the brief — confirm this is the right initial scope, not too much or too little).
4. Exact recommendation score weights (§K) are illustrative — genuinely need product/UX judgment and, ideally, real usage data to tune; not meant to ship as permanently-fixed numbers.
5. Timing of swipe-gesture support for Tonight's Deck (§L) — recommended deferred past 3.5's initial button-driven ship, needs confirmation this is acceptable for the eventual full feature.

**Risks requiring explicit user approval**: the Checkpoint 3.2 RPC change (threading `canonical_ingredient_id` through `save_recipe_with_details`'s existing JSONB payload) is the single highest-risk step in the entire wave, since a mistake there could silently drop canonical assignments on every recipe save — flagged prominently in §C, §F, and Checkpoint 3.2's own risk entry, and should get focused review at that checkpoint's own PR, not just a passing mention here.

**Exact recommended implementation order / critical path**: 3.1 → 3.2 → 3.3 is the critical path — this is what actually fixes the false-missing-ingredient problem stated in the brief. 3.4 and 3.5 are valuable, separable extensions that depend on 3.3 but not on each other.

**Submission-safe cut line**: Wave 3 is explicitly post-submission/future-roadmap work (the graded course submission was already hardened and finalized in an earlier checkpoint this session) — there is no submission deadline pressure on this wave specifically. If only one checkpoint is ever delivered, **3.1 alone** still has standalone value (a real, tested, curated multilingual catalog, zero risk to the live app since nothing references it) and zero downside if paused there indefinitely. If two are delivered, **3.1 + 3.2** gives visible, demonstrable assignment/correction UX even without the readiness/shopping payoff. The problem statement's actual fix requires reaching **3.3**.

**Post-Wave-3 backlog** (explicitly out of scope for all five checkpoints above): admin UI for catalog curation (SQL-only is the deliberate v1 posture); canonical-match audit/history trail; AI-assisted suggestion as a real pipeline step; `shopping_list_items` canonical propagation (open question 2 above); swipe gestures for Tonight's Deck; unifying the five independent text-normalizers found in §A into one shared module (explicitly *not* required by this plan, since touching already-tested working code for pure cleanup is unjustified risk without a concrete driving need); `ingredient_state`-aware readiness nuance (e.g. a recipe explicitly requiring cooked rice shouldn't be marked ready by raw rice in Kitchen) — named as a real future refinement, deliberately not solved by this plan's fallback-based design.

---

## Q. Copy-Paste Implementation Prompt for Checkpoint 3.1 Only

```text
Read CLAUDE.md, AGENTS.md, docs/product/RecipeVault_Master_PRD_Implementation_Baseline_v1.3.html,
docs/product/SIMMERI_MASTER_BUILD_BRIEF.md, docs/SUBMISSION.md, and the Wave 3 plan at
docs/plans/WAVE_3_CANONICAL_INGREDIENTS_AND_RECOMMENDATIONS_PLAN.md in full
(sections A through Q), especially sections A, C ("canonical_ingredients" and
"ingredient_aliases" only — do not build the recipe_ingredients/kitchen_items
column work, that is Checkpoint 3.2), D, F, G, and the Checkpoint 3.1 entry
under section M.

Implement ONLY Checkpoint 3.1: Canonical catalog foundation.

Do not implement Checkpoint 3.2, 3.3, 3.4, or 3.5 in this session.

First, create and switch to a clean dedicated feature branch off the current
latest main (feat/canonical-ingredients-foundation) before making any
changes. Before doing so, verify the current branch and working tree are
clean and that the branch is based on the latest merged main — if any of
that is false, stop and report the exact problem instead of proceeding.

Treat the current repository, latest merged main, and current Supabase
schema as the source of truth. Before writing any code or migration,
inspect the actual current state of: supabase/migrations/ (every file, to
confirm no relevant schema has drifted from the plan's audit), src/integrations/supabase/types.ts,
src/lib/readiness.ts, src/lib/shopping-merge.ts, src/lib/kitchen-update-plan.ts,
and package.json, to confirm nothing has changed since the plan's audit
section A.

Scope for this checkpoint only, per the plan's sections C, F, G, and M:

1. One additive migration file, supabase/migrations/<timestamp>_canonical_ingredients.sql,
   creating exactly:
   - public.canonical_ingredients: id uuid PK default gen_random_uuid(),
     canonical_key text not null unique, canonical_name text not null,
     ingredient_state text null with the CHECK from section C,
     category text null, status text not null default 'active' with the
     CHECK from section C, merged_into_id uuid null references
     canonical_ingredients(id) on delete set null, created_at/updated_at
     timestamptz not null default now(), the shared update_updated_at_column
     trigger (reuse the existing function, do not redefine it), a
     canonical_ingredients_updated_at trigger, GRANT SELECT to authenticated
     and GRANT ALL to service_role (in that order, before ENABLE ROW LEVEL
     SECURITY), RLS enabled, and exactly one policy:
     canonical_ingredients_select_all FOR SELECT TO authenticated USING (true).
     Do not grant or create any INSERT/UPDATE/DELETE policy for authenticated
     on this table.
   - public.ingredient_aliases: id uuid PK default gen_random_uuid(),
     canonical_ingredient_id uuid not null references canonical_ingredients(id)
     on delete cascade, normalized_alias text not null, display_alias text
     not null, language_code text null, region_code text null, alias_type
     text not null default 'synonym' with the CHECK from section C,
     confidence real null with the CHECK from section C, review_status text
     not null default 'approved' with the CHECK from section C, source text
     not null default 'seed' with the CHECK from section C, owner_user_id
     uuid null references auth.users(id) on delete cascade, created_at/updated_at,
     the shared updated_at trigger, the two partial unique indexes and the
     plain btree index exactly as specified in section C, GRANT SELECT,
     INSERT, UPDATE, DELETE to authenticated and GRANT ALL to service_role,
     RLS enabled, and exactly four policies matching section G precisely:
     select using (owner_user_id is null or owner_user_id = auth.uid());
     insert with check (owner_user_id = auth.uid());
     update using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());
     delete using (owner_user_id = auth.uid()).
   - Seed data: INSERT statements (ON CONFLICT (canonical_key) DO NOTHING for
     canonical_ingredients; rely on the partial unique indexes with ON
     CONFLICT DO NOTHING for ingredient_aliases) covering every example term
     named in the plan's sections A/D: rice (raw and cooked as two separate
     canonical rows plus their beras/nasi aliases), egg/eggs, green onion
     (plus scallion/spring onion aliases), onion, garlic, flour (plain/all-purpose,
     kept separate from almond flour, which is its own canonical row with no
     alias linking it to generic flour), tomato (fresh, canned, and paste as
     three separate canonical rows, never aliased together), milk and coconut
     milk (separate), butter and margarine (separate, no alias linking them),
     onion powder and garlic powder (separate from onion/garlic). Do NOT seed
     a bare "rice" alias pointing at either the raw or cooked canonical row
     (see the plan's open question 1 in section P) — only seed qualified
     forms such as "uncooked rice"/"white rice"/uncooked-rice-language
     aliases pointing at the raw row, and "cooked rice"/"steamed rice"/
     cooked-rice-language aliases pointing at the cooked row. All seed rows
     use source='seed', review_status='approved', owner_user_id=NULL.

2. src/lib/ingredients/normalize.ts (+ .test.ts): a pure function
   normalizeForCanonicalMatch(text: string): string implementing exactly the
   normalization described in section D (trim, lowercase, collapse internal
   whitespace, strip diacritics via NFD + combining-mark removal, strip
   trailing punctuation). No dependencies, no DB access, no browser APIs —
   must run under `node --test` exactly like every other pure module in
   src/lib.

3. src/lib/ingredients/canonical-lookup.ts (+ .test.ts): a pure function
   (e.g. findCanonicalMatch(displayName, aliasRows)) that takes an ingredient
   display name and an already-fetched array of alias rows (shaped like
   ingredient_aliases: at minimum canonical_ingredient_id, normalized_alias,
   owner_user_id) and returns the matching canonical_ingredient_id (or null),
   preferring a user-owned alias hit over a global one when both exist, per
   section E steps 1-2. This function must not query Supabase itself — it is
   given the already-loaded alias rows as a plain array, matching the "pure,
   dependency-free module" convention used by every existing src/lib module
   (e.g. shopping-merge.ts, kitchen-update-plan.ts). Include test cases for
   every non-equivalence pair listed in the plan's section D (assert the
   fixture alias set never provides a path from one to the other) and for
   the user-alias-overrides-global-alias priority rule.

4. src/integrations/supabase/types.ts: add canonical_ingredients (inserted
   alphabetically before collection_recipes) and ingredient_aliases
   (inserted alphabetically between early_access_signups and kitchen_items)
   with full Row/Insert/Update/Relationships blocks, matching the exact
   style of every existing table entry in this file.

Do not add any canonical_ingredient_id, match_status, match_source,
match_confidence, or canonicalized_at column to recipe_ingredients or
kitchen_items — that is Checkpoint 3.2, explicitly out of scope here.
Do not modify save_recipe_with_details or generate_shopping_list_items.
Do not modify src/lib/readiness.ts, src/lib/shopping-generate.ts,
src/lib/shopping-merge.ts, or src/lib/kitchen-update-plan.ts.
Do not add any route, page, or UI component — this checkpoint is schema and
pure TypeScript only, referenced by nothing else in the running app.
Do not add pg_trgm, unaccent, or any other Postgres extension.
Do not add any npm dependency.
Do not apply the migration to the remote Supabase project yourself — create
the migration file locally only. Instead, produce the exact manual steps for
me to run it myself via the Supabase SQL editor (paste-and-run the migration
file's contents; then a short manual verification query list: confirm both
tables exist with the expected row counts from the seed data; confirm, as an
authenticated test user, that SELECT on both tables succeeds, that INSERT/
UPDATE/DELETE on canonical_ingredients fails, that INSERT of a private alias
(with owner_user_id set to that user's own id) succeeds, and that a second
test user cannot see the first user's private alias row).
Do not commit or push.
Do not begin Checkpoint 3.2, 3.3, 3.4, or 3.5.

Before editing, summarize the exact files you will create/modify (matching
this prompt's section above) and flag any deviation you intend to make, with
your reasoning.

Then implement, add node --test coverage for both new pure modules, and run
in order: npx tsc --noEmit -p tsconfig.json; targeted ESLint on every
changed/created file (report prettier/prettier CRLF findings separately from
any substantive finding); node --test on the two new test files; a full
existing pure-logic regression via node --test src/lib/*.test.ts
src/lib/media/*.test.ts src/lib/import/*.test.ts (must show zero
regressions — this checkpoint should not be able to break anything that
exists today); npm run build; git status --short; git diff --stat.

Report: exact files created/modified; the full migration SQL for review;
confirmation that RLS matches section G exactly (quote the policies);
confirmation that no existing table, RPC, or route was touched; test and
validation results; the exact manual Supabase SQL editor steps for me to run
(migration application + the verification query list above); remaining
limitations (the catalog is completely inert until Checkpoint 3.2; seed-data
breadth is intentionally limited per the plan's cut-scope guidance).

Stop after local implementation and validation. Do not proceed to
Checkpoint 3.2. Do not commit or push.
```
