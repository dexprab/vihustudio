# Companions

## Purpose

Companion Packages for the Companion Engine (`js/companionEngine.js`) — a
Story Companion's portrait art plus its `companion.json` manifest,
grouped one folder per companion id (`companions/<id>/`). Registered
platform entities as of the Companion Canon Freeze sprint: Lumo (the
Guardian, Creator mode) and Story Egg (Visitor mode) — see
`docs/COMPANION_CANON.md` for what each *is*, `docs/COMPANION_ENGINE.md`
for how Studio picks between them. Every future companion (Nimbus,
Moss, Nova, a future personal companion, etc.) ships as a sibling
folder with the same shape, requiring zero Companion Engine code
changes.

## Ownership

VihuStudio product/design.

## Package Shape

```
companions/
  registry.json         -- {companions:[{id,name,species,path,role}, ...]}
  <id>/
    companion.json       -- {id, name, species, version, defaultState, states}
    personality.json     -- optional: {name, role, traits, neverSays, greetings}
    animations.json       -- optional: {transitions:{state:state}, durations:{state:ms}}
    <state>.png            -- one PNG per entry in companion.json's "states" map
```

`companion.json`'s `states` map is the only thing the engine reads to
resolve a state name to an image file — a companion may support any
state vocabulary its own package declares. `registry.json`'s own
`role` field (`"guardian"` for Lumo, `"visitor"` for Story Egg) is what
`js/companionDirector.js` matches against its own Visitor/Creator
`MODES` table to decide which entity to boot — a plain data lookup,
never a hardcoded id.

## Lumo (`companions/lumo/`)

Lumo the Story Dragon is VihuPlanet's official mascot and the Guardian
of Story Companions (see `docs/hero/06-CONTRACT-Companion.md` and
Canon 2 in `docs/COMPANION_CANON.md`) — owned by VihuPlanet, never
claimable by a user, appearing during Creator ceremonies and for
returning Creators. Its 7 PNGs (`hero`/`idle`/`wave`/`curious`/`think`/
`celebrate`/`sleep`) are **placeholder production art** — simple
Canvas-drawn illustrations (see `docs/COMPANION_ENGINE.md`) standing in
for real hand-painted art until that ships; swapping them for final art
requires no engine or integration code change.

## Story Egg (`companions/story-egg/`)

The Story Egg represents every Visitor — no face, no limbs, never
speaks, expressed only through pose (Canon 1 in
`docs/COMPANION_CANON.md`). Registered as of the Companion Canon Freeze
sprint (`companion.json`/`animations.json` are real); its 7 PNGs
(`hero`/`idle`/`curious`/`thinking`/`excited`/`sleep`/`hatching`) are
the one piece of this registration still pending upload — see
`docs/COMPANION_ENGINE.md`'s "Asset Status" for the full disclosure. No
placeholder art was generated for it, per explicit instruction to treat
the real, to-be-uploaded assets as immutable canonical versions.

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
