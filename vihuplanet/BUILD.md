# VihuPlanet MEP Build

MEP Version: **0.4.3**

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
- ✔ Telescope integration (World Library artwork wired; still
  non-interactive by design — `HERO_CANON.md` §8)
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

## In Progress

- Hero visual simplification
- Hero atmosphere refinement
- Hero depth refinement

## Future

- Companion onboarding
- Telescope exploration (defining what looking through it does)
- Story World entry experience
- Chapter 3A — Returning Home (path: *"I already have a planet."*)
- Chapter 3B — Getting to Know You (path: *"Yes, I'd love to!"*)

New systems should be added only when they strengthen the Hero
philosophy in `HERO_CANON.md` — the Hero has moved from construction
into refinement; future work should focus on composition, atmosphere,
depth, performance, and polish rather than new systems.

Every chapter after 2.5 must inherit the visual language established in
Art Direction v1.0. See `artDirection/illustrationRules.js` and
`evidence/chapter-02.5/README.md`.

## Shared systems live at HEAD

| System            | Where                                                     | Notes                                                          |
|-------------------|-----------------------------------------------------------|----------------------------------------------------------------|
| ArtDirection      | `artDirection/illustrationRules.js`                       | Permanent v1.0 rules — palette, line quality, planets, companions, sky, composition, motion, dialogue, hero, stance. |
| WorldLibrary      | `shared/worldLibrary.js` + `world-library/`               | MEP-01 (0.3.6.1 hotfix: manifest-based discovery). Filename-agnostic artwork provider — resolves a renderable type to a discovered PNG via that folder's `manifest.json`, or `null` so the caller falls back to its SVG. `SESSION_VARIED_TYPES` (sky / cloud / story-meadow / dreaming-home / trail as of this writing) pick a random-but-sessionStorage-sticky offset on first resolve, so the environment varies between browser sessions but holds steady across reloads. `FILE_FILTERS` lets a type exclude specific filenames (e.g. a superseded placeholder) without deleting anything from the World Library. See `world-library/README.md`. |
| WorldObject       | `shared/worldObject.js`                                   | Registry + mount for every Chapter 1 world object. Descriptors may opt into WorldLibrary via `libraryType`; may omit `assetHref` entirely to render nothing until World Library art exists (Story Meadow). |
| WorldMotion       | `animations/motion.css`                                   | Four categories: Living / Greeting / Journey / Celebration. Chapter 2 added `sleeping`, `breathing`, `listening`, `orbit`, `planet-drift`, `awakening`. Sprint 2 added `sway`, `shadow-breathe`. Sprint 3 added `shimmer`, `wander`; removed `glide` (its only consumers, rocket + paper plane, were removed). |
| Planet            | `planets/planets.js` + `planets/planetsData.js`           | Story World registry + PlanetsManager.mount(). Planets are LANDMASSES, not spheres, and carry a `depth` field for the atmospheric ramp. Each descriptor carries `worldName` + `storytellerName`, but the Hero only ever displays World Name — `storytellerName` and `teaser` stay on the descriptor, unused by the Hero (`HERO_CANON.md` §3). |
| DreamingPlanet    | `dreamingPlanet/dreamingPlanet.js` + `.../dreamingPlanetManager.js` + `assets/planets/dreaming.svg` | Singular Dreaming Realm + wake sequence + invitation dialogue + three choice paths. Dialogue is sky-caption (no bubble). Production Dreaming Home artwork is clipped into the SVG's existing landmass silhouette (`.dp-art`), behind the dwelling/companion/mist groups that carry every animation hook — the engine itself is frozen (`HERO_CANON.md` §4). |
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
