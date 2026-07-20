# Gateway Video

A real, hand-supplied cinematic asset for the Traveller Gateway's Scene 6
("The Gates Open") — "Cinematic Polish Sprint — Traveller Gateway V1"
originally shipped this beat as pure CSS-drawn shapes (an arch, two door
leaves, three rune glyphs); direct feedback ("nope, its so bad") led to
this real video replacing that CSS approximation outright.

## What's here

- `gate-sequence.mp4` — a real H.264/AVC video (1366×768, 24fps, 5.875s,
  no audio track), supplied directly by the product owner. Shows a single
  continuous, already-cracked-open ancient stone gate — carved archway,
  glowing blue/gold runes, ferns at the base — with the gap between its
  two leaves widening organically over the full clip until the doors are
  fully open and warm light floods through a soft, mystical haze beyond.
- `gate-poster.jpg` — the video's own first frame, extracted via `ffmpeg`,
  used as the `<video poster>` (shown before the file has buffered) and as
  the reduced-motion fallback image.

## How it's used

`js/gatewaySequence.js`'s `mountGates()`/mounting logic builds a real
`<video muted playsinline preload="auto">` inside `.gateway-gates-wrap`
instead of the retired CSS arch/leaf/rune elements — the wrap itself keeps
governing position/scale (Reveal → Journey's modest growth → Arrival's
"dominate the screen" growth), unchanged from the CSS-only version. The
video is preloaded from the very start of the whole Gateway sequence (long
before Scene 6 needs it, so the ~4.5MB file has the full runtime of
Scenes 1-3 to buffer) and stays paused on its own first frame — "the gate,
already glowing, sensed rather than fully seen" — through Reveal, Journey,
Arrival, and the silent Pause beat; only at the Awaken beat (Lumo raises a
wing, magic sparks travel toward it) does `video.play()` actually fire, so
the real opening motion becomes the "doors open" beat itself rather than a
separately faked CSS animation. `js/gatewaySequence.js` waits for the
video's own `ended` event (with a timeout fallback in case metadata never
loads) before continuing into the existing dolly + threshold flash.

## Why a real video instead of more CSS

The CSS-only gate — hand-drawn arches, leaves, and glowing rune glyphs —
never read as "ancient, massive, sacred" the way the brief asked for; it
looked like a plain rectangle. This real, already-produced footage does
what the brief wanted directly, with no further hand-tuning needed for the
gate's own visual identity. `js/gatewayAudio.js`'s existing no-autoplay
audio discipline is unaffected — this file carries no audio track at all.
