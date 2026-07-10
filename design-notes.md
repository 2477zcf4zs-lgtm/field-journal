# Design notes for the Phase 5 design pass (§4 of the handoff)

Recorded 2026-07-10 from the user's aesthetic-reference photos. These refine,
not replace, §4 of `field-journal-phase5-handoff.md`.

## Naming (already applied in v0.6.1)
- App renamed **"Starling Field Journal"** (manifest `name`, `<title>`, topbar,
  Settings About). iOS home-screen label / manifest `short_name` is
  **"Starling"** — the full name truncates under a home-screen icon.

## App icon (§4.4 — updated motif)
- Motif is now a **European starling**, replacing the handoff's suggested
  banana slug / Steller's jay.
- Reference: a hand-colored engraving-style starling — dark iridescent body
  with pale speckling, yellow-orange bill, standing in sparse grass blades on
  a warm cream ground. Fine line work with light watercolor tinting.
- Keep §4.4 mechanics: 180/192/512 PNG, maskable-safe margins, replace
  placeholders in `icons/`, keep `sw.js` APP_SHELL paths in sync.

## Aesthetic direction from the three reference images
1. **Hand-colored engraved plate (starling)** — engraved line art carrying the
   form; color as restrained watercolor tint, not fill; generous cream
   negative space; subject grounded by a few sparse strokes (grass), no frame.
2. **"The Naturalist's Library" title page** — letterpress hierarchy:
   widely letterspaced small caps, thin double rules between title lines,
   centered stack, ample vertical whitespace; ornament limited to rules.
   Matches §4.2/§4.3 (small caps + letterspacing, double-rule borders).
3. **Specimen plate with Latin caption ("PALUMBI NIDUS et OVA")** — plate
   pages titled in letterspaced small caps above the illustration; muted
   natural palette (umber/olive/cream); off-white paper tone throughout.

## Takeaways to apply in §4
- Palette already matches (cream `--paper`, sepia inks); keep tint washes at
  or below current opacities.
- Plate captions could adopt the reference's centered small-caps-over-rule
  treatment; the existing `.plate-cap` is close.
- Color belongs in the illustration/wash zones only — the references show
  color exclusively inside the plate image, never in the chrome.
