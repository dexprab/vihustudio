# World Library — artist workflow

This folder is a synced mirror. **Nothing here is edited by hand** —
every file is written by the automated pipeline described below. If
you need to add or change artwork, do it in the source repository,
[`dexprab/vihuplanet-world-library`](https://github.com/dexprab/vihuplanet-world-library),
not here.

See [`../HERO_CANON.md`](../HERO_CANON.md) §11 for the permanent
World Library canon (manifest-based loading, fallback guarantees).
This file is the artist-facing "how do I add art" companion to that.

## Pipeline

```
Canva → PNG Export → GIMP → 2048×2048 canvas → raw/<collection>/<file>
   ↓  (push to vihuplanet-world-library)
Asset Normalizer (GitHub Action)
   — normalizes every file under raw/ into a centered, transparent
     2048×2048 production/<same path>.png
   — regenerates manifest.json in every directory that contains PNGs
   ↓
World Library Sync (GitHub Action)
   — mirrors production/ into this repo's vihuplanet/world-library/,
     byte-identical, manifests included
   — validated: production/ and vihuplanet/world-library/ must match
     exactly (excluding manifests, which are regenerated at the
     destination independently as a second check)
   ↓
shared/worldLibrary.js (Hero) — fetches manifest.json, resolves a URL
```

Both GitHub Actions live in the source repo
(`.github/workflows/asset-normalizer.yml`,
`.github/workflows/sync-world-library.yml`) — not here, and not
something a Hero sprint should modify (§11's "out of scope" rule).

## Adding artwork to an existing collection

Drop a new source image anywhere under `raw/<collection>/` in the
source repo and push. The pipeline is fully automatic and recursive —
**no code change**, no manifest to hand-edit, no `COLLECTIONS` list to
update. The normalizer discovers any file under `raw/`, in any nested
folder, with a supported extension; every directory that ends up with
at least one PNG in `production/` gets its own `manifest.json`.

This is how the three `dreaming-world-0N.png` Dreaming Homes,
`story-meadow-*.png`, and the telescope/trail/seed artwork all landed
mid-sprint with zero Hero code changes to the *asset discovery* side.

## Adding an entirely new collection type

Dropping art into a brand-new top-level (or nested) folder under
`raw/` syncs into `vihuplanet/world-library/` automatically — but the
Hero doesn't render a type it doesn't know about yet. Wiring a new
collection into the Hero is a small, deliberate code change:

1. Add an entry to `FOLDERS` in `shared/worldLibrary.js` — the type
   name the Hero will ask for, mapped to the synced folder path.
2. Give a `WorldObject` (`js/registry.js`) or `DreamingPlanet`
   (`dreamingPlanet/dreamingPlanet.js`) descriptor a matching
   `libraryType`.
3. If the object needs a fallback when the library is empty, keep its
   `assetHref` (SVG); if not, omit `assetHref` entirely and the object
   simply doesn't mount until real art exists (`shared/worldObject.js`
   supports this — see the Story Meadow implementation).

This is the only part of the workflow that touches Hero code. Steps 1
and 2 are a few lines each; nothing in the World Library repository
itself needs to change.

## Session-varied collections

Some collections are chosen once per browser session rather than
resolving deterministically — see `SESSION_VARIED_TYPES` in
`shared/worldLibrary.js` for the current list (`sky`, `cloud`,
`story-meadow`, `dreaming-home`, `trail`, `telescope` as of this
writing) and
`HERO_CANON.md` §6 for the philosophy. Adding more than one image to a
session-varied collection is all that's needed for variation to kick
in — no other change.

## Excluding a stale file without deleting it

If a collection needs to retire an old asset without removing it from
the World Library (e.g. history, or a rollback safety net),
`FILE_FILTERS` in `shared/worldLibrary.js` lets the Hero-side resolver
match only a filename pattern. This keeps the World Library repository
itself untouched — it stays the pipeline's source of truth — while the
Hero simply ignores what doesn't match.

## Current collections (snapshot)

This list can drift — treat `FOLDERS` in `shared/worldLibrary.js` as
the authoritative current mapping. As of this writing:

`skies/`, `story-homes/`, `dreaming-home/`, `telescopes/`, `trails/`,
`seeds/`, `shrubs/`, `nature/trees/`, `nature/flowers/`,
`nature/clouds/`, `nature/rocks/`, `nature/waterfalls/`,
`nature/story-meadows/`.

## Fallback guarantee

Every renderable type falls back gracefully if its manifest is
missing, unreachable, or empty: `WorldObject` descriptors fall back to
their `assetHref` SVG (or don't mount at all, if none is declared);
the Dreaming Realm falls back to `dreaming.svg`'s own gradient. Nothing
in the Hero ever breaks because a World Library collection is empty —
this is why art can land mid-sprint, incrementally, without
coordination.
