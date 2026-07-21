# Gateway Video

Real, hand-supplied cinematic assets for the Traveller Gateway's Gate scene
— "Cinematic Polish Sprint — Traveller Gateway V1" originally shipped this
beat as pure CSS-drawn shapes (an arch, two door leaves, three rune
glyphs); direct feedback ("nope, its so bad") led to a real video
replacing that CSS approximation outright, and later feedback replaced the
whole surrounding CSS-composited scene machinery too — see `js/gatewaySequence.js`'s
own header comment for the full account of each change.

## What's here

- `gate-sequence.mp4` — the very first clip supplied: a single continuous,
  already-cracked-open ancient stone gate (1366×768, 24fps, 5.875s, no
  audio track) with the gap between its two leaves widening organically
  until the doors are fully open and warm light floods through. No longer
  used by any code path (superseded — see below); kept in the repo as a
  disclosed, unreferenced historical asset rather than deleted.
- `gate-poster.jpg` — that clip's own first frame, likewise no longer
  referenced by any code.
- `gate-sequence-final.mp4` — the real clip used for the **Traveller
  (first-time) path** (1024×576, 24fps, ~15.2s, audio-stripped). Shows the
  whole arc in one continuous shot: the doors alone → Lumo flies in
  carrying the Story Egg → lands and sets it down between its feet, wings
  spread (paused here at PAUSE_AT_S=5, see below) → picks the Egg back up
  and leaps into flight → carries it through the now-open doors into the
  light.
- `gate-sequence-final-poster.jpg` — that clip's own first frame.
- `gate-sequence-final-no-egg.mp4` — "essentially same video but w/o egg":
  a real, separately-supplied clip used for the **Returning Creator
  path** (1024×576, 24fps, ~15.1s, audio-stripped) — the identical arc
  (doors alone → Lumo flies in → lands, standing, wings spread, paused at
  the same PAUSE_AT_S=5 → leaps into flight → carries through the doors
  into the light), minus the Story Egg, since the Egg is purely a
  Traveller/Hall-of-Creation-Ceremony concept and a Returning Creator has
  already been through their own Ceremony.
- `gate-sequence-final-noegg-poster.jpg` — that clip's own first frame.
- `gate-sequence-01.mp4` — a separately-uploaded clip showing Lumo flying
  INTO an already-glowing magic gate and disappearing into its light.
  Deliberately **not wired into any code path** — it appears to depict
  Lumo entering the Gate, which conflicts with this file's own frozen
  canon ("Lumo... never enters the Hall"); left in the repo, unreferenced,
  pending explicit product direction on its intended use.
- `lumo-flying.mp4` / `lumo-flying-poster.jpg` — the isolated-Lumo clip
  built for the earlier "Lumo Guards the Gate" CSS-composited design (a
  separate flying figure layered on top of a doors-alone video via
  `mix-blend-mode:screen`). No longer used — Lumo is now baked directly
  into both `gate-sequence-final*.mp4` clips' own footage — kept as a
  disclosed, unreferenced historical asset.

## How it's used

Both the Traveller and Returning Creator paths now share one mechanism,
`js/gatewaySequence.js`'s `runVideoSequence(video,opts)`:

1. The real clip for that path is preloaded from the very start of the
   whole Gateway sequence (long before it's needed, so it has as much
   runtime as possible to buffer) and mounted full-bleed, paused on its
   own first frame.
2. A deliberate hold on the closed, glowing doors before anything moves.
3. For the Returning Creator only: a recognition line plays first, HEARD
   not witnessed, then the existing Creator Signature tap challenge
   verifies who's arrived. A first-time Traveller skips straight to the
   next step — there's nobody to recognize yet.
4. The clip plays from its start up to `PAUSE_AT_S` (5 seconds on both
   clips, confirmed via `ffmpeg` frame extraction to hold the same
   standing pose through ~5.5s) and pauses there, exactly the moment Lumo
   has landed and is standing, wings spread.
5. The interaction dialogue plays IN PERSON, over that held frame — Lumo
   actually visible for the first time, speaking directly to whoever just
   arrived (the richer 5-line greeting for a Traveller, a short reunion
   pair for a Returning Creator).
6. The clip resumes from the exact same timestamp it paused at (a genuine
   no-op seek — nothing is skipped) and plays to its own real end.
7. A brief final flash, then the hand-off into Studio's own boot sequence.

## Why a real video instead of more CSS

The CSS-only gate — hand-drawn arches, leaves, and glowing rune glyphs —
never read as "ancient, massive, sacred" the way the brief asked for; it
looked like a plain rectangle. Real, already-produced footage does what
the brief wanted directly, with Lumo's own arrival/standing/liftoff/flight
motion baked into the same shot — no separate CSS-composited figure, door-
opening beat sequence, or halo/particle/rune-spark effects layered on top
of it, for either path. `js/gatewayAudio.js`'s existing no-autoplay audio
discipline is unaffected — every video here is muted with no audio track.
