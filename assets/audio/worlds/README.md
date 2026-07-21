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

## Currently empty

No World-specific ambience tracks exist yet — this folder is a placeholder
for when a Theme Author (via World Builder, in a future sprint) or the
platform itself supplies one. A Theme with no `audio.ambience` field behaves
exactly as it does today: Foundation plays, nothing else.

## Discipline

Mirrors `assets/audio/gateway/README.md`'s own rule exactly: no autoplay.
`js/audioManager.js` crossfades a World layer in/out with a simple linear
ramp (~2s) — never DSP, never ducking, never multiple simultaneous World
layers, per the frozen V1 scope.
