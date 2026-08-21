# Brand

## Purpose

VihuStudio's own brand marks: logo, wordmark, and brand colour references.
This is the *only* place the logo lives — not inside `assets/icons/`, not
inside any World.


## Ownership

VihuStudio product/brand.


## Expected Asset Types

- logo-mark.svg / .png
- logo-wordmark.svg
- palette reference (e.g. palette-primary.png or a colour-token JSON)

## Naming Convention

kebab-case, prefixed by what it is: `logo-mark.svg`, `logo-wordmark.svg`, `palette-primary.png`.


## Example Usage

The app header's brand mark, and the Screen 1 arrival banner's "VihuStudio" wordmark (currently rendered as text in `js/creationFlow.js`'s `_brand()` — this is where its illustrated replacement would live).


## og-image.jpg

The social share image (`og:image` / `twitter:image`) for `/` and
`/about` — 1200×630, the living night universe with the VihuPlanet
wordmark, supplied by the product owner. Referenced from `index.html`
and `about.html`; if it is ever replaced, keep the same filename and
size so nothing needs re-wiring, and bump `?v=`.
