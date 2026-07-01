# VihuPlanet CHANGELOG

All notable changes to the VihuPlanet MEP are recorded here.

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
