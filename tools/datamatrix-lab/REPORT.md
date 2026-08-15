# Data Matrix Experiment — Report

**Recommendation: NO. Do not integrate this into VihuPlanet.**

The experiment answered its question, and the answer is negative for two
independent reasons — one visual, one geometric. Both are properties of
Data Matrix itself rather than of this implementation, so neither is
likely to yield to more work on the camouflage.

Everything below is measured. The lab is `tools/datamatrix-lab/`, is
loaded by nothing, reads no Creator and writes nothing. Deleting that
folder removes the experiment completely.

## The libraries

| | |
|---|---|
| Encoder | **bwip-js 4.5.1** (MIT), vendored |
| Decoder | **@zxing/library 0.21.3** (MIT), vendored |
| Browser support | any modern browser; no CDN, works offline |
| Hand-written CV | **none** — no OpenCV, no ML, no cloud vision |
| Average decode | **40–70 ms** |
| Symbol size | 28 × 28 modules for `TEST-0001` |

## The three constraints the decoder actually has

The first build decoded **nothing at all** — 0% on every strategy at
every setting. Isolating it stage by stage gave three rules that shaped
everything after:

1. **A quiet zone is not optional.** Modules drawn edge-to-edge on the
   sky never decode. Two clear modules is enough; none is hopeless.
2. **Opacity is the wrong knob.** Fading the matrix with `globalAlpha`
   over a dark sky drags the *light* modules dark and destroys the
   polarity the symbol is made of. Quiet zone + 0.6 opacity still read
   nothing.
3. **Contrast compression is the right knob** — bringing the two tones
   toward each other while keeping the darker one darker. `#3a` on
   `#c8` decodes cleanly.

## Results by strategy

4 IDs × 9 realistic scenes = 36 photographs each, under a true
projective warp with lighting, glare, blur and sensor noise.

| Strategy | Best success | At presence |
|---|---|---|
| **A — matrix under constellation** | **72%** | 0.80 |
| B — star overlay (halos cut the matrix) | 42% | 0.80 |
| C — low contrast | 39% | 1.00 |
| D — sky-integrated | 31% | 0.50 |
| E — hybrid | 39% | 0.80 |

**Best: A at presence 0.8–1.0. Worst: D, sky-integrated** — the strategy
that camouflages best is the one that decodes worst, which is the whole
finding in one line.

**Target was ≥95%. Best achieved was 72%.**

## Where it actually breaks

Sharp cliffs, not gradual decay — characteristic of a detector that
either finds the L-shaped finder pattern or does not.

| Condition | Works to | Fails from |
|---|---|---|
| **Tip (card leaning away)** | 14° | **16°** |
| **Turn (rotation about vertical)** | 20° | **25°** |
| Distance (share of frame) | **0.20** — no failure found | — |
| **Occlusion (hand over a corner)** | 15% covered | **20%** |

**Distance is a non-issue.** The card decoded at every size tested, down
to filling a fifth of the frame — roughly 4–5 camera pixels per module.
Minimum printed size is not the constraint; **angle is.**

Lighting, glare, dim rooms and blur all sat at 83–100%. Those are not
the problem either.

## Why this fails for children

A child holding a card up to a camera does not hold it within 14° of
square-on, and they hold it **by the edges with their fingers on the
card**. The two conditions that fail at 0% are precisely the two a child
produces constantly. The existing constellation reader tolerates far
more tip and turn than this does, because it registers on four guide
stars and solves a homography — Data Matrix in this decoder does no
perspective correction at all.

## Why the camouflage cannot be pushed further

See `screenshots/01-child-view.png`. At the presence needed to decode,
**the card is a Data Matrix with five stars drawn on it.** It is not a
constellation with a hidden identity; it is a QR-like block that
happens to have stars. Lower the presence until it reads as a sky and
the decode rate collapses.

That directly fails acceptance criteria 2 and 3, and it fails Decision
16's own rule that recognition must never look like scanning.

The quiet zone deserves its own mention: a Data Matrix needs a **light
rectangle** around it, and a light rectangle on a night sky is the most
conspicuous object on the card. The one thing that cannot be hidden is
structural.

## Acceptance criteria

| # | Criterion | Result |
|---|---|---|
| 1 | Webcam decodes reliably | **partial** — only within 14° tip / 20° turn |
| 2 | Matrix substantially camouflaged | **fail** — visible at every decodable setting |
| 3 | Still looks like a VihuPlanet constellation | **fail** — reads as a code with stars on it |
| 4 | IDs never decode as each other | **pass** — 20 identities, 19 read, **0 false positives** |
| 5 | Survives rotation/distance/light/glare/hand | **fail** — hand and tip both 0% |
| 6 | Preview stays smooth | **pass** — 400 ms cadence, 40–70 ms decode |
| — | ≥95% success | **fail** — 72% best |

**False positives: 0. False negatives: 1 of 20.** Criterion 4 is the one
that passes outright, and it is the safety-critical one — the decoder
never confused one identity for another.

## Test conditions

Straight/bright, normal room, 18° rotation, 22° perspective, far away,
dim room, glare, 2.2px blur, hand over a corner. True pinhole projection
with per-scene lighting, blur and noise.

**Disclosed: this was not tested on physical prints.** No printer or
camera was reachable from this session. The lab has a live camera mode
and PNG/print-sheet export so a physical round can be run — but the
geometric cliffs above are properties of the decoder and will not move,
and the visual result in the child view needs no camera to judge.

## Recommendation

**Discard.** The idea fails on its own terms: the settings that make it
readable make it visible, and the angles a child naturally uses make it
unreadable. No amount of camouflage tuning reaches both ends.

If a machine-readable identity layer is wanted later, the useful finding
is that **the existing constellation reader already solves the hard part
this does not** — it registers on four guide stars and corrects
perspective, which is exactly why it tolerates angles that break Data
Matrix. Capacity, not readability, is the real open problem, and it is a
separate design decision.

Nothing in VihuPlanet was modified by this sprint.
