# VihuPlanet CHANGELOG

All notable changes to the VihuPlanet MEP are recorded here.

## v0.4.3 — 2026-07-03

- **Documentation Sprint — Hero MEP Canon Consolidation.**
  Documentation only — no implementation, asset, behaviour, or
  architecture change.
- **New `HERO_CANON.md`.** The repository's single authoritative
  record of Hero philosophy and locked product decisions: Hero
  philosophy, purpose, Story World canon, World naming, Dreaming Realm
  canon (+ current implementation status), Hero composition hierarchy,
  atmosphere philosophy, Story Meadow canon, Discovery Telescope
  canon, performance philosophy (*"Stillness is the default. Magic is
  earned through interaction."*), asset philosophy (permanent vs.
  atmospheric elements), World Library canon, and design principles.
  Consolidates canon that was previously split across `README.md`'s
  and `BUILD.md`'s separate, drifting "Canon (immutable)" lists, plus
  a language-canon rule that existed only inside the Chapter 2 evidence
  packet — all now live in one place, cross-referenced rather than
  duplicated.
- **New `world-library/README.md`.** Closed a dangling reference —
  `README.md`, `BUILD.md`, and this changelog have linked to
  `world-library/README.md` since MEP-01 (v0.3.6) but the file never
  existed. Documents the actual pipeline (verified against the current
  `vihuplanet-world-library` source: fully automatic, recursive
  normalization — no `COLLECTIONS` list to maintain, any file under
  `raw/<collection>/` syncs and gets a `manifest.json` with zero code
  change), the artist workflow for existing vs. brand-new collection
  types, session-varied collections, the `FILE_FILTERS` exclusion
  mechanism, and a current collection snapshot.
- **`README.md` and `BUILD.md` de-duplicated.** Both files' own
  "Canon (immutable)" lists — which had quietly drifted apart (one
  said "Home Planet", the other didn't; neither mentioned Story
  Worlds, Dreaming Homes plural, or the language canon) — are replaced
  with a pointer to `HERO_CANON.md`. `BUILD.md`'s Completed / Upcoming
  lists are replaced with a Completed / In Progress / Future status
  reflecting actual current state, including moving **Story Meadow
  implementation to Completed** (it now has real production art,
  session-varied, path/sizing corrected — v0.4.0/v0.4.1 — so listing
  it as not-yet-done would itself be outdated documentation).
- **Stale references removed.** `README.md`'s structure tree dropped
  `hero/hero.css` (removed from the repo in v0.3.6.2; the directory is
  gone) and gained `artDirection/illustrationRules.js`,
  `js/buildInfo.js`, and `HERO_CANON.md`, none of which were
  previously listed. `assets/avatars/` (orphaned SVGs from the retired
  v0.2.0 storyteller-card module) is now called out as unused rather
  than left unexplained. The WorldMotion category list dropped
  `.glide` (removed in v0.3.8) and added the Chapter 2 / Sprint 2/3
  motions it was missing (`sleeping`, `breathing`, `listening`,
  `orbit`, `planet-drift`, `sway`, `shadow-breathe`, `shimmer`,
  `wander`, `select-pulse`). `BUILD.md`'s deferred-enhancement note for
  Organic Motion updated — `sway` shipped in Sprint 2 and is in
  production use; only `breeze`/`bloom` remain deferred.
- **No code, asset, or behaviour changes.** Verified by diff — every
  change in this release touches only `.md` files (plus the routine
  `build-info.json` bump in the following commit).

## v0.4.2 — 2026-07-03

- **Hero MEP Sprint — Dreaming Realm Implementation.** Replaces the
  temporary purple Dreaming Planet artwork with the production
  Dreaming Home assets. Implementation only — the Dreaming Planet
  engine (state machine, wake sequence, companion logic, CSS
  transitions, interaction handlers) is untouched.
