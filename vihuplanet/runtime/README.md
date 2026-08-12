# VihuPlanet Runtime

The natural laws of VihuPlanet.

This is **not a screen.** It is the runtime the screens will be built
on — the Ether is simply its first tenant. Story Worlds, the Telescope,
the Dreaming Realm and the Companion are expected to arrive as siblings
of the Ether inside this same namespace, not as special cases carved
out of it.

```
VihuPlanet
├── Core       namespace · rng · signal · clock · camera · traveller
├── Universe   the engine that composes everything below
├── Ether      the living space · the currents · the renderer
├── Stories    Story Entities · Manager · Spirits · presentation
├── Physics    currents · avoidance · attraction
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

### Real published Stories

`vihuplanet/ether/` is the first real surface: it mounts this runtime
and fills it with the creator's actual published Stories. The
integration lives entirely outside the runtime —

| | |
|---|---|
| `js/etherFeed.js` | project records → the Story Entity contract |
| `js/creatorProjectStore.js` | `markPublished(id)` · `listPublished()` |
| `js/publishStudio.js` | one line stamping the Story on publish |
| `vihuplanet/ether/` | the page: mount · feed · deep links |

— and the dependency runs one way. `EtherFeed` knows about both
VihuStudio and VihuPlanet; the runtime knows about neither. Delete
`etherFeed.js` and the universe still runs, with no stories in it.
That is the correct blast radius for an integration.

**A Story is in the Ether when its record carries `publishedAt`.**
Before this, nothing anywhere recorded *which* Story had been shared —
`MagicCard.hasEverPublished` is one global boolean per browser and
cannot be attributed to a project. Stories published before this
shipped therefore have no arrival date and do not appear; there is no
honest way to invent one, and guessing would put Stories in VihuPlanet
that a child never chose to share.

**Deep links.** Every Story has a URL:
`vihuplanet/ether/?story=proj_...`. Opening one focuses that Story;
focusing a Story writes its link to the address bar, so the URL a child
copies is always the Story they are looking at (`replaceState`, because
drifting through the Ether is browsing, not navigating).

The link resolves for anyone whose Ether contains that Story — today,
the creator themselves, including on another device once their Magic
Card has synced. It does **not** yet resolve for a stranger, because
there is no public VihuPlanet to read from: `creator_projects` is a
private, card-gated backup. The URL contract is what a public feed will
need; the feed is what a stranger will need. The page handles the gap by
saying so rather than failing silently.

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

## Story Spirits

A published story is not a card floating in space. It is a **Story
Spirit**: a living presence in the Ether, with a soul (light), an
identity (its cover), movement (the currents carry it) and curiosity
(it reacts to being noticed).

Four layers, and only the first is ever guaranteed to be visible:

| | |
|---|---|
| **Spirit Aura** | light, seen from across the universe — the first thing a child notices, and for most Spirits at any moment the only thing |
| **Story Cover** | its identity, revealed by nearness, never by default |
| **Soft Glow** | its own pulse, its own colour, seeded from its id |
| **Flux** | it belongs to the Ether and travels the currents |

### Nearness is distance from the centre of the screen

The Traveller never moves — they *are* the centre, and the universe
turns around them. So "the Traveller approaches a Spirit" and "the
Spirit is near the middle of the screen" are the same sentence, and
`prox` (0 far, 1 met) is that sentence as a number. Everything about
discovery falls out of it:

```
prox 0.00   a light in the dark. No cover, no name — and NO DOM NODE
prox 0.35   the cover begins to fade up, small, still unnamed
prox 0.70   it has a name
prox 0.85   it has a maker
```

The picture always arrives before the name. Give a child both at once
and there is nothing left to approach for.

That a far Spirit has no element is the design and the performance
story at once: the cheapest way to render a glowing soul is to not make
a DOM node for it. Measured with 24 Spirits in view, 5 had bodies and
19 were pure light.

Two numbers were tuned by looking at the thing rather than reasoning
about it. `NEAR`/`FAR` started at 0.22/0.72 of the shorter edge, which
made most of the screen count as "near" — every Spirit in view resolved
at once and the Ether read as **a gallery of floating cards**, the exact
failure the sprint names. At 0.11/0.52 only what the Traveller has
actually turned toward becomes a picture. And each Spirit now gets a
small, bright, crisp **core** drawn at full resolution on top of its
quarter-resolution halo — blurred across four pixels there was nothing
in the middle of an aura to see, and a distant Spirit was reading as a
faint card rather than a soul.

## The Traveller

The Traveller is always at the centre and never moves. There is no
avatar and no object representing them — the Traveller *is* the centre
of the screen. What they can do is look.

- **Mouse** toward the edges turns the universe; the nearer the edge,
  the faster. The dead zone is most of the screen on purpose — reaching
  for a Spirit must not steer the universe by accident.
- **Arrow keys** turn it, a little more decisively than the mouse.
- **Touch** drags it one-to-one; the sky follows the hand.

Every input feeds the camera's **yaw** and **pitch**, never a position.
A full turn of yaw is exactly one field width, and the Ether already
wraps there — so turn far enough and the universe closes on itself,
with no seam and no end to walk into. Pitch is clamped: you can look up
and down, and then you have looked as far as there is.

Layers drawn as whole images tile horizontally to survive that, and the
soft buffers carry a much larger bleed than the sky because looking up
and down moves them further.

## The five stages

| | | where it lives |
|---|---|---|
| 1 · Discovery | Spirits are only glowing souls | runtime |
| 2 · Approach | turn toward one: glow rises, cover resolves, it reacts to being noticed | runtime |
| 3 · Meet | the universe **gently slows**, the background fades, the Spirit comes to the Traveller | runtime |
| 4 · Preview | cover, title, creator, what it knows about itself, and four actions | the Ether page |
| 5 · Enter | the Spirit opens like a portal and the Traveller steps in | the Ether page |

Stages 1–3 are the runtime's and the page takes no part in them. The
slowing is one eased number multiplying the time that reaches the
universe's own systems — never the ones responding to the child, because
slowing a response to a touch is just latency.

"The Spirit subtly reacts to being noticed" is a value that *lags*
behind nearness, so a Spirit swells a moment after the child turns
toward it rather than tracking the pointer like a cursor. Being noticed
is something that happens to it, not a readout of where the mouse is.

## The universe is alive before the first story

The test this runtime is held to: **if there were zero stories here,
would this still feel like a magical living universe?** Everything in
this section exists to make the answer yes, and none of it depends on
a story being present.

### Ether Currents — the invisible rivers

Stories do not drift randomly. The **Ether** moves, and everything
floating in it is carried. That is the difference between a screensaver
and a place: in a screensaver every object has its own arbitrary
heading and the eye reads noise; in a current, things near each other
move *together*, and the eye reads direction.

The field is the **curl of a scalar potential**, which is
divergence-free by construction. That is not mathematical decoration —
a flow field built the obvious way (noise for x, noise for y) has
sources and sinks, and everything in the Ether slowly collects in three
corners and stays. Nothing collects here, and the proof is calculus
rather than tuning. Three octaves of products of sines, so the
derivatives are exact: six `sin`/`cos` per sample, no noise tables.

The rivers are also **wide on purpose**, and the width was measured. At
the first attempt the smallest octave was 0.38 view-widths and stories
within 400px of each other aligned at only 0.20 (where 1.0 is identical
headings) — turbulence, not current. Widened, the field now measures:

| distance apart | flow alignment | story alignment |
|---|---|---|
| 200px | 0.91 | 0.55 |
| 400px | 0.77 | 0.46 |
| 800px | 0.36 | 0.25 |
| 1600px | −0.25 | 0.02 |

Neighbours travel together; opposite sides of the universe go opposite
ways. That is a river system.

### The Universe Camera

A living universe should never feel like a static webpage. Think of
watching the night sky while lying on grass — you are never completely
still, and neither is the sky.

The whole design is one constraint: **too slow to notice while you are
looking, unmistakable if you look away and come back.** Amplitude 2.5%
of the shorter viewport edge (about 20px on a laptop); periods of 50–80
seconds per axis on incommensurate rates, plus a much slower harmonic
so even the shape of the drift changes over minutes.

The camera is also what makes depth *real*. Every layer reads its
offset multiplied by that layer's parallax, so distant stars barely
move, mist slides, and foreground dust swims. Nothing has to animate
for the universe to have volume — it has volume because the viewpoint
moves and the layers disagree about how much.

Moving the camera never moves anything in the world. It is a change of
viewpoint, not of position, which is why focus still returns a story to
the exact place it occupied — verified with the camera 19px off centre,
a focused story still lands dead centre and a closed one returns with a
delta of exactly zero.

### Depth, in nine planes

`ether.depth` is the one source of truth, from 0 (infinitely far, never
moves) through 1.00 (the plane the stories live on) to 1.58 (in front
of them, and swimming):

```
0.10 far nebula   0.30 mist        0.46 light currents   1.00 stories
0.18 far stars    0.34 far dust    0.66 mid dust         1.12 near dust
                                                         1.58 foreground
