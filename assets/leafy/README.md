# Leafy

## Purpose

Leafy's Companion Package for the Companion Engine (`js/companionEngine.js`)
— a Bloomling, and the third Story Companion in the pool the Creator
Ceremony's random companion assignment (`js/magicCard.js`'s
`assignBondedCompanion()`) draws from. See `../nimbus/` and `../quill/` for
the other two.

## Ownership

VihuPlanet product/design. **Real production art — not a placeholder.**
Leafy is the first companion in this repo to ship a *complete* Companion
Pose Contract v2 set: all twelve poses exist as real PNGs, so nothing here
relies on `CompanionEngine`'s missing-image fallback. `../nimbus/`,
`../quill/` and `../story-egg/` still have gaps; Leafy does not.

The species is **Bloomling**, taken from Canon 3's species list in
`docs/COMPANION_CANON.md` (previously unclaimed).

## Expected Asset Types

- `companion.json` — `{id, name, species, version, defaultState, states}`.
- `animations.json` — `{transitions:{state:state}, durations:{state:ms}}`.
- One PNG per entry in `companion.json`'s `states` map — the Companion Pose
  Contract v2's 12 poses: `hero`/`idle`/`wave`/`curious`/`think`/`happy`/
  `celebrate`/`sleep`/`sad`/`surprised`/`magic`/`hatching`. `hatching` is
  used only during the Creator Ceremony's birth sequence.

## Naming Convention

State image filenames match `companion.json`'s `states` map values exactly.

The upload arrived with `celeberate.png` misspelled; it was renamed to
`celebrate.png` rather than declared under the typo, so the states map stays
identical to every other companion's.

## Non-State Files

`sheet.png` is the labelled contact sheet of all twelve poses — reference
art only. It is deliberately **not** declared in `companion.json` and is
never loaded at runtime.

## Example Usage

```js
const leafy = new CompanionEngine({assetsBase:'assets/'});
await leafy.load('leafy');
leafy.show();
leafy.setState('hero');
```
