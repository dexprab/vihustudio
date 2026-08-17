# Foundation Audio

The always-on ambient bed for VihuStudio's Hall of Creation — Atmosphere Engine
V1 (MLAS, the Minimum Lovable Atmosphere System). See
`docs/ATMOSPHERE_V1_BLUEPRINT.md` for the full spec; `js/audioManager.js` is
the one module that reads this folder.

## What's here

Five real, ElevenLabs-generated looping layers (each a genuine, distinct
30-second clip — confirmed via `ffprobe`, matching the generation cap), all
played **simultaneously, always, at their own fixed relative volume**,
forming one composite ambient sound — not five alternatives to choose
between, and not a rotation:

- `air.mp3` — supplied under the name "breath.mp3"; this is genuinely the
  air/breath-toned layer, matching what its own content sounds like.
- `harmony.mp3`
- `magic.mp3`
- `forest.mp3`
- `wind.mp3` — supplied under the name "air.mp3"; corrected once the product
  owner listened and confirmed its actual content reads as wind, not air —
  the two clips' filenames were swapped from an initial guess (which had
  matched them the other way around, purely by upload order) to their real
  content. `js/audioManager.js`'s own `FOUNDATION_LAYERS` table already
  expects exactly these five filenames, so no code change was needed either
  time.

This is a direct, explicit product correction over an earlier draft of this
system's own design: "Keep all five Foundation layers. The simplification was
architectural, not experiential... the AudioManager simply loads the five
Foundation layers, applies fixed volumes, loops them indefinitely and
optionally overlays a World ambience layer."

A World ambience track's own level against this bed is
`DEFAULT_WORLD_VOLUME` in the same file, and it too has a live slider in
the mixer. It was hard-coded to 1 with no way to say otherwise, which put
a World track 2x-30x above any single Foundation layer under it; the
default is unchanged, so nothing sounds different until somebody tunes it.

Each file's own relative mix level lives in `js/audioManager.js`'s
`FOUNDATION_LAYERS` table — tuned by ear via `tools/audio-mixer/` (a dev
utility exposing these exact values as live sliders).

The shipped mix is now **Air 0, Harmony 0, Magic 0, Forest 0.35, Wind 0.15**,
with a Master Volume of 0.55, a World Volume of 0.33 and a 2700ms World Fade
(Mute Fade stays at the original 300ms).

**Three of the five are deliberately silent.** The previous mix measured 73%
air.mp3, and air, harmony and magic are all held pitches (spectral flatness
0.21, 0.09 and 0.13, where 1.0 is noise) — so what a child heard was two
sustained tones with almost no texture under them, reported by the product
owner as sounding like horror-movie music. What is left is the two textural
layers: wind at about three quarters of the bed and forest, the most textural
of the five, at the rest.

**So the bed is weather, and the music is the World track on top of it.** See
`assets/audio/worlds/README.md`.

## Discipline

Mirrors `assets/audio/gateway/README.md`'s own rule exactly: no autoplay.
Playback only ever starts from inside a real click/keydown handler (the
Foundation layers begin on the first real user gesture after boot, via
`js/audioManager.js`'s own unlock listener). `js/audioManager.js` is the one
module allowed to touch these files.