```

The two layers past 1.00 are drawn on a **second canvas above the story
layer**, because a foreground drawn on the same canvas as the
background is not a foreground — it is a background with a higher
z-index in the wrong stacking context.

### Living light

Nothing is uniformly illuminated and nothing flashes.
`ether.ambient.breath` is a single value near 1.0 — three
incommensurate periods, ±6% — that every luminous layer multiplies into
its own brightness, so the whole Ether brightens and dims as one body
rather than as a set of independently animated effects. On top of it,
each nebula bloom carries its own slow pulse, each star its own
twinkle, each mote of dust its own faint throb, and each story's light
its own rhythm seeded from its id, so no two ever pulse together.

Small events keep an old sky feeling old: **star-blooms** (one star
somewhere quietly swelling and fading over several seconds, every 3–11
seconds) and **shooting stars** (every 26–74 seconds, always shallow
and always across the upper sky — a steep streak reads as a rocket, and
VihuPlanet removed its rocket on purpose).

### No story is ever alone

Every story writes a **light source** into `ether.lights`: a soft glow
field that the renderer draws and that the Ether Currents bend around,
so dust visibly curves as it passes. The deflection is perpendicular
rather than radial — dust sweeps *around* a story instead of being
repelled by it, which is what reads as the space curving rather than
the story pushing.

Neither the renderer nor the currents know that a light is a story.
`stories/storyLight.js` is a presenter in exactly the sense the Story
Layer is one, and when a Story World eventually wants to light the space
it occupies, it writes into the same array and everything downstream
already handles it.

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
| 425 stories, 1280×800, every layer on | 39 fps, 16 cards drawn, 16 DOM nodes |
| 60 stories | same cost — story count does not affect it, only how many are in view |
| 425 stories, 390×780 | 4 cards drawn |

The cost of the universe is decided by the node cap and the
full-screen composites, not by how many stories exist — which is the
promise that holds as VihuPlanet fills up.

### Four costs that were found by measuring

None of these are visible in code review; all of them were found by
profiling and fixed:

- **Large `box-shadow` blurs.** A blur radius inflates the layer the
  compositor rasterises in every direction. The story card's original
  22px drop and 26px glow were quietly costing four times the pixels of
  the card itself — 16 fps against 25 fps for the same field. Only the
  focused card, of which there is ever one, is allowed to be expensive.
- **Full-resolution mist.** Three 1400px-radius blobs and a glow,
  composited per frame, halved the frame rate on their own. They live
  in a quarter-size buffer now.
- **The story light field at full resolution.** A glow reaching 240px
  around each of two dozen stories is eight million composited pixels a
  frame: it took the universe from 60 fps to 17 on its own.
- **One full-screen composite too many.** Blitting the soft layers and
  the light field separately cost a second full-screen `lighter` pass.
  Merging them at a quarter scale costs sixty thousand pixels, and the
  merge is *free of visual consequence* because every layer above the
  baked sky is additive and addition is commutative — the order only
  matters for the veil, which is paint rather than light, and is still
  last.

Together: 17 fps → 41 fps, with more layers than before.

### The bug that was invisible until the camera moved

Buffers drawn at a camera offset need a **bleed margin**, or they stop
short of the edge the camera moved away from and the universe gets a
dark frame around it — the mist and nebula simply ending before the
screen does. Both the baked sky and the soft buffers now carry 40px of
bleed on every side. Worth knowing before adding any future layer that
lives in a buffer.

---

## Accessibility

- `prefers-reduced-motion` is answered once, at the source: physics
  runs at `motionScale` 0, the Universe Camera's amplitude is 0, and
  the Ambient System stops twinkling, drifting, dust and shooting
  stars. The universe becomes a still, complete picture rather than a
  moving one. Verified: camera, stories and dust all move exactly
  0.0000 over 2.5s. A drifting viewpoint is precisely the kind of
  unrequested motion the setting exists to silence.
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
and a cost counter. **It is not the product**, and it no longer behaves
as though it were: the panel is closed at load and the universe has the
whole screen, with one small mark in the corner. Press **D** or click
it to open. The real VihuPlanet surface will mount the same universe
with none of that chrome.

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
