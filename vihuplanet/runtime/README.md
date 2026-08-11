# VihuPlanet Runtime

The natural laws of VihuPlanet.

This is **not a screen.** It is the runtime the screens will be built
on — the Ether is simply its first tenant. Story Worlds, the Telescope,
the Dreaming Realm and the Companion are expected to arrive as siblings
of the Ether inside this same namespace, not as special cases carved
out of it.

```
VihuPlanet
├── Core       namespace · rng · signal · clock
├── Universe   the engine that composes everything below
├── Ether      the living space stories drift through
├── Stories    Story Entities · the Story Manager · presentation
├── Physics    drift · avoidance · attraction
├── Ambient    the universe's own restlessness
├── Focus      touch a story, it comes forward, it returns
├── Birth      a published story visibly joins the universe
└── Worlds     the Future World Engine (an inert plug point)
```

Nothing in here knows about VihuStudio, publishing, reading, or the
Rite. It is loaded with plain `<script>` tags in dependency order, has
no build step and no dependencies, and ships nothing but text — the
whole universe is procedural.

---

## The product decision this implements

Until VihuPlanet has enough Story Worlds and Storytellers, **published
stories do not belong to any Story World.** They become part of the
**Ether** — the living space of VihuPlanet, where stories drift,
waiting to be discovered.

There is **no "Create Story World" feature**, and there will not be
one. Worlds are an emergent property of a universe that already has
stories in it. `worlds/worldEngine.js` exists to hold that space open
without filling it.

## Phase 1 scope

Built: the Ether Renderer · the Story Manager · Ether Physics · the
Focus System · Story Birth · Ambient Behaviour · the runtime that
composes them.

Explicitly **not** built, and not to be added without a new decision:
Story Worlds · clustering · world emergence · Telescope integration ·
Companion integration · the reading experience · reactions · search ·
filters · ranking.

---

## Using it

The entire integration surface is four calls. `sandbox.js` is the
reference implementation.

```js
var universe = VihuPlanet.Universe.create({ mount: element });

universe.seed(stories);                      // already in the Ether
universe.publish(story, { from: point });    // joining, visibly, now
universe.start();
```

`seed` and `publish` are two different things and the difference is the
point. Seeded stories do not animate in, because they did not arrive —
they were already here when the child opened the page. `publish` is a
story joining VihuPlanet while somebody watches.

`from` is where the story leaves from, in view coordinates: pass the
position of the control the child actually pressed and the story rises
out from under their finger.

### Events

| Event | When |
|---|---|
| `story:added` / `story:removed` / `story:changed` | the Story Manager's contents changed |
| `story:birth` / `story:born` | a story started arriving · joined the Ether |
| `story:activate` | a story was touched (the Focus System listens) |
| `focus:begin` / `focus:opened` / `focus:closing` / `focus:closed` | the focus sequence |
| `ambient:shootingStar` | the universe did something on its own |
| `ether:resized` / `ether:grew` | the space changed shape or size |

### The Story Entity contract

`stories/storyEntity.js` is the seam of the whole runtime and the file
to read first. Physics moves Story Entities and knows nothing else
about them; renderers draw Story Entities and know nothing else about
them. A published VihuStudio project, a seeded demo story and whatever
a future Story World hands over are all the same shape once they are in
the Ether.

Renderers may read anything on an entity. They must write nothing.

---

## The three decisions that shaped this

### 1. The field is bigger than the screen, and it grows

The most important decision in the runtime, and it was made by looking
at the thing running rather than by reasoning about it. With the field
equal to the screen, two hundred stories is a wall of overlapping
cards — nothing calm, nothing discoverable. No amount of avoidance
fixes that: two hundred cards do not fit in one screen because they do
not fit.

So the Ether is larger than the view and grows with the number of
stories in it, at a fixed area per story. **Around twenty stories are
in view whether the universe holds twenty or six hundred.** The rest
are elsewhere, drifting, and they arrive in their own time — which is
also what "waiting to be discovered" actually requires. A story you can
already see is not waiting to be discovered.

The view sits at the field's origin and never moves, so growth extends
away from it silently. Every story is carried outward with the growth,
because otherwise stories added while the universe was small stay
bunched exactly where the view is (measured: 34 stories in view where
the density called for 16).

### 2. Presentation motion never feeds back into simulation

The bob — that tiny floating motion — is written to `bobX` / `bobY` and
added by renderers at draw time. It is never integrated into
`position`. Two stories bobbing near each other would otherwise shove
each other back and forth once a second through the avoidance rule.