- **Production art layered behind the existing SVG, not swapped in.**
  `assets/planets/dreaming.svg` gained a `<clipPath>` (reusing the
  landmass path's own silhouette) and an empty `<image class="dp-art">`
  sitting between the landmass's gradient fill and the dwelling/
  companion/mist groups. `dreamingPlanetManager.js` resolves a World
  Library `dreaming-home` asset after inserting the SVG and sets that
  `<image>`'s `href` — every eye/mouth/window/companion animation hook
  is the exact element it always was, now with production art showing
  through the same organic silhouette instead of a flat purple
  gradient. If the World Library has nothing to resolve, `.dp-art`
  stays empty and the original gradient fallback shows through
  unchanged — zero risk if resolution fails.
- **Three canonical Dreaming Homes, session-varied.** `dreaming-home`
  joins `sky` / `cloud` / `story-meadow` in `worldLibrary.js`'s
  `SESSION_VARIED_TYPES` — one of the three `dreaming-world-0N.png`
  homes is chosen once per browser session and holds steady across
  reloads. A new `FILE_FILTERS` map (`dreaming-home` →
  `/^dreaming-world-\d+\.png$/i`) excludes the World Library's
  now-superseded single `dreaming_home.png` from selection without
  deleting it — the World Library's content stays untouched, filtering
  happens client-side only.
- **Verified in headless Chromium:** production art renders inside the
  planet's mist correctly (no console errors); same-tab reload keeps
  the chosen home identical while fresh sessions vary it; the full
  wake sequence (stirring → waking → looking → smiling → speaking →
  chosen) and all three companion choices (yes / already have a planet
  / maybe later, including the later→resting→sleeping return) fire
  exactly as before; Hero composition and layout unchanged.

## v0.4.1 — 2026-07-03

- **Story Meadow art landed — path + sizing fix.** `nature/story-
  meadows/` synced from the World Library with real art mid-sprint,
  revealing two bugs in the placeholder wiring from v0.4.0:
  - `worldLibrary.js`'s `FOLDERS` map pointed at
    `world-library/story-meadows/` (top level); the real folder is
    nested under `nature/`, matching every other nature asset
    (clouds, flowers, rocks, trees, waterfalls). Corrected to
    `world-library/nature/story-meadows/`.
  - The registered `height` went through three iterations once real
    art existed to size against: the source art is a square
    (2048×2048) canvas with the panorama in a horizontal band
    (content ~y:405–1644), so an aspect-matched height (`60.5vw`)
    seemed correct but at typical viewport sizes covered nearly the
    entire Hero. A `22vh` reduction fixed that but then visually
    sliced across the telescope's silhouette, because `.foreground`
    (z-index 5) always paints above `.ground` regardless of any
    z-index set *within* foreground — a cross-stacking-context
    limitation, not fixable by z-index tuning, and restructuring
    layers is out of scope. Settled on `7vh`, deliberately kept under
    the telescope's `bottom: 8vh` placement so the meadow's box never
    reaches its footprint. `scene.css` gained the same `height: 100%
    ; object-fit: cover` override on the meadow's `<img>` already
    used for Story Path, since the shared `.world-object img { height
    : auto }` rule otherwise leaves `object-fit: cover` nothing to
    crop.
  - Verified in headless Chromium: telescope renders with its full
    tripod visible, no console errors, meadow image loads from the
    corrected path.

## v0.4.0 — 2026-07-03

- **Hero MEP Sprint — Atmosphere & World Identity.** Polish only —
  no layout redesign, no Hero architecture change, no World Library
  infrastructure change, no new navigation/UI. Completes the Hero MEP.
- **World Name is now the only visible Story World label.** Sprint ·
  Story World Identity's "dreamed by &lt;storytellerName&gt;" line is
  retired — `storytellerName` and `teaser` stay on the
  `planetsData.js` descriptor for possible future use, but the Hero
  never renders or announces them (no aria-label fallback either, so
  sighted and screen-reader experiences match). `.story-world-
  dreamed-by` removed from `planets.css` as dead code.
- **Story Trail toned down.** `.shimmer`'s opacity range dropped from
  0.7–0.92 to 0.3–0.5, the wrapper shrank (90vw×40vw → 78vw×35vw,
  same aspect so the World Library art's cover-crop still lands
  correctly), and a `saturate(0.7)` filter softens the real PNG
  asset. The SVG fallback's stroke thinned (2.2 → 1.3) and its
  stardust sparkles shrank and faded. The trail now reads as a faint
  trace, not competing with the Story Worlds.
- **Story Seed untouched** — still 30px, still the same `.wander`
  motion, per the sprint's explicit "do not enlarge, do not add
  attention-grabbing animation."
- **Story Meadow support added.** New `'story-meadow':
  'world-library/story-meadows/'` entry in `worldLibrary.js`'s
  `FOLDERS` map, and a `story-meadow` `WorldObject` registered in the
  `foreground` layer with **no local SVG fallback** — this required a
  small, backward-compatible addition to `worldObject.js`:
  descriptors may now omit `assetHref` entirely, and if the World
  Library has nothing for that type either, the object simply doesn't
  mount (every existing descriptor still declares `assetHref`, so
  this changes nothing for them). An empty `story-meadows/` folder
  today means today's foreground (Story Worlds + Dreaming Planet)
  stands exactly as it always has; the object is kept explicitly
  behind them (`z-index: 0`, vs. `.storyteller-planet`'s 4 and
  `.dreaming-planet`'s 6) so it can never cover them once real art
  exists.
- **Hero Composition Engine.** `sky`, `cloud`, and `story-meadow` now
  vary once per browser session: the first `resolveAt()` call for one
  of those types picks a random offset (0–996) and persists it to
  `sessionStorage`, so every later call — this page load or a
  refresh/navigation within the same tab — reuses the same offset.
  Every other type (Story Worlds' `story-home`, `telescope`, `trail`,
  `seed`, etc.) is untouched, resolving exactly as deterministically
  as before. Verified: reloading the same tab reproduces the same sky
  + cloud selection; a fresh browser context picks a genuinely
  different one (confirmed distinct sky image and all 4 cloud images
  differing between two real test runs).
- **Verified in headless Chromium:** same-session reload keeps the
  chosen sky/clouds identical; a fresh session picks different ones;
  Story Meadow renders nothing (graceful 404 on its manifest, no
  console errors) since no assets exist yet; World Name is the only
  text shown per Story World; Story Path's computed opacity sits in
  the new lower range with the softening filter applied; Story Seed's
  size is unchanged; `prefers-reduced-motion` still disables every
  animation.

## v0.3.9 — 2026-07-03

- **Hero MEP Sprint — Story World Identity.** The Hero presents
  Story Worlds now, not user profiles. Story World identity only —
  no layout redesign, no World Library changes.
- **Celestial disc removed.** The large sun/moon circle behind
  Vihaan's island (`moon` in `registry.js`, `assets/objects/
  moon.svg`) had no defined role, competed with the Dreaming Planet,
  and made one Story World read as more important than the others.
  Removed outright, not replaced — the sky breathes on its own now.
  The `.breathe` motion stays in the shared vocabulary (it's
  generically named, not moon-specific, same call as `.sail` in
  Sprint 3); the purely-descriptive `--vp-moon` constant (never
  referenced via `var()`) is gone with the object it described.
- **Story World naming.** `planetsData.js`'s four planets gained
  `worldName` (Dragon Valley, Starlight Meadow, The Painted Sky,
  Frostsong Cove) alongside the renamed `storytellerName` (was
  `name`). Every Story World now displays its World Name and
  "dreamed by &lt;storytellerName&gt;" — locked wording, sentence
  case exactly as written, never "Created by" / "Made by" / "Author"
  / etc. Pure typography: no card, background, badge, signboard,
  ribbon, or speech bubble. Elegant storybook font (Caveat), warm
  cream color, ~76–82% opacity, small text-shadow for readability,
  and a tiny per-planet rotation (deterministic hash of the planet
  id, not random) so the row reads hand-set rather than mechanical.
  `teaser` stays on the descriptor but is no longer displayed — only
  worldName and "dreamed by" ever render on the Hero.
- **Fixed a real, reproducible bug found verifying this sprint:**
  `WorldObject.mount()` resolves + appends each sky-layer object on
  its own independent Promise, so objects land in the DOM in
  whichever order their fetches finish — not registry order. Clouds
  and stars never declared a `z-index` (auto), the same stacking tier
  as Story Path's explicit `0`, ordered by DOM position for ties —
  so on roughly half of page loads Story Path happened to mount
  before the clouds and rendered fully hidden behind them; the real
  synced sky background (`watercolor-sky-image`) had the identical
  race against the whole sky-object stack, and being full-coverage
  could hide everything. Confirmed via 5+ repeated fresh loads
  showing genuinely different DOM orders and, before the fix,
  inconsistent visibility. Fixed with an explicit, deterministic
  z-index scale for the whole `.sky` stacking context (gradient
  wash → sky photo → Story Path → clouds/stars → Story Seed),
  independent of mount order. Verified across 5+ repeated fresh
  loads post-fix.
- **Improved label legibility over the pale open sky** (found in the
  same verification pass): a single soft text-shadow read fine over
  the darker cloud regions but nearly vanished over paler sky — the
  Hero's watercolor sky varies enough in tone that no single shadow
  works everywhere. Layered a tight, closer-to-opaque shadow for edge
  definition with the original soft, wide one for glow.

## v0.3.8.2 — 2026-07-03

- **Story Path and Story Seed wired to World Library.** New
  `'trail': 'world-library/trails/'` and `'seed': 'world-library/
  seeds/'` entries in `worldLibrary.js`'s `FOLDERS` map +
  `libraryType` on both registry descriptors. SVGs remain the
  fallback.
- **Fixed a real height/crop bug found while wiring the trail.** The
  World Library trail art is a square canvas with the painted band
  centered vertically inside it, not a wide banner — the shared
  `.world-object img { height: auto }` rule ignores a wrapper's
  explicit `height` entirely (sizes off the image's own intrinsic
  ratio instead), so `object-fit: cover` had nothing to crop and the
  art rendered as a full square instead of the intended horizontal
  band. Fixed with a targeted `[data-object-id="story-path"] img
  { height: 100%; object-fit: cover; }` override — only affects this
  one `<img>`, doesn't touch the shared rule other objects rely on,
  and doesn't affect the inline SVG fallback (`object-fit` doesn't
  apply to it). Story Path placement adjusted to `90vw × 40vw`
  (≈2048:919, the art's own width-to-content-band ratio) so the crop
  window lands exactly on the painted trail.
- **Story Seed needed no such fix** — its World Library art is a
  compact portrait teardrop already centered in its square canvas, so
  the default `object-fit: contain` frames it correctly at the
  existing 30px size.
- **Telescope wired the same session** (see previous entry) — worth
  noting together since both were artist-supplied World Library
  additions discovered and wired live, not planned sprint work.
- Verified in headless Chromium: real artwork renders for all three
  (telescope, trail, seed) at the correct crop/size, reduced-motion
  still disables their animations, zero non-OK network responses.

## v0.3.8.1 — 2026-07-03

- **Telescope wired to World Library.** New `'telescope':
  'world-library/telescope/'` entry in `worldLibrary.js`'s `FOLDERS`
  map + `libraryType: 'telescope'` on the registry descriptor — same
  pattern as every other MEP-01 object. An artist-supplied
  `telescope.png` now renders in place of the hand-drawn SVG; the SVG
  remains the fallback if the folder is ever empty again. No other
  change — placement, `shadow-breathe` motion, and non-interactivity
  are untouched.

## v0.3.8 — 2026-07-03

- **Hero MEP Sprint 3 — Story Path & Hero Personality.** Replaces the
  rocket and paper plane with a Story Path + Story Seed. Hero-only —
  no infrastructure, World Library, or architecture changes.
- **Rocket removed.** Descriptor, `assets/objects/rocket.svg`, and
  the now-dead `--vp-rocket` palette constant (never referenced via
  `var()`, purely descriptive) are gone.
- **Paper plane removed.** Descriptor and `assets/objects/
  paper-plane.svg` are gone.
- **`.glide` motion removed.** Its own doc comment named it "rocket +
  paper plane" — with both objects gone it was genuinely dead code.
  `.sail` (a distinct, always-forward-looking Journey primitive never
  used by either object) is untouched.
- **Story Path added.** A single wandering trail across the sky
  (`assets/objects/story-path.svg`) — a hand-drawn dashed line with
  an irregular dot-dot-gap rhythm and a gradient stroke that fades to
  nothing at both ends, so it never appears to begin or end at a
  fixed point and never reads as a route between Story Worlds. Wired
  to `libraryType: 'decoration'` (World Library integration, same
  pattern as every other MEP-01 object) — falls back to the SVG since
  `world-library/decorations/` has nothing yet. New `.shimmer` motion
  (Living) gives it a very slow opacity pulse; sits at `z-index: 0`,
  behind clouds, so it reads as a distant backdrop trail.
- **Story Seed added.** One small glowing seed of light
  (`assets/objects/story-seed.svg`) wandering the sky. New `.wander`
  motion (Living) — a single ~2.4-minute irregular loop with two
  brief holds baked into the keyframe stops (not a mechanical
  back-and-forth) combining translate, a whisper-subtle scale, and a
  glow pulse. Sits at `z-index: 3`, the tier the rocket/paper plane
  previously used.
- **Composition preserved.** Story Worlds, Dreaming Planet, telescope,
  clouds, and flowers keep their existing positions and motions —
  only the rocket/paper-plane slot changed.
- **`prefers-reduced-motion` respected** — `.shimmer` and `.wander`
  added to the existing disable block; `.glide` removed from it since
  the class no longer exists.
- **Verified in headless Chromium**: rocket/paper-plane elements
  absent, `story-path.svg`/`story-seed.svg` load (200), old assets
  404, Story Path/Seed carry the correct animation names, both motions
  cleanly disable under reduced motion, dev build indicator still
  renders, and no new console errors (the only non-OK network
  responses are graceful World Library manifest-miss fallbacks).

## v0.3.7 — 2026-07-03

- **Hero MEP Sprint 2 — Living World.** Subtle environmental motion
  only — no redesign, no new navigation, no new features. Nothing
  should read as animated on first paint; the world should only feel
  alive after watching quietly for a few seconds.
- **Cloud drift gains vertical variation.** `vp-drift` (`animations/
  motion.css`) now arcs through a per-cloud `--vp-drift-y` custom
  property at its midpoint instead of a flat horizontal line; each of
  the four clouds gets a different value (`registry.js`) on top of
  their already-different durations, so the sky doesn't read as four
  clouds on one rail.
- **Storyteller planets gently breathe.** `vp-planet-drift` now adds
  a sub-1° rotation (±0.6deg) alongside its existing tiny
  translate — islands read as floating, not just sliding. Positions,
  per-planet durations, and phase offsets (`planetsData.js`) are
  unchanged.
- **Dreaming Planet glow, no scaling.** `vp-breathing` dropped its
  `transform: scale(...)` — only the drop-shadow's blur radius and
  opacity oscillate now, so the sphere pulses without growing.
- **Telescope gets shadow-breathe instead of float.** New `.shadow-
  breathe` motion (Living) animates only `filter: drop-shadow(...)`,
  zero transform — presence without drawing the eye. Chosen over an
  idle-sway rotation per the sprint's either/or.
- **Flowers sway instead of bob.** New `.sway` motion (Living)
  rotates ≤1.2° from the base (`transform-origin: bottom center`),
  reading as wind bending the stem rather than the whole flower
  floating.
- **All new/changed motions honour `prefers-reduced-motion`** — added
  to the existing disable block in `animations/motion.css` alongside
  every other Living/Journey/Greeting animation.
- **Dev-only build indicator.** `js/buildInfo.js` + `build-info.json`
  (new — mirrors the root VihuStudio app's existing pattern) render a
  low-opacity, non-interactive, bottom-left readout of the short
  commit SHA, build timestamp, and environment, gated behind a single
  `DEV_BUILD_INFO` flag in `buildInfo.js` for easy removal before a
  production-facing release. Exists to kill "is this cache or a real
  stale deploy?" confusion after a Pages push.
- **Performance:** every animation is a CSS `transform`/`filter`
  keyframe — no JS animation loops, no layout-triggering properties.

## v0.3.6.2 — 2026-07-03

- **Hero MEP — Polish & Bug Fixes.** Small, non-architectural sprint.
- **Fixed shrubs asset discovery.** `FOLDERS.shrub` in
  `shared/worldLibrary.js` pointed at `world-library/nature/shrubs/`,
  but the World Library stores shrubs at `world-library/shrubs/` —
  shrubs never loaded even with a valid manifest. Corrected to
  `world-library/shrubs/`. No other folder mapping touched.
- **Removed the Hero heading.** "Who's creating today?" (and its
  decorative underline) is gone — the Hero is a Sky Map, not a
  dashboard; the artwork tells the story. Not replaced with other
  text. `hero/hero.css` (now fully unused) and the dead
  `revealHeroPrompt()` reveal logic in `js/scene.js` were removed
  along with it.
- **Removed the Parents entry.** The bottom-right "Parents" link is
  gone — it broke the sense of entering a universe. A dedicated
  parent experience is deferred to a future sprint.
- **Removed always-visible world labels.** The storyteller planets
  (Vihaan, Meera, Emma, Aarav) no longer show their name + teaser
  permanently beneath the sphere — discovery through exploration,
  not a directory. The underlying data is untouched: `name` /
  `teaser` stay on each descriptor in `planets/planetsData.js`, and
  still reach assistive tech via `aria-label`, ready for a future
  reveal-on-interaction (hover / click / zoom / telescope).
- **No infrastructure, no World Library, no architecture changes.**

## v0.3.6.1 — 2026-07-03

- **MEP-01 hotfix — Manifest-Based World Library Asset Discovery.**
  `shared/worldLibrary.js` no longer discovers assets by requesting a
  folder URL and parsing the directory listing a dev server returns
  for it — GitHub Pages and most static hosts disable directory
  browsing and return `404`, so production artwork was never
  discovered even though the sync pipeline was working correctly.
  `WorldLibrary` now fetches `<folder>/manifest.json` (a flat JSON
  array of PNG filenames) instead, generated automatically by the
  [VihuPlanet World Library](https://github.com/dexprab/vihuplanet-world-library)
  repo's Asset Normalizer workflow on every sync. Public API
  (`resolve` / `resolveAt` / `resolveMany` / `TYPES`) and every caller
  are unchanged; a missing, unreachable, or empty manifest still falls
  back to the existing placeholder. See
  `world-library/README.md` for the artist workflow.

## v0.3.6 — 2026-07-03

- **MEP-01 — World Library Integration.** Infrastructure sprint — no
  new Hero features, no Hero behaviour change. Replaces hardcoded
  artwork filenames with a filename-agnostic rendering pipeline.
- **New module — `shared/worldLibrary.js`.** `WorldLibrary.resolve(type)`
  / `resolveAt(type, index)` / `resolveMany(type, count)`. Discovers
  PNGs by fetching a `world-library/` folder and reading the directory
  listing a static file server returns for it — no manifest to
  maintain, no code change required to add new artwork. Returns `null`
  when nothing is found (empty library, or a host with no directory
  listing), which every caller treats as "render the existing
  placeholder instead."
- **New folder tree — `world-library/`.** Exactly the structure
  specified for the sprint: `companions/`, `decorations/`,
  `dreaming-home/`, `effects/`, `fonts/`, `nature/{clouds,flowers,
  rocks,shrubs,trees,waterfalls}/`, `skies/`, `sounds/`,
  `story-homes/`, `textures/`. Ships empty (`.gitkeep` per folder) —
  this sprint is the pipeline, not new art.
- **Renderers updated to try WorldLibrary first, SVG fallback second:**
  - `shared/worldObject.js` — descriptors may declare `libraryType`;
    `js/registry.js` tags clouds (`cloud`) and flowers (`flower`).
  - `planets/planets.js` — `planets/planetsData.js` tags all four
    storyteller planets `story-home`.
  - `js/scene.js` — new `mountSky()` layers a `world-library/skies/`
    image over the existing painted sky gradient if one exists; the
    gradient is untouched and is what renders when the library is
    empty.
  - Every other Hero object (moon, stars, rocket, paper plane, hills,
    telescope) is untouched — no `libraryType`, same SVG path as
    before this sprint.
- **Dreaming Planet / Companion intentionally NOT wired to
  WorldLibrary.** The sphere SVG's internal groups (`dp-eyes-open`,
  `dp-mouth-yawn`, `dp-companion`, ...) drive the entire Companion
  Awakening Sequence via CSS; swapping it for a flat PNG would
  silently break that state machine. `dreaming-home/` and
  `companions/` folders exist and the provider supports both types
  for a future sprint, but `dreamingPlanet/` itself is unchanged. See
  `world-library/README.md`.
- **Aspect ratio / no distortion.** `.world-object img` and
  `.storyteller-planet img` mirror the existing `svg` sizing rules
  (`width:100%; height:auto; object-fit:contain`); the sky image uses
  `background-size:cover` — crops, never stretches.
- **Verified fallback + populated paths in headless Chromium.** With
  an empty World Library the Hero renders byte-identically to before
  this sprint (24 SVG world-objects, 4 SVG planets, 0 images). With
  test PNGs temporarily dropped into `nature/clouds/` and `skies/`
  (removed before commit), every cloud instance and the sky picked
  them up automatically with no code change. See
  `evidence/mep-01/README.md`.
- **BUILD.md** bumped to `0.3.6`.

## v0.3.5 — 2026-07-01

- **Chapter 2.5 — Art Direction v1.0.** Locks the permanent visual
  identity of VihuPlanet. Synthesis of the three concept studies:
  **Concept C** for structural foundation (planets are landmasses,
  depth ramp reads background → midground → foreground),
  **Concept B** for emotional tone (patience, air, silence, back-
  turned companions, sky-caption dialogue),
  **Concept A** for illustration technique (watercolor washes with
  pencil-ink outlines on cream sketchbook paper).
- **Permanent palette locked** in `css/base.css`:
  Paper `#F1EAD0` · Horizon Apricot `#EBB47A` · Sky Cerulean `#7EB1CE` ·
  Ink `#1E2842` · Candle `#E8B871` · Moss `#7C9C6F` ·
  Ember `#E4A455` · Dusk `#8E7CB0`. Any single scene draws from at
  most **four** of these + paper.
- **New module — `artDirection/illustrationRules.js`.** Documents
  the permanent rules as a live global (`ArtDirection`) so future
  chapters can read them at runtime instead of re-deriving them.
- **Planets redrawn as landmasses.** Vihaan (mountain summit with
  back-turned dragon watching the sky), Aarav (lone tree with
  dragon in profile), Meera (tilted meadow with fox painting at
  easel, tail arcing away), Emma (ice plateau with penguin at
  piano bench, back turned), Dreaming (cloud-wrapped island with
  companion inside a warm-window cottage). Companions are rarely
  front-facing. The universe reads as existing without the
  Explorer.
- **Depth ramp.** `planets/planetsData.js` gains a `depth` field
  (`background` / `midground` / `foreground`);
  `planets/planets.css` applies opacity + micro-blur so distant
  planets fall back and near planets step forward.
- **Sky is now painterly.** `css/scene.css` replaces the flat
  gradient with a warm-apricot low + cool-cerulean high wash that
  lets cream paper read through.
- **Dialogue becomes sky-caption.** `dreamingPlanet/dreamingPlanet.css`
  removes bubble geometry entirely — no `::after` tail, no border,
  no shadow. The companion's words float against the sky in Caveat.
  Choice pills are pencilled ink outlines at low fill opacity.
- **Hero prompt quieter.** `hero/hero.css` shrinks the prompt to
  `clamp(22px, 2.4vw, 34px)` at 0.78 opacity and pulls the star-
  flanked underline down to match.
- **Brand + Parents entry recede.** Brand moves top-left in Caveat
  30px 500 weight at 0.82 opacity; Parents entry becomes a small
  bottom-right pencilled label at 0.55 opacity. The UI is now the
  world's quietest layer.
- **Ambient objects repalletted.** Moon (mascot face removed;
  crescent shadow + craters instead), rocket, star, flower, hills,
  telescope, cloud, paper plane — all now speak in the permanent
  palette with `#1E2842` ink lines.
- **Font stack narrowed.** Nunito Rounded is retired from Chapter 1
  and Chapter 2 surfaces. Caveat + Kalam only. "The world speaks
  in one hand."
- **Permanent canon added.** *The universe existed long before the
  Explorer arrived and will continue living long after they leave.
  Companions are independent inhabitants, not mascots. Wonder
  before action. Observation before interaction.*
- **Inheritance rule.** Every chapter after 2.5 must inherit Art
  Direction v1.0 verbatim.
- **Evidence packet** at `evidence/chapter-02.5/` — seven stills
  (`01-current-vs-new.png` through `07-final-world.png`) +
  `08-motion.webm` + a README that documents visual decisions,
  Chapter 1 vs Chapter 2 changes, and the permanent rules.
- **BUILD.md** bumped to `0.3.5`.

## v0.3.0 — 2026-07-01

- **Chapter 2 — The Dreaming Planet.** Full rework of Chapter 2
  aligned to the MEP v0.3 canon. Chapter 2 is no longer a
  storyteller-card selection screen; it is a magical interaction:
  the Explorer discovers a **Dreaming Planet**, wakes its
  **Companion**, and receives an invitation.
- **Canon enforced.** Never Login/Register/User/Account/Password/
  Authentication/Profile/Switch User. Always Explorer/Storyteller/
  Planet/Companion/Journey/Home/Dreaming Planet/Constellation.
- **New module — `planets/`.** Four floating storyteller planets
  (Vihaan / Aarav / Meera / Emma) with names + one-line story
  teasers + small hand-drawn companions on top. Same registry
  pattern WorldObject uses:
  `Planet.register({ id, name, teaser, asset, placement, motion })`.
- **New module — `dreamingPlanet/`.** Singular Dreaming Planet
  descriptor + `DreamingPlanetManager`. The manager runs a state
  machine — sleeping → stirring → waking → looking → smiling →
  speaking — driving CSS eye + mouth layer swaps on the sleeping
  companion inside the SVG.
- **Universe quietening.** The moment the Explorer clicks the
  Dreaming Planet, `body.universe-quieting` dims every ambient
  object except the Dreaming Planet, so attention naturally
  follows the wake.
- **Invitation dialogue + three choices.**
  - 🌟 *Yes, I'd love to!* → *"Really? Then let's get to know
    each other."* → fade out; Chapter 3B will land here.
  - 🏠 *I already have a planet.* → *"Wonderful! Let's find your
    way home."* → fade out; Chapter 3A will land here.
  - 🌙 *Maybe later.* → *"That's alright. I'll keep dreaming
    until you're ready."* → planet returns to sleep; universe
    brightens; Explorer keeps exploring.
- **WorldMotion extended, not rewritten.** New Living entries
  (`sleeping`, `breathing`, `listening`, `orbit`, `planet-drift`)
  + new Greeting `awakening`. Every keyframe reads timing from
  the shared `--vp-motion-*` custom properties. `prefers-reduced-
  motion` guard extended.
- **Placeholder services (interfaces only).**
  `shared/services/RecognitionService.js`,
  `shared/services/CompanionService.js`,
  `shared/services/PlanetService.js`. Section 6 of the sprint
  said "Prepare interfaces only. Do not implement." — each
  service documents the future responsibility inline.
- **Retired.** The `storyteller/` card grid module from v0.2.0 is
  removed — the previous approach was superseded by v0.3 canon.
- **Chapter 1 untouched.** The Chapter 1 world (moon, rocket,
  paper plane, stars, clouds, hills, flowers, telescope, horizon,
  paper backdrop, hero prompt, Parents entry) is unchanged. Only
  the empty `.foreground` layer receives Chapter 2's mounts.
- **Evidence packet** at `evidence/chapter-02/` — six required
  files (`01-universe.png` through `05-invitation.png` +
  `06-motion.webm`) + a README that explains implementation,
  architecture, reusable systems, placeholder services,
  language canon, future hooks, known limitations, and
  Chapter 3 readiness.
- **BUILD.md** bumped to `0.3.0`.

## v0.2.0 — 2026-07-01

- **Chapter 2 — Storyteller Selection.** (Superseded by v0.3.0.)
  Answered the Chapter 1 question "Who's creating today?" with a
  four-card storyteller row (Vihaan / Myra / Vilo / Add
  Storyteller). This entire module was removed in v0.3.0 when the
  MEP canon reframed Chapter 2 as the Dreaming Planet
  interaction. Kept here for history.

## v0.1.0 — 2026-07-01

- **Chapter 1 — Hero World Foundation.** The single-viewport
  hand-drawn sketchbook world that lives on its own before the
  Explorer interacts with anything.
  - Paper backdrop with SVG grain filter.
  - Sky (~62 %) + ground (~38 %) layers with watercolor washes,
    hand-drawn horizon.
  - World Object registry (`shared/worldObject.js` +
    `js/registry.js`) — descriptors for moon, 9 stars, 4 clouds,
    rocket, paper plane, hills, 6 flowers, and the future
    landmark **telescope** (visible but `interactive: false`).
  - WorldMotion vocabulary (`animations/motion.css`) with four
    categories declared (Living / Greeting / Journey /
    Celebration).
  - Fonts bundled locally: Caveat + Kalam (Latin subsets).
  - Hero prompt "Who's creating today?" reveals ~2.3 s after
    load via the Greeting `drawn-in` motion; small star-flanked
    underline follows.
  - Evidence packet at `evidence/chapter-01/`.
