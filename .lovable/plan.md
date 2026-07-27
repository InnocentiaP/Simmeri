## Fix broken mascot crops on Simmeri landing

The `SimiSpot` component crops character-sheet PNGs by percentage, which leaks neighbouring cells ("In-App Us…", "age Ideas", "Peeki the…", "cook!", etc.) into every place a mascot appears. The user has now supplied three clean transparent assets that replace the need for any crop math:

- `Simmeri_Logo-2.png` — wordmark + Simi in a pot (for navbar/footer branding)
- `Simi_Official_Fullbody_Transparent.png-2.png` — full body Simi with spoon + "My Recipes"
- `Simi_Official_Head_Transparent.png-2.png` — head sticker (small spots, chips, form states)

No section rebuild — just swap asset sources, delete the crop system, and replace two "mascot-in-a-frame" panels with coded UI that actually shows the product.

### Assets to register first (via `lovable-assets`)
- `src/assets/simi-logo.png.asset.json` ← `Simmeri_Logo-2.png`
- `src/assets/simi-fullbody.png.asset.json` ← `Simi_Official_Fullbody_Transparent.png-2.png`
- `src/assets/simi-head.png.asset.json` ← `Simi_Official_Head_Transparent.png-2.png`
- Regenerate `public/favicon.png` from the new head sticker (tight square crop).
- Keep existing `simi-hero.png` pointer (already the correct full-body art) — use the new fullbody asset as the canonical replacement and retire `simi-hero`, `simi-sheet`, `simi-usage` pointers at the end.

### Component-by-component changes

**`SimiSpot.tsx`** — Delete the crop-math version. Replace with a tiny component that just renders the head-sticker PNG at a given size with an `alt`. All existing `pose="…"` props become ignored (single art, kept as an optional label). This alone fixes every circled crop in Hero helper bubble, Problems arrow row, Planning helper, TonightsDeck peek, Footer, FinalCTA, EarlyAccessForm state icons, Navbar mark.

**`Navbar.tsx`** — Replace the cropped head with the head-sticker asset at 28px next to the wordmark. Circled in hero screenshot.

**`Hero.tsx`** — Two fixes: (1) the small helper-bubble avatar becomes the head sticker via the new `SimiSpot`; (2) the big overlapping mascot (currently `simi-hero.png`) switches to `simi-fullbody` so it matches the official art and sits transparent over the mock. Keep composition, chips, dashboard card as-is.

**`Problems.tsx`** — The "concerned → checking recipes" collage in the screenshot pulls two garbage crops from the sheet. Replace with a coded before/after mini-illustration: a messy stack of paper cards (rotated, olive/cream, "linked recipe", "screenshot", "text note") arrow-transitioning into a single tidy `paper-card` list. No mascot art in the middle. Head sticker can sit small at the corner.

**`HowItWorks.tsx`** — All four cards currently show cropped character-sheet cells (circled). Replace each square panel with a **coded product vignette** matching the step, not a mascot portrait:
- 01 Capture: a small "paste a link" input row + parsed recipe chip
- 02 Kitchen: 3 inventory rows with Good / Running low / Out chips (matches Meal Planning right panel style)
- 03 Deck: a mini stacked-cards preview (reuse TonightsDeck card styles at small size)
- 04 Plan/Shop: mini 7-day strip with 2 slots filled + a "3 items to buy" chip
Add a small head sticker (real asset) in each corner as a signature, not as the main visual.

**`TonightsDeck.tsx`** — The card visual is fine structurally, but the "Simi peeking" crop is broken. Swap to the fullbody sticker peeking from behind the top card at a small size and rotation. Keep dark cocoa panel, stacked cards, swipe icons.

**`Planning.tsx`** — The "This week" panel and Kitchen panel are already coded UI and look correct — preserve them. Only the tiny Simi helper thumbnail inside the "3 items to buy" note is a bad crop; swap to the head sticker at ~40px. No layout change.

**`Trust.tsx`** — The big left panel currently shows a random slice of the usage sheet (circled). Replace with a coded "privacy card": a small phone-frame mock (reuse styles) showing a lock chip, an "Export data" button row, and one Simi head sticker in the corner. No character-sheet crops.

**`FinalCTA.tsx` / `EarlyAccessForm.tsx`** — Replace the mascot art with `simi-fullbody`; keep form logic, success/error states, Cloud insert. State icons switch to the head sticker.

**`Footer.tsx`** — Swap cropped "sleepy Simi" for the head sticker at 24px next to the wordmark.

**Pricing** — Not currently in the page. Out of scope for this pass unless the user wants it added; call it out at the end.

### Preserve unchanged
`Journey.tsx`, `Features.tsx` (bento), `UseCases.tsx`, `Benefits.tsx`, `WhoFor.tsx`, `FAQ.tsx`, `src/routes/index.tsx`, `src/styles.css`, `src/routes/__root.tsx`, and the `early_access_signups` migration.

### Cleanup after swap
Delete `src/assets/simi-sheet.png.asset.json` and `src/assets/simi-usage.png.asset.json` (and their CDN objects via `lovable-assets delete`) once no component references them. `simi-hero` gets retired in favor of `simi-fullbody`.

### Out of scope
- Pricing section (not built yet — flag for a follow-up).
- Any copy/section-order changes.
- Auth / real product screens.