# VihuPlanet MEP Build

MEP Version: **0.4.7**

See [`HERO_CANON.md`](HERO_CANON.md) for the permanent philosophy and
locked product decisions behind everything below — this file only
tracks *status*.

## Completed

- ✔ Hero architecture (layered `.sky` / `.ground` / `.foreground`
  stage, WorldObject registry + mount system)
- ✔ World Library integration (MEP-01 — filename-agnostic artwork
  pipeline; see `world-library/README.md`)
- ✔ Manifest-based loading (MEP-01 hotfix — works on GitHub Pages and
  every static host, no directory listing)
- ✔ Session asset variation (Hero Composition Engine — sky, cloud,
  Story Meadow, Dreaming Home)
- ✔ Story World naming (World Name is the only Story World identity
  the Hero displays; storyteller stays hidden — `HERO_CANON.md` §3)
- ✔ Hero cleanup (heading, Parents entry, always-visible labels, moon,
  rocket/paper-plane all removed — the Hero reads as a Sky Map, not a
  dashboard)
- ✔ Telescope integration (World Library artwork wired via a
  session-varied Telescope Library since Sprint H4-H6; hover/click
  tactile feedback since the same sprint — `HERO_CANON.md` §8)
- ✔ Dreaming Home integration (three canonical production Dreaming
  Homes, layered into the existing SVG — `HERO_CANON.md` §4)
- ✔ Dreaming Realm implementation (engine preserved, artwork
  production-quality, session-based home selection)
- ✔ Story World identity (World Name only — no "dreamed by" line)
- ✔ Hero philosophy (`HERO_CANON.md` — permanent record)
- ✔ Story Meadow implementation (real production art wired and
  session-varied; path + sizing corrected post-landing — v0.4.1)
- ✔ Chapter 1 — Hero World Foundation
- ✔ Chapter 2 — The Dreaming Planet
- ✔ Chapter 2.5 — Art Direction v1.0 (permanent visual identity)
- ✔ Hero visual simplification, atmosphere refinement, depth
  refinement (Sprint H1-H3 — Hero MEP Final Polish, Optimization &
  Production Freeze): independent per-object floating/drift on Story
  Worlds and clouds, presentation-only Story Path + telescope + window
  polish, a horizon-mist blend across the sky/ground seam, organic
  (non-gridded) flower clustering, dead-code removal (retired
  v0.2.0 storyteller-card leftovers, orphaned avatar SVGs, the
  production build-info overlay), and a QA pass across four
  breakpoints with zero console errors and full
  `prefers-reduced-motion` coverage.
