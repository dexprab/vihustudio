# Foundation Audio

The always-on ambient bed for VihuStudio's Hall of Creation — Atmosphere Engine
V1 (MLAS, the Minimum Lovable Atmosphere System). See
`docs/ATMOSPHERE_V1_BLUEPRINT.md` for the full spec; `js/audioManager.js` is
the one module that reads this folder.

## What's here (once supplied)

Five looping layers, all played **simultaneously, always, at their own fixed
relative volume**, forming one composite ambient sound — not five alternatives
to choose between, and not a rotation:

- `air.mp3`
- `harmony.mp3`
- `magic.mp3`
- `forest.mp3`
- `wind.mp3`

This is a direct, explicit product correction over an earlier draft of this
system's own design: "Keep all five Foundation layers. The simplification was
architectural, not experiential... the AudioManager simply loads the five
Foundation layers, applies fixed volumes, loops them indefinitely and
optionally overlays a World ambience layer."

Each file's own relative mix level lives in `js/audioManager.js`'s
`FOUNDATION_LAYERS` table — a placeholder balance today, meant to be re-tuned
by ear once all five real files can actually be heard mixed together.

## A disclosed, standing gap

**These five files do not exist on disk yet.** They were generated via
ElevenLabs (max-30-second clips, designed to loop seamlessly) but have not
been uploaded into this repository. `js/audioManager.js` degrades gracefully
in their absence — `new Audio(...)` against a missing file simply never plays
anything audible; it does not throw or block the rest of the app. Once
uploaded, no code change is needed — they're picked up automatically.

## Discipline

Mirrors `assets/audio/gateway/README.md`'s own rule exactly: no autoplay.
Playback only ever starts from inside a real click/keydown handler (the
Foundation layers begin on the first real user gesture after boot, via
`js/audioManager.js`'s own unlock listener). `js/audioManager.js` is the one
module allowed to touch these files.
