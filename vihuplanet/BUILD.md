# VihuPlanet MEP Build

MEP Version: **0.3.8**

## Completed

- ✔ Chapter 1 — Hero World Foundation
- ✔ Chapter 2 — The Dreaming Planet
- ✔ Chapter 2.5 — Art Direction v1.0 (permanent visual identity)
- ✔ MEP-01 — World Library Integration (infrastructure — no new Hero
  features, no behaviour change; see `world-library/README.md`)

## Upcoming

- Chapter 3A — Returning Home  (path: *"I already have a planet."*)
- Chapter 3B — Getting to Know You  (path: *"Yes, I'd love to!"*)

Every chapter after 2.5 must inherit the visual language established in
Art Direction v1.0. See `artDirection/illustrationRules.js` and
`evidence/chapter-02.5/README.md`.

## Shared systems live at HEAD

| System            | Where                                                     | Notes                                                          |
|-------------------|-----------------------------------------------------------|----------------------------------------------------------------|
| ArtDirection      | `artDirection/illustrationRules.js`                       | Permanent v1.0 rules — palette, line quality, planets, companions, sky, composition, motion, dialogue, hero, stance. |
| WorldLibrary      | `shared/worldLibrary.js` + `world-library/`               | MEP-01 (0.3.6.1 hotfix: manifest-based discovery). Filename-agnostic artwork provider — resolves a renderable type to a discovered PNG via that folder's `manifest.json`, or `null` so the caller falls back to its SVG. See `world-library/README.md`. |
| WorldObject       | `shared/worldObject.js`                                   | Registry + mount for every Chapter 1 world object. Descriptors may opt into WorldLibrary via `libraryType`. |
| WorldMotion       | `animations/motion.css`                                   | Four categories: Living / Greeting / Journey / Celebration. Chapter 2 added `sleeping`, `breathing`, `listening`, `orbit`, `planet-drift`, `awakening`. Sprint 2 added `sway`, `shadow-breathe`. Sprint 3 added `shimmer`, `wander`; removed `glide` (its only consumers, rocket + paper plane, were removed). |
| Planet            | `planets/planets.js` + `planets/planetsData.js`           | Storyteller planet registry + PlanetsManager.mount(). Planets are LANDMASSES, not spheres, and carry a `depth` field for the atmospheric ramp. |
| DreamingPlanet    | `dreamingPlanet/dreamingPlanet.js` + `.../dreamingPlanetManager.js` | Singular Dreaming Planet + wake sequence + invitation dialogue + three choice paths. Dialogue is sky-caption (no bubble). |
| Font stack        | `assets/fonts/`                                           | Caveat + Kalam. Nunito Rounded is retired from Chapter 1/2 surfaces — the world speaks in one hand. |
| Layers            | `.sky` / `.ground` / `.foreground`                        | Declared in `index.html`; Chapter 2 mounts inside `.foreground`. |
| Placeholder services | `shared/services/`                                      | RecognitionService · CompanionService · PlanetService. Interfaces only. |

## Canon (immutable)

- Explorer is the starting state.
- Exploration is always free.
- Storytellers are Explorers who accepted a Companion.
- Every Storyteller has one Home Planet.
- There is always one Dreaming Planet.
- Companions choose Storytellers.
- The browser remembers quietly (future).
- Every technical action must become a magical interaction.
- Adults appear only when the real world requires them.
- Illustration before interface. Play before purpose. Curiosity before instruction.
- **The universe existed long before the Explorer arrived and will continue living long after they leave.**
- **Companions are independent inhabitants, not mascots. They are rarely front-facing.**
- **Wonder before action. Observation before interaction.**
- **Every chapter after 2.5 inherits Art Direction v1.0 verbatim.**

## Enhancements deferred

- **H1.1 — Organic Motion** (adds `sway`, `breeze`, `bloom` under
  a new Organic category). Can be added later without rewriting
  WorldObject or WorldMotion; see the Chapter 1 evidence README.

## Evidence

- `evidence/chapter-01/` — Chapter 1 World Foundation captures + README.
- `evidence/chapter-02/` — Chapter 2 Dreaming Planet captures + README.
- `evidence/chapter-02.5/` — Art Direction v1.0 study + README (permanent).
- `evidence/mep-01/` — MEP-01 World Library integration captures + README.
