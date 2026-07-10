# Field Journal — Handoff Spec: Phase 4 Fixes, Photo-First Entry, Phase 5

**For: Claude Code, fresh session, working directly in the GitHub repo**
**Current state: Phase 4 complete, deployed, `v0.5.0`**

---

## 1. Project context (read first — you have no prior session history)

This is a personal wildlife-sighting field journal PWA for one user (the developer's wife), hosted on GitHub Pages, installed to an iPhone home screen via Safari. Private, offline-first, no accounts, no server-side anything. All data lives in IndexedDB on the device; JSON export/import is the backup mechanism.

Two design pillars, both mandatory and in tension:
1. **Fast field entry** — logging a sighting must work one-handed outdoors in ~3 taps (species → spot → Save). Nothing may add friction to the entry flow.
2. **19th-century naturalist field journal aesthetic** — engraved-plate ink line-art, sepia tones, museum specimen labels — applied to *browsing* views only (species plates, almanac, summaries). Restrained and authentic, never kitschy. Watercolor appears only as light accents in sanctioned zones (field-notes pages, plate illustrations).

### Repo layout
- `index.html` — the entire app (~2,700 lines): app CSS, **vendored Leaflet 1.9.4 + Leaflet.markercluster CSS/JS inlined** (do not touch the vendored blocks; they exist so the app shell works fully offline), inline SVG icon sprite, HTML, and all app JS in one `<script>` at the bottom.
- `sw.js` — service worker. Precaches the shell with `{cache:'reload'}` requests; all cache lookups scoped to the current `CACHE_NAME` (both deliberate bug fixes — do not "simplify" them away); update banner flow via `SKIP_WAITING` message.
- `manifest.json`, `icons/` (icon-192, icon-512, apple-touch-icon).

### Hard conventions (violating these breaks the app)
- **Version sync:** every deploy bumps `CACHE_VERSION` in `sw.js` AND `APP_VERSION` in `index.html`, kept identical (e.g. `field-journal-v0.6.0` / `v0.6.0`). This drives the in-app update banner.
- **Vanilla JS only**, no build step, no runtime CDN. New vendor code (there should be none needed) would have to be inlined.
- **No `location` as a variable name** — it shadows `window.location`; a past bug. Locals are named `loc`.
- All user text through `esc()` before any `innerHTML`.
- Sheets: anything opening a sheet that holds resources (Leaflet mini-maps, object URLs) registers teardown via `sheetCleanup = () => {...}`; `openSheet`/`closeSheet` both run it. Never bypass this.
- Object URLs are tracked in per-context arrays and revoked (`photoUrls`, `journalPhotoUrls`, `detailPhotoUrls`, `zoomUrl`); follow the existing pattern for any new image rendering.
- Dates are local `YYYY-MM-DD` strings parsed with `parseLocal()` (component parsing, never `new Date(iso)` UTC pitfalls).
- Native `alert`/`confirm`/`prompt` are banned (unreliable in iOS standalone) — use `sheetPrompt` / the armed two-tap delete pattern.
- Photos: stored in IndexedDB as Blobs (`thumb` ~200px + `full` ~1280px JPEG), compressed client-side in `compressImage()` via createImageBitmap→canvas. Base64 only at the export/import boundary.
- Weather: Open-Meteo, keyless. Dates ≤7 days old (incl. today) use the **forecast API with `past_days=7`** (the archive API lags 2–5 days); older dates use the archive endpoint. Missing data ≠ a retry strike; only hard errors bump `weatherTries` (cap 6). After every `await`, records are re-found by id before mutation (`fetchWeatherFor` shows the pattern).
- Nominatim: ≥1.1s between requests (`processGeocodeQueue` paces with `sleep(1100)`).

### Deploy/test loop
Push to the repo → GitHub Pages redeploys → **wait ~10 minutes** (Pages CDN caches `sw.js` up to 600s) → open the installed app; update banner should appear (the app also calls `reg.update()` on visibilitychange). On-device testing is on a real iPhone.

---

## 2. Work item 1 — Phase 4 review fixes (do these first, as their own commit/pass)

### 2.1 Seasonal rollup pages (spec gap — implement)
`seasonKeyOf(y,m)` exists (~line 2647) with correct year-spanning winter logic (`"2026-2027-Winter"`) but is **never called**. Implement the seasonal rollups it was written for, in the Field Notes view (`renderFieldNotes`):
- After the last month of each completed season (i.e. when iterating months newest-first, insert the season page above its first-encountered month), render a season rollup page in the same `.notes-page` style: heading like "Winter 2026–27 — Season Notes", lead line with total sightings and species count across the season's three months, then 1–2 facts reusing the `monthFacts` fact types computed over the whole season's list (superlative species, firsts). Keep it shorter than monthly pages.
- Only render a rollup once the season is *complete* (current in-progress season gets no rollup yet).
- Deterministic phrasing seed: `y*17 + seasonIndex`.

### 2.2 Future-date guard
Two layers:
- Set `max` attribute on `#dateInput` to `todayLocal()` (set it in `renderLog` so it stays current across midnight), and clamp in its change handler.
- In `fetchWeatherFor`: if `daysBetweenLocal(dateISO, todayLocal()) < 0`, set `weatherPending=false`, delete `weatherTries`, `idbPut`, return. (Prevents pre-existing future-dated records from refetching forever.)

### 2.3 Field Notes performance
- At the top of `renderFieldNotes`, build one `Map(speciesId → sightings sorted asc by dateISO)` and pass it into `monthFacts`/`fieldNotePage` instead of calling `speciesSightings(id)` (full filter+sort of all sightings) per species per month.
- Render only the most recent 12 monthly pages (plus their season rollups); below them a "Show earlier months" button that renders the rest on tap.

### 2.4 Specimen list cap
In `openSpeciesPlate`, render at most 50 specimen cards; if more, append a "Show all N specimens" button that renders the remainder into the same container.

### 2.5 Nits (one small commit)
- `seededPick(arr, seed+id.length)` in `monthFacts`: UUID length is constant (36), so the per-species offset does nothing. Replace with a small char-code sum of the id (e.g. `id.split('').reduce((a,c)=>a+c.charCodeAt(0),0)`).
- Clamp both year pagers (`hmPrev/hmNext`, `fyPrev/fyNext`) to the range of `sightingYears()` (allow the current year even if empty); disable the button at the bound rather than hiding it.
- `renderHeatmap`: revoke the day-list thumbnail URLs it creates (they currently accumulate in `journalPhotoUrls` until the next Journal render — either call `revokeJournalPhotoUrls()` at the top of `renderHeatmap`, or give the almanac day list its own tracked array).
- OTD cards (`renderOnThisDay`): instead of opening the species plate of `items[0]` (arbitrary when the day had multiple species), route to the Almanac heatmap with that year selected and the day-list populated for that date (`almanac.view='heatmap'; almanac.year=y;` then render and invoke the day-list population for the date). Keep single-species days opening the plate if that's simpler — but multi-species days must not silently pick one.

### 2.6 Scale test (verify, don't ship broken)
Add the dev-only seed function from the original spec §16 if not present: behind a long-press (≥1.5s) on the version string in Settings, "Seed 500 test sightings" — random species/spots/dates across 3 years, some with counts/notes/timeOfDay — plus a matching "Delete seeded data" (tag seeded records with `seeded:true`). Then verify: journal scroll smooth, heatmap <1s, frequency instant, field notes (with 2.3 done) fast, plate with many specimens OK (with 2.4 done). Fix anything that isn't.

---

## 3. Work item 2 — Photo-first fast entry (EXIF)

**The scenario:** she's in a rush, takes photos with the Camera app, and logs the sighting later from her couch. The photo's own metadata should fill in *when* and *where*, so entry collapses to: add photo → tap species → Save. Weather, moon, and place-name backfill then all key off the EXIF-derived time/coords automatically through the existing enrichment pipeline — no new plumbing needed downstream.

### 3.1 Probe FIRST (before building the parser)
Whether GPS EXIF survives iOS's photo picker into a web file input is the one real unknown (Safari has historically preserved it for library picks, including through HEIC→JPEG transcode, but it varies by path and iOS version). Before building the feature:
- Add a temporary debug hook: long-press on the "Add photo(s)" button logs (to a visible toast or debug line) whether the selected file's first bytes contain an EXIF APP1 segment and whether GPS tags parse (a minimal date+GPS sniff, ~40 lines, is fine for the probe).
- The user tests with: (a) a real photo taken with the Camera app picked from the library — **this is the target path and must work**; (b) a photo captured live via the file input's "Take Photo" option (expected: no GPS — fine); (c) a screenshot (expected: no EXIF — fine).
- **Stop and report results before continuing.** If (a) fails on her device, the feature reduces to date/time-only pre-fill; the chip UX below still works, minus location.

### 3.2 EXIF parser (vanilla, inline, no library)
Parse from the **original `File` bytes, before compression** — `compressImage`'s canvas re-encode strips all metadata, so this must happen at the top of `addPhotos` on the raw file (read the first ~128KB via `file.slice().arrayBuffer()`; EXIF lives in the APP1 segment near the start).

Implement `parseExif(file) → {dateISO, exactTime, lat, lng} | null` (any field may be null):
- JPEG only: scan segments for APP1 with "Exif\0\0" header; parse the TIFF structure (handle both byte orders II/MM).
- IFD0 → ExifIFD pointer (0x8769) → `DateTimeOriginal` (0x9003, format `YYYY:MM:DD HH:MM:SS`) → `dateISO` + `exactTime` (HH:MM). Treat as local time as-is (EXIF time is camera-local; no TZ math).
- IFD0 → GPS IFD pointer (0x8825) → GPSLatitude/GPSLatitudeRef/GPSLongitude/GPSLongitudeRef (rational degrees/minutes/seconds → decimal, sign from N/S/E/W). Validate: finite, |lat|≤90, |lng|≤180, and not (0,0).
- Wrap the whole parse in try/catch → null. Malformed EXIF must never break photo attachment.

### 3.3 Chip UX — suggest, never clobber
The form pre-selects last-used spot and today's date, so "fill only empty fields" doesn't work and silent overwriting is worse. Instead:
- In `addPhotos`, parse EXIF from the **first** photo of the selection that yields data. If it produced at least a date or coords, AND (date differs from the form's current date OR coords are present), render a dismissible suggestion chip directly under `#photoThumbs`:
  > 📷 Taken **Jul 7, 6:42 AM**{, near **⟨placeName or "lat, lng"⟩**} — **Use** / ✕
- Tapping **Use** applies in one go: `dateISO`, `exactTime` (+ derive `timeOfDay` from the hour via the existing `currentTod`-style banding), and if coords present: `form.coords={lat,lng}`, `form.locKind='pin'`, `form.spotId=null`, `form.placeName=null`, then `renderLog()`. If online, kick the existing reverse-geocode to resolve the place name into the chip/place field (reuse the `useCurrentLocation` stale-guard pattern: only apply if `form.coords` still matches).
- ✕ dismisses; no EXIF → no chip; nothing else about the flow changes. Zero added friction when unused.
- Style the chip in-theme but plain (entry-flow rules apply: no washes, big tap targets). It clears on save/reset and when all photos are removed.
- Edit mode: show the chip too (same rules) — useful when attaching a photo to an existing entry — but never auto-apply.
- Multi-photo: first-with-EXIF wins for the chip. True batch entry (N photos → N sightings) is explicitly **out of scope**; do not build toward it beyond keeping `parseExif` a pure standalone function.

### 3.4 Remove the probe debug hook once the feature ships.

---

## 4. Work item 3 — Phase 5: full design pass

The final phase from the original spec. The app is functionally complete after items 1–2; this pass is aesthetics, polish, and accessibility. **Governing principle: restrained and authentic, never kitschy. If in doubt, remove ornament.** The entry form keeps the *simplest* treatment — palette and type yes, textures/washes/ornament no.

### 4.1 Icon set completion
- Audit the sprite: every default species should resolve to either a bespoke icon or an intentional shared silhouette. Target ~18–24 distinct engraved line-art icons + 6 category generics. Marquee species needing distinct, recognizable silhouettes: deer, coyote, bobcat, fox, raccoon, skunk, banana slug, Steller's jay, acorn woodpecker, red-tailed hawk, turkey, quail, owl, newt, fence lizard, monarch, redwood, madrone.
- Style: single-color stroke (`currentColor`), consistent ~1.5 stroke weight on the 28px grid, sparse hatching only where it aids recognition. Must read at 20px and scale to 120px+ (plate illustrations).
- Weather + moon glyphs already exist; match any additions to them.

### 4.2 Typography
- Self-host the serif: subset EB Garamond (regular + a small-caps-capable setup via `font-feature-settings`) to Latin basic, embed as base64 WOFF2 in the CSS (**keep total font payload under ~200KB** — this is a precached single file). No Google Fonts CDN (offline-first).
- Apply: headings, plate captions, specimen labels, notes-page prose, stat values. Form controls stay at the current highly-legible stack.
- "Hand-lettered" = small caps + letterspacing + layout, never a novelty script font.

### 4.3 Ornament & layout polish
- Double-rule borders and corner ticks on plates; fine 0.5–1px rules for hierarchy; no drop shadows anywhere.
- Specimen labels: verify they read like museum tags (small-caps header row, generous letterspacing).
- Watercolor: confirm it appears ONLY in the two sanctioned zones (notes-page background, plate illustration wash) and stays ≤ current opacities. Remove any that crept elsewhere.
- Empty states for every view, in-theme, each with a shortcut to the Log tab ("No sightings yet this year — the journal awaits.").
- Buttons: rectangular, thin ink border, pressed = ink fill/paper text; radius ≤4px. Audit stragglers.

### 4.4 App icon
Engraved-style motif — banana slug or Steller's jay in fine ink line on the cream paper color — generated at 180 (apple-touch-icon), 192, 512 PNG, maskable-safe margins. Replace the placeholders in `icons/` and keep `sw.js` APP_SHELL paths in sync (remember: a 404 in `addAll` kills the install).

### 4.5 Motion & accessibility audit
- Transitions ≤150ms; save confirmation may keep its stamp feel; respect `prefers-reduced-motion` (audit all animations, not just `.spin`).
- Touch targets ≥44px everywhere (audit: heatmap cells are exempt as a density display, but their tap targets can get an invisible padding hitbox if tapping proves fiddly on device).
- `aria-label` on all icon-only controls; visible focus states (ink outline); layout tolerates 120% text size.
- Bar-chart axis text: bump to ≥9 SVG units if the on-device squint test failed.

### 4.6 Final testing checklist (on-device, before calling it done)
1. Install → force-quit → relaunch: data intact. Airplane mode: full entry flow works; weather queues and backfills on reconnect with the correct hour.
2. 3-tap log with recent species + last-used spot.
3. Photo-first flow: Camera-app photo from library → chip appears with correct time/place → Use → save → weather matches the photo's hour, place name backfills.
4. Portrait + landscape photos upright in thumb, strip, zoom.
5. 500-sighting seed: journal scroll, heatmap, frequency, field notes, busy species plate all smooth.
6. Export full backup → wipe (Replace-import an empty-ish file or clear) → import restores everything including photos.
7. Update flow: bump versions, deploy, wait 10 min, banner appears, tap updates cleanly.
8. Back-swipe navigation correct in standalone mode; sheets always above the map; day headers visible below topbar+filter bar while stuck.

---

## 5. Sequencing & commit discipline

1. **Commit/pass 1:** §2 fixes (2.1–2.5), version bump, deploy, quick on-device check.
2. **Commit/pass 2:** §3.1 probe only → **stop and report probe results to the user** → then §3.2–3.4 on confirmation.
3. **Commit/pass 3+:** §4 design pass, ideally split (icons / typography / polish+icon / a11y) so regressions bisect easily.
4. Every deploy: bump both version constants in lockstep. Never `skipWaiting` on install; the update banner flow is deliberate.
