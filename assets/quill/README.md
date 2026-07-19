# Quill

## Purpose

Quill's Companion Package for the Companion Engine (`js/companionEngine.js`)
— an Ink Spirit, one of two Story Companions seeded by the Companion Canon
V2 sprint (`docs/COMPANION_CANON.md`) so the Creator Ceremony's random
companion assignment (`js/magicCard.js`'s `_assignBondedCompanion()`) has a
real pool of more than one entry to choose from. See `../nimbus/` for the
other.

## Ownership

VihuPlanet product/design. **Placeholder — art pending upload.** Matching
this repo's own established precedent for `../story-egg/`'s still-missing
`hero.png`: `companion.json`/`animations.json` declare the full Companion
Pose Contract v2 (`docs/COMPANION_CANON.md`), but **no PNG files exist in
this folder yet** — every state image 404s, and `CompanionEngine`'s
existing, proven graceful degradation (a missing state image shows a
broken-image glyph, never a crash) keeps the companion fully loadable/
bondable/testable in the meantime. Do not regenerate placeholder art for
this companion — real production art is expected to replace this gap
directly, the same way Lumo's own real art replaced its original
placeholder phase.

## Expected Asset Types

- `companion.json` — `{id, name, species, version, defaultState, states}`.
- `animations.json` — `{transitions:{state:state}, durations:{state:ms}}`.
- One PNG per entry in `companion.json`'s `states` map — the Companion Pose
  Contract v2's 12 poses: `hero`/`idle`/`wave`/`curious`/`think`/`happy`/
  `celebrate`/`sleep`/`sad`/`surprised`/`magic`/`hatching`. `hatching` is
  used only during the Creator Ceremony's birth sequence.

## Naming Convention

State image filenames match `companion.json`'s `states` map values exactly.

## Example Usage

```js
const quill = new CompanionEngine({assetsBase:'assets/'});
await quill.load('quill');
quill.show();
quill.setState('hero');
```
