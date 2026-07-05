# VihuPlanet CHANGELOG

All notable changes to the VihuPlanet MEP are recorded here.

## v0.4.8 — 2026-07-05

Hero Premium Pass — a craft audit against Rule #1 ("an item is
complete only when the experience matches the intent, verified in
the browser"), not a features pass.

- **Fix — Dreaming Home's ambient breathing silently overrode every
  state/hover glow change.** `.dreaming-planet` always carries an
  always-running `.breathing` animation that set `filter` directly;
  since a running keyframe always wins the cascade over a static rule
  on the same property, sleeping/waking/chosen/hover glow changes had
  never actually been visible on the planet body — a bug predating
  this session. Fixed by animating two `@property`-registered custom
  properties (`--vp-dp-glow-blur`, `--vp-dp-glow-alpha`) instead of
  `filter` directly (`animations/motion.css`), composing the real
  `filter` once from those plus colour/brightness/sepia variables
  (`dreamingPlanet/dreamingPlanet.css`), and stopping the breathing
  animation once a state leaves sleeping/resting so it can't fight
  that state's own glow. Verified across sleeping, hover, the full
  wake sequence, chosen, resting, and `prefers-reduced-motion`.
- **Craft — Story World and Telescope hover.** Expo-out easing,
  staggered "overlapping action" timing across transform/filter/
  opacity, genuine warmth via a touch of `sepia()`, softer/more
  diffuse shadows (`planets/planets.css`, `css/scene.css`).
- **Feature — file-based Hero audio, replacing synthesized
  placeholders.** `js/heroAudio.js` now plays real `<audio>` files
  from `assets/audio/` instead of generating tones/noise via Web
  Audio; same public API, so no caller changed. Five placeholder
  `.wav` files ship today with a README documenting the target
  character and max duration for each — drop a real recording in at
  the same filename and nothing else needs to change.
- **Fix — Telescope Library pinned to a single definitive image.**
  A side-by-side and in-context craft audit of all 11 candidates
  found only `telescope.png` matched the floating islands' hand-
  painted watercolor texture; the other 10 are glossy/CG-shaded or
  visibly blurred. `shared/worldLibrary.js`'s `FILE_FILTERS` narrows
  the folder to that one file (same mechanism already used for
  `dreaming-home`); the other 10 stay in World Library, unused, for a
  future variant to build on. `HERO_CANON.md` §8 updated.
