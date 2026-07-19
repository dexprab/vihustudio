# Story Egg

## Purpose

The Story Egg's Companion Package for the Companion Engine
(`js/companionEngine.js`) — real, canonical portrait art plus
`companion.json`/`animations.json` (deliberately no `personality.json`:
Canon 1's "never speaks" is structural, not merely a missing file — see
`js/companionDirector.js`'s `MODES.visitor.speaks:false`). The Story Egg
represents every Visitor — no face, no limbs, never speaks, expressed
only through pose (Canon 1 in `docs/COMPANION_CANON.md`). See
`docs/COMPANION_ENGINE.md` for how Studio picks the Story Egg over Lumo
(`../lumo/`).

## Ownership

VihuPlanet product/design. Real, uploaded canonical art (not a
placeholder) — do not regenerate or alter without explicit direction.

## Expected Asset Types

- `companion.json` — `{id, name, species, version, defaultState, states}`.
- `animations.json` — `{transitions:{state:state}, durations:{state:ms}}`.
- One PNG per entry in `companion.json`'s `states` map — Canon 1's frozen
  pose list (Companion Canon V2) is `hero`/`idle`/`curious`/`thinking`/
  `excited`/`sleep`/`magic`/`hatching`; `hero.png` and `magic.png` are the
  two files from that list not yet uploaded (disclosed in
  `docs/COMPANION_ENGINE.md`'s Asset Status section) — the engine degrades
  gracefully for a missing state image. The Story Egg still never gets
  emotional poses (`happy`/`sad`) — it communicates only through movement,
  glow, and magical effects.

## Naming Convention

State image filenames match `companion.json`'s `states` map values
exactly — no fixed naming scheme is assumed beyond that.

## Example Usage

```js
const egg = new CompanionEngine({assetsBase:'assets/'});
await egg.load('story-egg');
egg.show();
egg.setState('curious');
```
