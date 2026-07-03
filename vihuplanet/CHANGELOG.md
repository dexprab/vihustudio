# VihuPlanet CHANGELOG

All notable changes to the VihuPlanet MEP are recorded here.

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
