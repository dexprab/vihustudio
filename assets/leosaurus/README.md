# Leo

## Purpose

Leo's Companion Package for the Companion Engine (`js/companionEngine.js`)
— a Lantern Lion, and the fourth Story Companion in the pool the Creator
Ceremony's random companion assignment (`js/magicCard.js`'s
`assignBondedCompanion()`) draws from. See `../nimbus/`, `../quill/` and
`../leafy/` for the others.

## Identity

The folder and package id are `leosaurus`; the name children see is **Leo**.
The two deliberately differ — `id` is what `registry.json` and every claimed
Magic Card store, `name` is what the Magic Card and the companion widget
display.

The species is **Lantern Lion**, added to Canon 3's species list in
`docs/COMPANION_CANON.md` for this companion.

## Ownership

VihuPlanet product/design. Real production art — not a placeholder.

## Expected Asset Types

- `companion.json` — `{id, name, species, version, defaultState, states}`.
- `animations.json` — `{transitions:{state:state}, durations:{state:ms}}`.
- One PNG per entry in `companion.json`'s `states` map — the Companion Pose
  Contract v2's 12 poses: `hero`/`idle`/`wave`/`curious`/`think`/`happy`/
  `celebrate`/`sleep`/`sad`/`surprised`/`magic`/`hatching`. `hatching` is
  used only during the Creator Ceremony's birth sequence.

## Known Gap

`think.png` has **not** been uploaded. It exists on `sheet.png` (row 2,
column 1 — Leo with an open book in a thought bubble) but was never exported
as its own file.

It is declared in `companion.json` anyway, matching `../nimbus/`'s own
precedent: the request 404s and `CompanionEngine` falls back to the
package's `defaultState` pose, which is the engine's designed degradation
(`js/companionEngine.js`'s `onerror` handler). Declaring it means dropping
the finished file into this folder is the entire fix — no manifest edit.

## Naming Convention

State image filenames match `companion.json`'s `states` map values exactly.

## Framing

Both display frames — the 92px companion widget (`.companion-portrait-img`)
and the 240px Creator Ceremony stage (`.magic-card-ceremony-img`) — are
squares using `object-fit:contain`, so for a portrait pose the character's
apparent size is governed entirely by `contentHeight / canvasHeight`. Keep
every pose filling roughly 75–90% of its canvas height; a pose with a tall
empty margin silently renders at half the size of its neighbours.

Leo's eleven uploaded poses fill 85–92% and needed no correction.

## Non-State Files

`sheet.png` is the contact sheet of all twelve poses — reference art only.
It is deliberately **not** declared in `companion.json` and is never loaded
at runtime.

## Example Usage

```js
const leo = new CompanionEngine({assetsBase:'assets/'});
await leo.load('leosaurus');
leo.show();
leo.setState('hero');
```
