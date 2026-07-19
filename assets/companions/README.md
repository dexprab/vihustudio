# Companions

## Purpose

Companion Packages for the Companion Engine (`js/companionEngine.js`) — a
Story Companion's portrait art plus its `companion.json` manifest,
grouped one folder per companion id (`companions/<id>/`). Lumo is the
first and canonical package; every future companion (Nimbus, Moss,
Nova, etc.) ships as a sibling folder with the same shape, requiring
zero Companion Engine code changes.

## Ownership

VihuStudio product/design.

## Package Shape

```
companions/
  <id>/
    companion.json     -- {id, name, species, version, defaultState, states}
    <state>.png         -- one PNG per entry in companion.json's "states" map
    hero.png             -- a fuller portrait, not part of the state cycle
```

`companion.json`'s `states` map is the only thing the engine reads to
resolve a state name to an image file — a companion may support any
state vocabulary its own package declares (today's convention, matching
Lumo, is `idle`/`wave`/`think`/`talk`/`celebrate`/`sleep`/`curious`).

## Lumo (`companions/lumo/`)

Lumo the Story Dragon is VihuPlanet's official companion (see
`docs/hero/06-CONTRACT-Companion.md`) and the reference implementation
proving the Companion Package Contract. Its 8 PNGs are **placeholder
production art** — simple Canvas-drawn illustrations (see
`docs/COMPANION_ENGINE.md`) standing in for real hand-painted art until
that ships; swapping them for final art requires no engine or
integration code change, since the engine only ever reads the paths
`companion.json` declares.

## Naming Convention

- Folder name = companion id (lowercase, matches `companion.json`'s own
  `"id"` field).
- State image filenames match `companion.json`'s `states` map values
  exactly — no fixed naming scheme is assumed beyond that.

## Example Usage

```js
const lumo = new CompanionEngine();
await lumo.load('lumo');
lumo.show();
lumo.setState('wave');
lumo.speak("Let's imagine!");
```