- **Fix — telescope lens-glint was landing on the tripod joint, not
  the glass.** Its position was never actually measured against
  `telescope.png`'s real pixels; sampling the source PNG directly
  found the lens glass bbox and recalibrated `css/scene.css`'s
  `::after` overlay to match. Confirmed via the Web Animations API
  (seeking the animation's `currentTime` directly to its peak) rather
  than trusting the old comment's numbers.
- **Spec, not yet implemented — Story Meadow needs art composed for
  its actual footprint, not cropped into it.** A craft audit found no
  crop of the existing square (2048×2048) meadow paintings can both
  read as "a place" and blend with the hills above it within the
  `100vw × 7vh` foreground strip — which is a much more extreme ratio
  (~24:1 at desktop widescreen) than it looks. `HERO_CANON.md` §7
  documents the exact target spec for a purpose-built replacement;
  drops in via the existing World Library manifest mechanism with no
  code change. Blocked on new art — outside this pass's ability to
  generate.

## v0.4.7 — 2026-07-04

- **Fix — Telescope Library was completely non-functional in
  production.** A Hero Variant Audit (20 fresh Playwright sessions,
  reading the actually-rendered asset URL for every session-varied
  collection) found `WorldLibrary.resolveAt('telescope', ...)`
  404ing on every call since shortly after Sprint H4-H6 shipped. Root
  cause: `FOLDERS['telescope']` pointed at `world-library/telescopes/`
  (plural), a rename made *inside this repo only*; the automated
  World Library sync mirrors the source repo's own folder structure
  destructively on every run (confirmed separately — the same
  mechanism has deleted `world-library/README.md` four times in this
  repo's history, each time silently, each time re-added by a later
  Hero doc commit), so the very next sync recreated `world-library/
  telescope/` (singular) and the renamed folder was simply gone. The
  telescope had been silently rendering its SVG fallback the entire
  time — 11 real production images (`telescope-dreamer-01`,
  `telescope-observer-01/02`, `telescope-seeker-01`,
  `telescope-world-finder-01/02`, `telescope.png`, plus four more
  carrying `story-meadow-*` filenames from the source side but
  confirmed to be telescope art, not excluded) sat in the World
  Library completely unused and unseen.
- **Fix.** `FOLDERS['telescope']` repointed at the singular
  `world-library/telescope/` — matching the pipeline's actual output,
  not a name chosen for readability in this repo. No `FILE_FILTERS`
  entry added: all 11 files in the manifest are real telescope
  images regardless of filename, so none are excluded from rotation
  (unlike Dreaming Home's legacy-file exclusion, which is a genuinely
  superseded placeholder, not a naming quirk). `HERO_CANON.md` §8,
  `BUILD.md`, `js/registry.js`, and `css/scene.css` comments updated
  to match and to record *why* the folder name must track the
  pipeline rather than read well.
- **Known follow-on, not fixed here.** The lens-glint overlay's
  position (`css/scene.css`) was measured against `telescope.png`
  specifically; the other 10 images likely have the lens somewhere
  else in frame, so the glint may not land on glass for every
  variant. Flagged in a code comment for whoever picks it up.
- **Separately observed, not fixed here:** `world-library/README.md`
  has been deleted by the automated sync four separate times across
  this repo's history (`git log --diff-filter=D`) and re-added each
  time by a Hero documentation commit — the same destructive-mirror
  behavior that broke the telescope folder rename. It's missing from
  the tree again as of this audit. Worth a permanent fix on the
  pipeline side (documentation living outside whatever `production/`
  mirrors) rather than another repeat of this cycle.

## v0.4.6 — 2026-07-04

- **Sprint H4-H6 — Hero Final Closure, Interaction Polish & MEP
  Freeze.** The Hero gains its first real interactivity: Story
  Worlds, the Dreaming Home, and the telescope all now acknowledge
  hover and click. No new navigation exists yet (Chapter 3 — Story
  World entry — still isn't built), so every interaction is tactile +
  optional audio acknowledgment only, never a fake destination.
- **Interactive Story Worlds.** Hover lifts 4-6px, brightens ~4%,
  saturates ~10%, deepens the floating shadow, and brightens the
  title — 220ms ease-out, no scale/rotate/bounce. Click adds a 1-2px
  settle (120ms) plus a soft paper-touch sound. Keyboard-focusable
  (`role="button"`, `tabindex="0"`, Enter/Space parity with click).
  Required a DOM restructure — `.storyteller-planet` (position/focus/
  depth-ramp) → `.storyteller-planet-hover` (hover-lift) →
  `.storyteller-planet-float` (ambient `planet-drift` + content) —
  because a running CSS animation or a `fill-mode:both` one-shot
  always wins the cascade over a plain rule on the *same* element;
  nesting is what lets hover-lift and the ambient float coexist
  without either resetting the other (Part 8). Side effect: this also
  quietly fixes `.depth-background`'s `scale(0.92)`, which the
  ambient float animation had been silently overriding since before
  this sprint (`aarav`/Starlight Meadow's background depth now
  actually reads as an atmospheric ramp).
- **Dreaming Home hover/click.** Kept the existing sleeping/resting
  hover scale, added a lift (`translateY(-5px)`) alongside it, a
  richer shadow, and warmer windows via a new `--vp-window-warmth`
  custom property the `vp-window-glow` keyframe reads (same
  non-conflicting technique as the float/hover split above — a
  custom property is just data an animation reads, so a `:hover` rule
  can change it without fighting the running animation for `filter`
  itself). Click adds a tiny settle plus a soft wood-tap + chime
  sound. `dreamingPlanetManager.js`'s state machine is untouched — one
  `if (HeroAudio...)` line added at the top of `begin()`.
- **Telescope lens glint — audited and reworked.** The previous
  sprint's version was a static fade-in/out dot; per this sprint's
  own audit standard ("if it cannot be clearly observed in 60s, treat
  it as missing"), that's a fail — it didn't read as a glint. Reworked
  into an actual specular sweep (the highlight translates across the
  lens while visible) with a random 20-35s interval picked once per
  page load (`js/scene.js`'s `armLensGlint()` — a CSS keyframe alone
  can't be "random," so this is genuine per-load variation rather
  than one fixed number). Visible window is ~2.4% of the cycle
  (480-840ms across the range, close to the 500-800ms spec — a
  percentage-based keyframe can't hit an exact ms width against a
  variable total duration, a real CSS limitation, not an oversight).
- **Telescope hover/click.** `interactive: false → true` — the first
  real change to that flag since Chapter 1. Hover lifts 5px, brightens
  the brass ~6%, and strengthens the lens reflection (a
  `--vp-lens-glint-scale` custom property, same technique as the
  window warmth). Click settles + plays a tiny brass-tick sound.
  `WorldObject` gained an optional `onActivate` callback (`shared/
  worldObject.js`) — completes a descriptor field (`interactive`) that
  already existed but never actually attached a handler; not a new
  system. **`HERO_CANON.md` §6/§8/§10 updated in the same commit**
  (its own discipline for Locked sections): the telescope's
  *artwork* now varies by session and it's `interactive: true` for
  tactile feedback — the landmark's role, position, and "looking
  through it is still undefined" both remain exactly as locked.
- **Telescope Library (new canonical collection).** `telescope`
  migrated from the singular `world-library/telescope/` to a plural,
  session-varied `world-library/telescopes/` — identical manifest/
  session/resolve architecture every other collection already uses
  (`SESSION_VARIED_TYPES`), zero new loading code. Honest caveat,
  same one Story Meadow shipped with initially: only the one real
  telescope image that already existed was migrated (renamed
  in-place, not fabricated) — `world-library/` is a pipeline-synced
  mirror artists don't hand-edit (`world-library/README.md`), and this
  sprint has no art pipeline access to produce the suggested
  Explorer/Moonwatch/Forest-Watcher set. Session variation has zero
  visible effect until a second image lands via the normal pipeline —
  at that point it starts working with no further code change, same
  as every other session-varied type. Also note: the sprint brief
  suggested `.webp` filenames, but the existing pipeline (and
  `WorldLibrary`'s `IMAGE_EXT` matcher) is PNG-only end to end; new
  telescope art should land as PNG like everything else until the
  pipeline itself adds another format.
- **Story Meadow contrast.** A soft top-edge contact shadow
  (`::before`, tapered — a `box-shadow` can't fade along one axis) plus
  a touch more contrast/saturation on the art itself, so the meadow
  reads as a distinct band instead of fading into the ground wash.
  Same size, same position, still quieter than any Story World.
- **Cloud refinement.** All four clouds' widths (and the matching vw
  ceiling on the two with a `min()` responsive cap) cut ~17% — frames
  the composition rather than dominating it. Drift motion and
  placement untouched.
- **Hero Audio (new, Part 7).** `js/heroAudio.js` — every sound is
  synthesized via the Web Audio API at the moment it's needed (noise
  bursts + short tone envelopes), not a binary asset: no licensing to
  track, nothing for the World Library pipeline to carry, and playback
  only ever happens from inside a real click/keydown handler, which
  is exactly the gesture browsers already require before allowing
  audio — no autoplay-unlock hack needed. No hover sounds, no
  ambience, no music, matching the brief exactly. Three sounds:
  Story World click (soft paper-touch, ~160ms), telescope click (tiny
  brass tick), Dreaming Home click (soft wood tap + warm chime).
- **Accessibility.** `prefers-reduced-motion` now disables every new
  hover/click lift/settle transform while preserving the rest of the
  feedback (brightness, saturation, shadow, title opacity, window
  warmth, lens-reflection size are separate `filter`/`opacity` rules,
  untouched). All three interactive elements are keyboard-focusable
  with Enter/Space parity to a real click, including firing audio.
- **Cleanup.** Removed the `.window-glow` utility class from
  `animations/motion.css` — `.dp-window` has only ever consumed the
  `vp-window-glow` keyframe directly via `animation:`, so the class
  had zero consumers (the keyframe itself stays). Old singular
  `world-library/telescope/` folder removed (renamed to `telescopes/`,
  not duplicated). No console.log/debugger leftovers found.
- **QA.** Playwright/Chromium across 4 breakpoints (1920/1366/834/390
  px): zero console errors, zero cloud/label overflow, zero
  still-animating elements under reduced motion. Verified with real
  computed-style assertions, not just visual review: hover transforms
  actually change (and the ambient float's `animationPlayState` stays
  `running` throughout — Part 8's "never reset" requirement), click
  fires the correct `HeroAudio` method, Enter/Space fires the same
  path as a mouse click, and the lens-glint's opacity/transform
  actually sweep across the sampled keyframe window.
- **Hero MEP Freeze.** Per the sprint's Final Definition of Done, the
  Hero is closed. Future Hero changes are limited to bug fixes,
  accessibility improvements, or issues found through real user
  testing; development focus moves to the experience inside the
  Story Worlds.

## v0.4.5 — 2026-07-04

- **Sprint H1-H3 — Hero MEP Final Polish, Optimization & Production
  Freeze.** Polish only, per the sprint brief — no new systems, no
  scope expansion, no philosophy changes. The Hero enters feature
  freeze at the end of this sprint (`BUILD.md`); every change below
  was verified in a real browser (Playwright/Chromium) across
  desktop/laptop/tablet/mobile viewports, not just reviewed as code.
- **Atmospheric polish.**
  - *Story World floating* — `planet-drift` narrowed from a
    translate+rotate loop to a pure vertical `translateY` (GPU
    transform only). Each of the four Story Worlds now floats on its
    own duration (19-29s, within the sprint's 18-30s spec) and
    amplitude (3-6px), with non-overlapping phase delays — no two
    planets move in step.
  - *Cloud drift* — narrowed to horizontal-only movement (was
    translate+vertical arc), 10-20px amplitude via a new
    `--vp-drift-x` custom property, duration slowed from 24-28s to
    44-68s per cloud. `cloud-2`/`cloud-3`'s width now uses
    `min(Npx, Xvw)` — QA found their old fixed-px width overflowing
    the viewport on tablet/mobile; this is a no-op at desktop/laptop
    sizes and shrinks gracefully below ~900px.
  - *Story Path* — `shimmer`'s keyframe stops moved off the
    mechanical 0/50/100 split and gained a whisper of `brightness()`
    alongside opacity, so the trail reads as magical ink catching
    irregular light rather than a breathing wave. No new DOM, no
    scaling, session-based selection untouched.
  - *Telescope* — a new `lens-glint`/`lens-reflection` motion pair: a
    sub-1-second glint every ~27s, opacity/filter only. Added as a
    class on the SVG fallback's lens ellipse *and* as a positioned
    `::after` overlay on the wrapper (measured directly against
    `world-library/telescope/telescope.png`'s content box, ~11%/20%
    from the top-left) — the World Library photo replaces the SVG
    entirely once art exists, so the SVG-only approach alone would
    never have rendered in production. The telescope body carries no
    animation of its own, as specified.
  - *Dreaming Home* — `.dp-window` gets a new `window-glow` motion,
    ±5% brightness over a 14s ease-in-out cycle, never blinking. No
    chimney-smoke asset exists on the current dwelling art, so that
    part of the brief was a no-op by inspection, not skipped.
- **Visual composition.**
  - Flowers regrouped from a mechanical every-10vw row into three
    loose, irregular clusters — same six flowers, same footprint,
    only the spacing changed (a real violation of "avoid evenly
    spaced decoration" found by inspection, not a hypothetical one).
  - New `.horizon-mist` layer — a soft cream wash straddling the
    `.sky`/`.ground` overlap band, independent of whichever session
    art loaded. QA screenshots found a visibly hard seam there,
    worst with darker/overcast World Library sky art; this softens it
    generically rather than special-casing any one sky asset.
  - Two Story Worlds (`meera`, `emma`) previously shared the exact
    same `top: 44vh`, reading as gridded rather than floating — nudged
    to 42vh/46vh. Floating-island glow/shadow/depth were already
    unified through one shared `.storyteller-planet` rule set
    (reviewed, no change needed).
- **Responsive + accessibility fixes found during QA** (not
  hypothesized — verified with Playwright across four breakpoints):
  - A favicon-less `<head>` was producing a 404 console error on
    every load; added an inline SVG data-URI icon (the brand's own
    ✿ glyph).
  - `prefers-reduced-motion` was missing three real animations:
    the Dreaming Home companion's `vp-listening` head-tilt and the new
    `.dp-window` glow (both applied via direct `animation:` rather
    than a utility class the media query already covered), and the
    Chapter-3 exit's `vp-fade-out` (applied via
    `body.dreaming-fade-out .world`). All three are now covered;
    verified zero animations remain active under
    `prefers-reduced-motion: reduce`.
- **Cleanup (verified dead, not assumed).**
  - Removed `.awakening`/`vp-awakening`, `.select-pulse`/
    `vp-select-pulse`, `.zoom-out`/`vp-zoom-out`, and the unused
    `.fade-out` utility class (the `vp-fade-out` keyframe stays — it's
    still used directly by `dreamingPlanet.css`). All were dead code
    with zero remaining callers, tied to the retired v0.2.0
    storyteller-card module; `.awakening`'s own comment described a
    class-based companion state machine `dreamingPlanetManager.js`
    never actually implemented (it uses `data-dp-state`).
  - Simplified `body.universe-quieting .world-object`'s `:not()`
    chain — `.world-object-dreaming-planet`, `.world-object-companion`,
    and `[data-object-id^="storyteller-planet"]` never matched
    anything (the Dreaming Planet and its companion are `.dreaming-
    planet`/`.dp-companion` elements, never `.world-object`; Story
    World wrappers carry `data-planet-id`, not `data-object-id`) — the
    selector's own scope already excluded them.
  - Removed `assets/avatars/` (`myra.svg`, `vihaan.svg`, `vilo.svg`)
    — confirmed zero references anywhere in code; documented as
    orphaned since v0.4.3 and never actually deleted until now.
  - Flipped `js/buildInfo.js`'s `DEV_BUILD_INFO` to `false` per its
    own comment ("flip to false … before a production-facing
    release") — this sprint's freeze is exactly that milestone.
  - `README.md`'s WorldMotion vocabulary list and `BUILD.md`'s
    WorldMotion table row updated to match every addition/removal
    above.
- **QA.** Playwright/Chromium at 1920×1080, 1366×768, 834×1112, and
  390×844: zero console errors, zero page errors, zero cloud/label
  overflow, zero still-animating elements under reduced motion. The
  full wake → dialogue → choice → fade-out Dreaming Planet flow was
  exercised end-to-end post-cleanup with zero errors. Story Path and
  Dreaming Home session rotation unaffected (no changes to
  `shared/worldLibrary.js`).
- **Hero MEP Final Polish complete — the Hero is feature-frozen**
  (see `BUILD.md`). Further Hero work is limited to bug fixes or
  critical usability issues until a future chapter explicitly reopens
  it.

## v0.4.4 — 2026-07-04

- **Dream Trail joins the session-varied set.** `trail` added to
  `SESSION_VARIED_TYPES` in `shared/worldLibrary.js` — the Hero now
  picks one of `world-library/trails/`'s PNGs (currently
  `story-trail-broken.png` / `story-trail-scattered.png`) once per
  browser session, the same mechanism already governing sky, cloud,
  story-meadow, and dreaming-home. No registry or engine change: the
  trail `WorldObject` already resolved through `libraryType: 'trail'`,
  it just resolved deterministically (always the alphabetically-first
  file) until now.
- **`HERO_CANON.md` updated in the same commit** (§6, §10) per its own
  discipline for Locked sections — Dream Trail (Story Path) moves from
  "not yet session-varied" to the currently-varied list.
  `BUILD.md` and `world-library/README.md` updated to match.

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
