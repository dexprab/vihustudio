# World Ambience Audio

The optional per-World overlay layer for Atmosphere Engine V1 (MLAS). See
`docs/ATMOSPHERE_V1_BLUEPRINT.md` for the full spec; `js/audioManager.js` is
the one module that reads this folder, via its `playWorld(ambienceRefs)` /
`stopWorld()` API.

## What this is

A flat, shared pool — not a per-World-id subfolder — since World ambience is
resolved generically from whatever a Theme's own manifest declares, never a
hardcoded World id:

```json
{ "audio": { "ambience": ["forest.mp3"] } }
```

`js/themeEngine.js`'s `applyTheme()`/`applyArtworkTheme()` hooks read this
field off the resolved Theme and call `AudioManager.playWorld([...])` when
present, or `AudioManager.stopWorld()` when absent — World ambience is always
optional and never replaces the Foundation bed underneath it, only layers on
top of it.

A bare filename (e.g. `"forest.mp3"`) resolves against this folder; an
already-qualified path or URL is used as-is — mirroring, in spirit,
`ThemeRegistry.resolveAssetRef()`'s own dual-mode resolution for image/font
assets (that function itself is not called directly here, since it's scoped
to a compiled Theme package's own embedded assets map, and V1 World ambience
lives in this fixed, non-package location instead).

## What's here

`a.mp3` `b.mp3` `c.mp3` `d.mp3` — four tracks supplied by the product owner.
`a` and `c` are the shipped default (`DEFAULT_WORLD_AMBIENCE` in
`js/audioManager.js`); `b` and `d` are kept and unused for now.

**The default pair alternates.** `playWorld()` always took an array and only
ever played `[0]`; more than one entry now means "and then this one, and then
back". A single track still loops exactly as it always did, so no existing
caller changed. The change of hands is the same crossfade `playWorld` already
performs between two different Worlds — the outgoing track ramps down over the
World Fade while the next ramps up — so a turn never lands on a silence, and
the same forty-five seconds never repeats back to back.

**It is a default, never an override.** A Theme that declares its own
`audio.ambience` replaces it through the ordinary `playWorld` path, and
`AudioManager` still knows nothing about what a Theme is. A Theme with no
`audio.ambience` field now gets the default pair rather than the Foundation
bed alone — which is the point, since that bed is deliberately texture with no
music in it.

## Discipline

Mirrors `assets/audio/gateway/README.md`'s own rule exactly: no autoplay.
`js/audioManager.js` crossfades a World layer in/out with a simple linear
ramp (~2s) — never DSP, never ducking, never multiple simultaneous World
layers, per the frozen V1 scope.
