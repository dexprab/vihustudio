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

Each file's own relative mix level lives in `js/audioManager.js`'s
`FOUNDATION_LAYERS` table — still a placeholder balance (0.5/0.4/0.3/0.35/0.3),
since re-tuning it "by ear" needs a human actually listening to the five real
files mixed together, which this environment has no way to do; verified only
that each file decodes correctly and plays for its full real duration.

## Discipline

Mirrors `assets/audio/gateway/README.md`'s own rule exactly: no autoplay.
Playback only ever starts from inside a real click/keydown handler (the
Foundation layers begin on the first real user gesture after boot, via
`js/audioManager.js`'s own unlock listener). `js/audioManager.js` is the one
module allowed to touch these files.
