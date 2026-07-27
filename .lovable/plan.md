## Simmeri Landing Page + Early Access Capture

A cozy, editorial marketing page for Simmeri ("Your cozy cooking companion") starring Simi the Kitchen Ducky, with a working "Join the Early Access" form backed by Lovable Cloud.

### Visual system (from brief)
- Palette: warm cream `#F7F0E3`, warm white `#FFFDF8`, deep olive `#485226`, olive `#6F7B3A`, sage `#A9B884`, caramel `#B77A45`, terracotta `#C86F4A`, cocoa `#6E4937`, Simi yellow `#FFD66B`, text browns `#4A372D` / `#7B6A5F`, border `#DDCDB8`. All tokens land in `src/styles.css` as OKLCH semantic variables (background, foreground, primary=deep olive, secondary=cream, accent=caramel, destructive=terracotta, etc.) plus custom brand tokens for sage/cocoa/simi-yellow/border-beige and gradient/shadow tokens (`--shadow-cozy`, `--gradient-cream`).
- Type: Fraunces (headings) + DM Sans (body), Caveat for small handwritten annotations only. Loaded via `<link>` in `__root.tsx` head.
- Motifs: rounded organic shapes, layered paper cards, soft shadows, hand-drawn leaves/steam/sparkles, generous whitespace. Subtle scroll reveals and hovers with Motion for React; respect `prefers-reduced-motion`.

### Assets
- Register the three uploaded images as Lovable Assets so they're served from CDN (not copied into the repo):
  - `Simi.png` (character sheet — used cropped for expressions/pose spots)
  - `Simi2.png` (in-app usage panels — reused in Product Preview / How It Works)
  - `ChatGPT_Image_...png` (hero full-body Simi with spoon + "My Recipes")
- Favicon: derive a small square PNG from the hero Simi via `imagegen--edit_image`, place in `public/favicon.png`, wire in `__root.tsx`, delete default `public/favicon.ico`.
- Generate a couple of supplementary illustration spots (soft leaf/steam SVGs inline, plus one warm dish photo via `imagegen--generate_image` for the "Remember" section) — kept minimal.

### Page structure (single route: `src/routes/index.tsx`, replacing placeholder)
Sections built as small components under `src/components/landing/`:
1. `Navbar` — sticky, translucent cream, wordmark + tiny Simi head, center links (Features, How It Works, Tonight's Deck, Meal Planning, FAQ), Log In (ghost) + Start Cooking (primary olive).
2. `Hero` — 2-col: eyebrow + "Turn saved recipes into meals you'll actually cook." + supporting copy + CTAs (Start Cooking with Simi / See How It Works) + trust microcopy. Right: layered dashboard mock card with greeting "Good evening, Maya.", Ready-to-Cook / Almost Ready chips, Simi helper bubble, floating recipe cards, hero Simi PNG overlapping. Organic sage blob behind.
3. `UserProblems` — heading "Your recipes are saved. Dinner is still undecided." + 4 problem cards (Scattered / Decision Fatigue / Forgotten Ingredients / Disconnected Planning) with small icons; Simi holding overflowing papers on one side transitioning to organized notebook.
4. `ValueProp` — Capture → Review → Decide → Plan → Shop → Cook → Remember timeline (horizontal on desktop, vertical on mobile) with icons and one-liners; highlighted quote "Simmeri helps you make cooking decisions—not just collect more recipes."
5. `CoreFeatures` — bento grid of 6 features (Recipe Library, Kitchen Inventory, Tonight's Deck, Meal Plan, Shopping List, Cooking History) mixing sizes.
6. `HowItWorks` — numbered 4-step editorial rows with alternating image/text (uses cropped Simi2 panels).
7. `ProductPreview` — split: mobile mockup (Tonight's Deck card) + tablet mockup (Kitchen inventory list) built in JSX using tokens.
8. `TonightsDeck` — dark cocoa panel: 3 stacked recipe cards with swipe-style controls (X / star / heart), Simi peeking from behind.
9. `UseCases` — 4 short scenarios (Weeknight solo, Family week, Empty-fridge night, Rediscovery).
10. `Benefits` — 6 short benefits in soft cards.
11. `TrustControl` — Simi with checklist; bullets on private data, no ads, export anytime.
12. `WhoItIsFor` — chips: Students, Professionals, Couples, Families, Casual cooks.
13. `FAQ` — shadcn Accordion, 6–8 items.
14. `FinalCTA` — full-body Simi + `EarlyAccessForm` (email input + "Join the Early Access" button + success state with Simi "Proud" pose).
15. `Footer` — cocoa background, wordmark, small links, copyright, tiny sleepy Simi.

### Early access capture (Lovable Cloud)
- Enable Lovable Cloud (Supabase under the hood).
- Migration creates `public.early_access_signups`:

  ```text
  id uuid pk default gen_random_uuid()
  email citext not null unique
  source text default 'landing_final_cta'
  created_at timestamptz default now()
  ```

  RLS enabled. Grants: `GRANT INSERT ON public.early_access_signups TO anon, authenticated;` and `GRANT ALL TO service_role;` — no SELECT to anon/authenticated (list stays private). Policy: `create policy "anyone can join early access" for insert to anon, authenticated with check (true);`
- Client submission goes through the generated browser Supabase client (`@/integrations/supabase/client`) directly from `EarlyAccessForm` — a simple insert with duplicate-email graceful message ("You're already on the list — Simi remembers you 🧡"). Zod validates the email before submit. Loading, success, and error states use Simi expressions from the sprite sheet.
- No auth flow, no login page — CTAs that say "Log In" / "Start Cooking with Simi" scroll to the early-access form for now (documented as such).

### SEO / head
- Update `index.tsx` `head()`: title "Simmeri — Your cozy cooking companion", description from brief, `og:type=website`, `twitter:card=summary_large_image`. No `og:image` (hosting supplies screenshot).
- Single H1 in Hero. Semantic `<section>` + `aria-labelledby`. Alt text on all Simi imagery describing pose. Respects reduced motion.

### Motion
- Install `motion` (Motion for React). Subtle: fade+rise on section reveal (IntersectionObserver), Simi gentle bob in hero (2s ease-in-out infinite), steam SVG rising loop, hover lift on cards. All guarded by `useReducedMotion`.

### Files touched
- `src/styles.css` — palette tokens, gradients, shadows, radius, custom utility for paper texture.
- `src/routes/__root.tsx` — Google Fonts `<link>`, favicon link, meta cleanup (leave og:image off root).
- `src/routes/index.tsx` — real landing page + head().
- `src/components/landing/*.tsx` — Navbar, Hero, UserProblems, ValueProp, CoreFeatures, HowItWorks, ProductPreview, TonightsDeck, UseCases, Benefits, TrustControl, WhoItIsFor, FAQ, FinalCTA, EarlyAccessForm, Footer, plus small `SimiSpot` helper for cropped mascot poses.
- `src/assets/*.asset.json` — pointers for the three uploaded mascot images.
- `public/favicon.png` (new), remove `public/favicon.ico`.
- Cloud migration file for `early_access_signups`.

### Out of scope (say so at the end)
- Auth / real Log In flow.
- Actual product app screens (Kitchen, Deck, Plan) beyond marketing mockups.
- Admin view of collected emails — visible in Cloud → Tables.
