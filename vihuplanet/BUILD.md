# VihuPlanet MEP Build

MEP Version: **0.3.0**

## Completed

- ✔ Chapter 1 — Hero World Foundation
- ✔ Chapter 2 — The Dreaming Planet

## Upcoming

- Chapter 3A — Returning Home  (path: *"I already have a planet."*)
- Chapter 3B — Getting to Know You  (path: *"Yes, I'd love to!"*)

## Shared systems live at HEAD

| System            | Where                                                     | Notes                                                          |
|-------------------|-----------------------------------------------------------|----------------------------------------------------------------|
| WorldObject       | `shared/worldObject.js`                                   | Registry + mount for every Chapter 1 world object.             |
| WorldMotion       | `animations/motion.css`                                   | Four categories: Living / Greeting / Journey / Celebration. Chapter 2 added `sleeping`, `breathing`, `listening`, `orbit`, `planet-drift`, `awakening`. |
| Planet            | `planets/planets.js` + `planets/planetsData.js`           | Storyteller planet registry + PlanetsManager.mount().          |
| DreamingPlanet    | `dreamingPlanet/dreamingPlanet.js` + `.../dreamingPlanetManager.js` | Singular Dreaming Planet + wake sequence + invitation dialogue + three choice paths. |
| Font stack        | `assets/fonts/`                                           | Caveat, Kalam (Chapter 1); Nunito Rounded (Chapter 2 UI). Local, no CDN. |
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

## Enhancements deferred

- **H1.1 — Organic Motion** (adds `sway`, `breeze`, `bloom` under
  a new Organic category). Can be added later without rewriting
  WorldObject or WorldMotion; see the Chapter 1 evidence README.

## Evidence

- `evidence/chapter-01/` — Chapter 1 World Foundation captures + README.
- `evidence/chapter-02/` — Chapter 2 Dreaming Planet captures + README.