### 3. Focus is one number

`entity.focusT`, 0 to 1. The Story Layer blends between the story's
place in the Ether and the centre of the view by it, so "moves
forward", "enlarges" and "straightens up" are all one motion. The Ether
Renderer softens the universe by the same number, so the background
fade cannot drift out of step. Physics stops simulating a story the
moment it stops drifting, so its place is *held* — not saved and
restored, simply never given away.

That is the whole of *"stories always return to the exact place they
occupied"*: there is no return animation to get wrong and no restore
step to miss. Verified bit-exact — a focused and closed story returns
to its position with a delta of exactly zero on both axes — while every
other story kept drifting underneath the entire time.

---

## What it costs

The runtime is built to leave running. Every technique the brief asked
for is in use and load-bearing:

- **Procedural everything.** No background images. Layers 1–3 of the
  Ether (background, nebula, stars) are baked once into an offscreen
  canvas and blitted as one `drawImage` per frame.
- **One radial sprite per colour**, scaled at draw time. Every soft
  thing in the universe is that sprite. `createRadialGradient` is
  expensive; `drawImage` is not.
- **A quarter-size buffer** for mist and ambient glow, refreshed every
  third frame. They are blurs; there is nothing in them a
  full-resolution pass can express.
- **Object pooling** for story nodes, ambient particles, shooting stars
  and the spatial grid's buckets. Nothing allocates inside the frame
  loop.
- **A uniform spatial grid** for avoidance — nine bucket reads per
  story instead of N² distance checks.
- **Culling and a hard node cap.** Only stories in view get DOM nodes,
  from a pool, capped at 64. Adding the five-hundredth story to the
  Ether creates no DOM at all.

Measured with Playwright in headless Chromium **without GPU
acceleration** — a floor, not a typical case; hardware compositing
makes all of these numbers better:

| | |
|---|---|
| 275 stories, 1280×800 | 60.8 fps, 16 cards drawn, 17 DOM nodes |
| 600 stories | same cost — story count does not affect it, only how many are in view |
| 275 stories, 390×780 | 3–6 cards drawn |
| JS per frame at 525 stories | physics 1.25 ms · Ether 0.07 ms · story layer 0.74 ms |

The cost of the universe is decided by the node cap and nothing else,
which is the promise that holds as VihuPlanet fills up.

### Two costs that were found by measuring

Both were fixed, and both are the kind of thing that is invisible in
code review:

- **Large `box-shadow` blurs.** A blur radius inflates the layer the
  compositor rasterises in every direction. The story card's original
  22px drop and 26px glow were quietly costing four times the pixels of
  the card itself — 16 fps against 25 fps for the same field. Only the
  focused card, of which there is ever one, is allowed to be expensive.
- **Full-resolution mist.** Three 1400px-radius blobs and a glow,
  composited per frame, halved the frame rate on their own.

---

## Accessibility

- `prefers-reduced-motion` is answered once, at the source: physics
  runs at `motionScale` 0 and the Ambient System stops twinkling,
  drifting and shooting stars. The universe becomes a still, complete
  picture rather than a moving one. Verified: zero movement over 1.5s.
  Focus and Birth still play — they are responses to something the
  child did, and removing them would make the interface look broken
  rather than calm.
- Every story is a real focusable element with `role="button"` and an
  `aria-label` of its title and creator. Enter and Space open;
  Escape closes; keyboard focus follows the story forward and back.
  Pooled nodes that are not carrying a story are `aria-hidden`,
  unfocusable and inert.
- Touching the space around an open story closes it — the same gesture
  as Escape, for a child who has never used one.

## Development harness

`sandbox.html` — mounts a universe, seeds it, and exposes publishing
and a cost counter. **It is not the product.** The real VihuPlanet
surface will mount the same universe with none of that chrome.

Serve the repository with any static server and open
`vihuplanet/runtime/sandbox.html`.

## Art direction

The Ether inherits Art Direction v1.0 (`artDirection/
illustrationRules.js`) and invents no colour. Its palette is the same
ink, dusk, cerulean, candle and paper the daylight Hero is painted
with, weighted for deep space — the Ether is a different hour of the
same world, not a different world. Stars are paper-cream, never white.
The palette is expressed as named roles rather than hexes so a future
Story World can re-tint the space without any renderer knowing that
worlds exist.
