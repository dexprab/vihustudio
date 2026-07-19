# Lumo

## Purpose

Lumo's Companion Package for the Companion Engine (`js/companionEngine.js`)
— real, canonical portrait art plus `companion.json`/`personality.json`/
`animations.json`. Lumo the Story Dragon is VihuPlanet's official mascot
and the Guardian of Story Companions (Canon 2 in `docs/COMPANION_CANON.md`)
— owned by VihuPlanet, never claimable by a user, appearing during Creator
ceremonies and for returning Creators. See `docs/COMPANION_ENGINE.md` for
how Studio picks Lumo over the Story Egg (`../story-egg/`).

## Ownership

VihuPlanet product/design. Real, uploaded canonical art (not a
placeholder) — do not regenerate or alter without explicit direction.

## Expected Asset Types

- `companion.json` — `{id, name, species, version, defaultState, states}`.
- `personality.json` — `{name, role, traits, neverSays, greetings}`.
- `animations.json` — `{transitions:{state:state}, durations:{state:ms}}`.
- One PNG per entry in `companion.json`'s `states` map — today `hero`,
  `idle`, `wave`, `curious`, `think`, `talk`, `celebrate`, `sleep` (the
  full pose set Lumo shipped with, a superset of Canon 2's own frozen
  list — `talk` is real, uploaded art and is kept, not discarded).

## Naming Convention

State image filenames match `companion.json`'s `states` map values
exactly — no fixed naming scheme is assumed beyond that.

## Example Usage

```js
const lumo = new CompanionEngine({assetsBase:'assets/'});
await lumo.load('lumo');
lumo.show();
lumo.setState('wave');
lumo.speak("Let's imagine!");
```
