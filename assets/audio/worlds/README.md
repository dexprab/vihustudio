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

`a.mp3` `b.mp3` `c.mp3` `d.mp3` `e.mp3` — five tracks supplied by the product
owner. `a`, `c` and `e` are the shipped default (`DEFAULT_WORLD_AMBIENCE` in
`js/audioManager.js`); `b` and `d` are kept and unused for now.

They are not equal lengths — `a` and `c` run 45 seconds each and `e` runs 150 —
so `e` is heard for more of any given visit than the other two. The ORDER of
the list means nothing now; only its membership does.

Measured, all five sit within 10% of each other in loudness, so one World
Volume suits any of them: at the shipped 0.33 each runs seven to eight times
the Foundation bed's own level.

**One plays, then another, chosen at random.** `playWorld()` always took an
array and only ever played `[0]`; more than one entry now means "any of these,
one after another". The next track is picked from all of them EXCEPT the one
just heard — which is what stops "random" from meaning the same forty-five
seconds twice running, the one thing an ambience must never do. With exactly
two tracks that leaves one answer, so a pair simply alternates. Which track a
visit opens on is chosen the same way, or every arrival would begin identically
and the randomness would only start after the first hand-over.

It uses `Math.random`, deliberately, and not the runtime's seeded `Rng`: the
seeded generator exists so every viewer sees the SAME Ether, and what one child
happens to hear on one visit is theirs rather than a shared property of the
universe — the same reasoning the arrival turn already uses (`CLAUDE.md` →
Decision 10).

A single track still loops exactly as it always did, so no existing caller
changed. The change of hands is the same crossfade `playWorld` already performs
between two different Worlds — the outgoing track ramps down over the World
Fade while the next ramps up — so a turn never lands on a silence.

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
