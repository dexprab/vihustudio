# Creation

## Purpose

Exported, ready-to-use illustrations for each Creation Type card on
Screen 1 of the Studio Arrival Experience (see
`docs/PRODUCT_ILLUSTRATIONS.md`). These replace the emoji placeholders
`js/creationFlow.js`'s `CREATION_TYPES` currently renders once real
illustrations ship — the icon field on each entry is the seam.


## Ownership

VihuStudio product/design.


## Expected Asset Types

- creation-story.webp
- creation-artwork.webp
- creation-quote.webp
- creation-poem.webp
- creation-card.webp
- creation-more.webp

## Naming Convention

`creation-<type-id>.webp`, where `<type-id>` matches the `id` field of the matching entry in `CREATION_TYPES` (`js/creationFlow.js`) — `story`, `artwork`, `quote`, `poem`, `card`, `more`.


## Example Usage

Screen 1's "Tell a Story" card would reference `assets/illustrations/creation/creation-story.webp` in place of its current `📖` emoji icon.