- ✔ Hero interactivity, Telescope Library, Hero Audio (Sprint H4-H6 —
  Hero Final Closure, Interaction Polish & MEP Freeze): hover/click
  acknowledgment on Story Worlds, the Dreaming Home, and the
  telescope (tactile + optional synthesized audio, no navigation —
  Chapter 3 still doesn't exist); the telescope's lens glint audited
  and reworked into an actual visible sweep; a new session-varied
  Telescope Library (`world-library/telescope/` — see the Hero
  Variant Audit bullet below, this was briefly broken); Story Meadow
  contrast and ~17% smaller clouds; full keyboard + reduced-motion
  coverage for every new interaction.
- ✔ Hero Variant Audit (post-H4-H6, bug fix under the MEP Freeze's
  "bug fixes only" allowance). Counted every session-varied World
  Library collection empirically (20 fresh browser sessions,
  Playwright) and found the Telescope Library entirely non-functional
  in production: `FOLDERS['telescope']` pointed at `world-library/
  telescopes/` (plural, from the H4-H6 rename), but the automated
  World Library sync mirrors the source repo's own folder names
  destructively on every run, so a destination-only rename never
  survives the next sync — the folder silently reverted to singular
  `telescope/`, the code 404'd against it, and the telescope quietly
  fell back to its SVG the entire time. Fixed by pointing at
  `telescope/` (matching the pipeline, not a name chosen for
  readability) — 11 real images now selectable, all confirmed real
  telescope art despite some carrying `story-meadow-*` filenames from
  the source side, so none were filtered out.

## MEP Freeze

As of Sprint H4-H6, the Hero MEP is **closed and frozen** (Sprint
H1-H3 first declared the feature freeze; H4-H6 is the closure sprint
the Final Definition of Done called for). The architecture, systems,
atmosphere, and interaction model in `HERO_CANON.md` and this file are
considered complete for the Hero's current scope. Further Hero work
is limited to bug fixes, accessibility improvements, or issues found
through real user testing; new features resume only when a future
chapter (see Future, below) explicitly reopens it. Development focus
moves to the experience inside the Story Worlds.

## Future

- Companion onboarding
- Telescope exploration (defining what looking through it does —
  clicking the telescope today plays tactile/audio feedback only,
  same as a Story World; it doesn't navigate anywhere)
- Story World entry experience (Story World clicks are similarly
  feedback-only until this exists)
- Chapter 3A — Returning Home (path: *"I already have a planet."*)
- Chapter 3B — Getting to Know You (path: *"Yes, I'd love to!"*)
- Two more Telescope Library images (the sprint's suggested
  Moonwatch/Forest-Watcher pair) — session variation is wired and
  tested but has nothing to vary between until a second real image
  lands via the normal World Library pipeline (PNG, matching the
  existing pipeline — see `world-library/README.md`)

New systems should be added only when they strengthen the Hero
philosophy in `HERO_CANON.md`. The items above are the only work that
reopens Hero development after the freeze; everything else is a new
VihuPlanet chapter or destination, not a Hero change.

Every chapter after 2.5 must inherit the visual language established in
Art Direction v1.0. See `artDirection/illustrationRules.js` and
`evidence/chapter-02.5/README.md`.

## Shared systems live at HEAD

| System            | Where                                                     | Notes                                                          |
|-------------------|-----------------------------------------------------------|----------------------------------------------------------------|
| ArtDirection      | `artDirection/illustrationRules.js`                       | Permanent v1.0 rules — palette, line quality, planets, companions, sky, composition, motion, dialogue, hero, stance. |
| WorldLibrary      | `shared/worldLibrary.js` + `world-library/`               | MEP-01 (0.3.6.1 hotfix: manifest-based discovery). Filename-agnostic artwork provider — resolves a renderable type to a discovered PNG via that folder's `manifest.json`, or `null` so the caller falls back to its SVG. `SESSION_VARIED_TYPES` (sky / cloud / story-meadow / dreaming-home / trail / telescope as of this writing) pick a random-but-sessionStorage-sticky offset on first resolve, so the environment varies between browser sessions but holds steady across reloads. `FILE_FILTERS` lets a type exclude specific filenames (e.g. a superseded placeholder) without deleting anything from the World Library. `telescope` is session-varied via the existing singular `world-library/telescope/` folder (the Telescope Library, Sprint H4-H6) — a brief attempt to rename it to plural `telescopes/` for readability was reverted by a Hero Variant Audit: the automated sync mirrors the source repo's own folder names destructively on every run, so the destination name must match the pipeline exactly, not read well. See `world-library/README.md`. |
| WorldObject       | `shared/worldObject.js`                                   | Registry + mount for every Chapter 1 world object. Descriptors may opt into WorldLibrary via `libraryType`; may omit `assetHref` entirely to render nothing until World Library art exists (Story Meadow). Sprint H4-H6 added an optional `onActivate` callback, wired to `interactive: true`'s existing click/keydown handling for the first time (the telescope is the first consumer) — completes a descriptor field that already existed but had never actually attached a handler; not a new system. |
| WorldMotion       | `animations/motion.css`                                   | Four categories: Living / Greeting / Journey / Celebration. Chapter 2 added `sleeping`, `breathing`, `listening`, `orbit`, `planet-drift`, `awakening`, `select-pulse`, `zoom-out`. Sprint 2 added `sway`, `shadow-breathe`. Sprint 3 added `shimmer`, `wander`; removed `glide` (its only consumers, rocket + paper plane, were removed). Hero MEP Final Polish added `lens-glint`, `lens-reflection`, `window-glow`; removed `awakening`, `select-pulse`, `zoom-out`, and the unused `.fade-out` utility class — all dead code left over from the retired v0.2.0 storyteller-card module (Celebration is empty again, `vp-fade-out` itself is still used directly by `dreamingPlanet.css`). Sprint H4-H6 reworked `vp-lens-reflection` into an actual specular sweep (audited and found the fade-only original didn't read as a glint) and removed the `.window-glow` utility class (zero consumers — `.dp-window` only ever used the keyframe directly). |
| Planet            | `planets/planets.js` + `planets/planetsData.js`           | Story World registry + PlanetsManager.mount(). Planets are LANDMASSES, not spheres, and carry a `depth` field for the atmospheric ramp. Each descriptor carries `worldName` + `storytellerName`, but the Hero only ever displays World Name — `storytellerName` and `teaser` stay on the descriptor, unused by the Hero (`HERO_CANON.md` §3). Sprint H4-H6 made every Story World interactive: hover/click/keyboard with tactile + audio feedback, no navigation. Required nesting the ambient float and the hover-lift onto separate elements (`.storyteller-planet` → `.storyteller-planet-hover` → `.storyteller-planet-float`) since a running animation always wins the cascade over a plain rule on the same element. |
| DreamingPlanet    | `dreamingPlanet/dreamingPlanet.js` + `.../dreamingPlanetManager.js` + `assets/planets/dreaming.svg` | Singular Dreaming Realm + wake sequence + invitation dialogue + three choice paths. Dialogue is sky-caption (no bubble). Production Dreaming Home artwork is clipped into the SVG's existing landmass silhouette (`.dp-art`), behind the dwelling/companion/mist groups that carry every animation hook — the engine itself is frozen (`HERO_CANON.md` §4). Sprint H4-H6 added hover (lift + warmer windows via `--vp-window-warmth` + richer shadow) and a click tactile settle in CSS only, plus one line in `dreamingPlanetManager.js`'s `begin()` calling `HeroAudio` — the state machine itself is untouched. |
| HeroAudio         | `js/heroAudio.js`                                          | New in Sprint H4-H6. Every Hero sound is synthesized via the Web Audio API at the moment it's needed — no binary assets, no CDN, no licensing to track. Fires only from inside a click/keydown handler (a real user gesture), which already satisfies browsers' autoplay restriction with no unlock hack. No hover sounds, no ambience, no music. |
| Font stack        | `assets/fonts/`                                           | Caveat + Kalam. Nunito Rounded is retired from Chapter 1/2 surfaces — the world speaks in one hand. |
| Layers            | `.sky` / `.ground` / `.foreground`                        | Declared in `index.html`; Chapter 2 mounts inside `.foreground`. `.foreground` always paints above `.ground` regardless of any z-index set within it — a cross-stacking-context limitation objects must stay clear of, not fight (see Story Meadow's height budget in `js/registry.js`). |
| Placeholder services | `shared/services/`                                      | RecognitionService · CompanionService · PlanetService. Interfaces only. |

## Canon

See [`HERO_CANON.md`](HERO_CANON.md) — the permanent, authoritative
record of Hero philosophy and locked product decisions. Not
duplicated here.

## Enhancements deferred

- **H1.1 — Organic Motion.** `sway` shipped in Sprint 2 (Living
  World) and is in production use (flowers). `breeze` and `bloom`
  remain deferred — can be added later without rewriting WorldObject
  or WorldMotion; see the Chapter 1 evidence README.

## Evidence

- `evidence/chapter-01/` — Chapter 1 World Foundation captures + README.
- `evidence/chapter-02/` — Chapter 2 Dreaming Planet captures + README.
- `evidence/chapter-02.5/` — Art Direction v1.0 study + README (permanent).
- `evidence/mep-01/` — MEP-01 World Library integration captures + README.
