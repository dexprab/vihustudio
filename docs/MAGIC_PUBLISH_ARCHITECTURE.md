# Magic Publish — Product & Implementation Proposal

**Status: proposal only. No code was written for this document.**

Follows the precedent of `docs/ENGINE_V2_PROMOTION_STRATEGY.md`,
`docs/SCENE_ADAPTER_ARCHITECTURE_ANALYSIS.md`,
`docs/COMPANION_INTELLIGENCE_ARCHITECTURE.md`, and
`docs/STORY_REPLAY_ARCHITECTURE.md` — investigation-and-design documents
produced *before* implementation, gated behind `CLAUDE.md`'s standing rule
that architecture changes require explicit approval.

Every recommendation is classified **Already Exists** / **Needs Extension** /
**New Capability**.

---

## 0. The finding that determines everything else

**Magic Creation does not need any history at all.**

Read the desired sequence again, carefully:

```
Blank Page → Background Appears → Character Appears →
Decorations Appear → Text Draws Itself → Finished Page
```

That is not a record of what the child did. A child does not author a page
in that order — they drop a sticker, undo it, nudge it four times, change
its colour twice, come back tomorrow and move it again.

**That sequence is a choreographed decomposition of the *finished* page,
peeled apart by layer.** Every frame in it is computable from the final
saved state alone.

So the answer to the brief's own question — *"Can this be delivered without
introducing a new platform capability?"* — is **yes, emphatically.** No
snapshots. No timeline. No autosave hook. No new persistence. Nothing that
touches `_writeStorage()`, `AppState`, or the hot path.

**And this is not a shortcut — it is the better product.** The brief's own
principles say so:

> *Magic over accuracy. Delight over completeness. Wonder over explanation.*
> *The replay should not faithfully reproduce every editing operation.*

A truthful history replay would show forty nudges, a colour changed six
times, and a sticker deleted twice. It would be honest and it would be
boring. A layer reveal is *always* a clean story, on every page, for every
child, including the child who made the page in ninety seconds.

**Recommendation: build Magic Creation from the final state. Never from
history.** §7 shows how a future Replay timeline plugs into the exact same
machinery later without discarding any of this work.

---

## 1. Product proposal

### 1.1 The moment we are building

The brief names it precisely: *"Wait… how was this created?"*

That question is only asked when the audience sees something that could not
plausibly have been assembled by hand in the time available. A finished page
does not provoke it. A page **assembling itself** does — because it exposes
structure the viewer did not know was there.

The product is therefore not "a video of a story." It is **the reveal that
the story has layers.**

### 1.2 What Publish becomes

Publishing stops being an export step and becomes a **curtain call**.

Today a creator chooses a destination and receives one file. Tomorrow they
press Publish once and receive a small collection of things that all say the
same thing in different formats: *look what you made, and look how it came
together.*

### 1.3 What we must never build

| Never | Why |
|---|---|
| A screen recorder | Explicit in the brief, and structurally avoided (§4.2) |
| Anything the creator operates | No record button, no editing, no "capture this" |
| A watermark over a child's art | Branding is a closing card, never an overlay (§5.6) |
| Something named "Replay" | It is not a replay. Calling it one promises a fidelity we deliberately do not deliver, and invites *"that's not how I made it"* |

---

## 2. Current platform assessment

### 2.1 What already exists — and it is almost all of it

| Capability | Where | Relevance |
|---|---|---|
| **Deterministic slide renderer** | `SlideRenderer.buildPayload(slide)` + `.render()` | Same slide in, same pixels out. Every Magic frame is one call. |
| **Off-screen rendering** | `ThumbnailEngine.generate()` (`js/thumbnails.js`), `_renderSlideInto()` (`js/storyDestinations.js`) | Rendering an arbitrary slide to an arbitrary canvas is solved twice over. |
| **Per-payload theme override** | `_artworkTheme(s)` (`renderer/slideRenderer.js:82`) returns `s.artworkTheme` **directly if set** | The key to peeling World-owned layers — §4.3. Already proven by Screen 2's preview carousel. |
| **A video composer** | `ReelComposer.compose(pages, opts)` (`js/reelComposer.js:175`) | Takes `[{bitmap, narrationBuffer, holdMs}]` and `{width,height,fps,transition,transitionMs}`. **This is exactly the API a build-up animation needs.** |
| **A destination registry with a public `register()`** | `js/storyDestinations.js:606`, contract `createCanvas`/`renderPage`/`encodePage`/`finish` | Sprint 9.0.4 built this specifically so new outputs plug in *without editing the file*. Magic Creation is the case it was designed for. |
| **Optional presentation hooks on a destination** | `publishMessages`, `finishingMessage`, `progressNoun` | Added for Story Reel. Magic Creation needs exactly these and nothing more. |
| **A uniform render tree** | `_sceneObject()` (`renderer/slideRenderer.js:3596`) → `getSceneElements()`/`getTextElements()` | Every object normalized to `{id,type,label,owner,visible,visual,bbox}`. **This is the object inventory the reveal choreographs.** |
| **Paint order already resolved** | `_naturalStoryOrder()` / `getReorderableIds()` | We already know what sits behind what. Reveal order follows paint order for free. |
| **Human-readable object names** | `FRIENDLY_TYPE` (`js/objectStrip.js:86`) | Needed for Magic Strip captions. |
| **Per-page narration** | `slide.metadata.narration` (Voice Ship 1) | Magic Creation can carry the child's own voice. |
| **Ambient audio beds** | `AudioManager` Foundation layers (`assets/audio/foundation/`) | Five 30s loops already licensed, mixed, and shipped. §5.5. |
| **Companion art** | `assets/lumo/`, bonded Story Companions | A closing cameo needs no new assets. §5.6. |
| **A five-stage publish flow** | `js/publishStudio.js` | The stage machine already supports async finishes and per-destination copy (Story Reel proved it). |

### 2.2 What is genuinely missing

Three things, and only three:

1. **A layer-peeling function.** Given a slide, produce an ordered series of
   slides revealing progressively more of it. **New Capability, small.**
2. **A crossfade transition in the composer.** `ReelComposer` currently
   offers `page-turn` and `none`. Elements should *arrive*, not cut.
   **Needs Extension, ~40 lines.**
3. **A publish bundle.** Today: choose one destination, receive one file.
   The brief wants one press, several artifacts. **Needs Extension** to
   `PublishStudio`, no change to the destination contract.

Everything else on the brief's investigation list — serialization,
autosave, state management, the asset system, scene runtime — needs **no
change whatsoever**. That is worth stating plainly: the modules most at risk
in this platform's history are the ones this feature does not touch.

---

## 3. Architecture proposal

### 3.1 Shape

```
  PublishStudio  ──press Publish once──▶  bundle: [book, cover, magic, strip]
                                                │
                                                ▼
                                  StoryDestinations (registry)   [Already Exists]
                                                │
                        ┌───────────────────────┼───────────────────────┐
                        ▼                       ▼                       ▼
                     'book'                'magic'                 'strip'
                 [Already Exists]      [New destination]       [New destination]
                                             │                       │
                                             └──────────┬────────────┘
                                                        ▼
                                          js/magicReveal.js               [New]
                                          revealStages(slide) → [slide,…]
                                                        │
                                    ┌───────────────────┴──────────────┐
                                    ▼                                  ▼
                        SlideRenderer.render()              ReelComposer.compose()
                          [Already Exists]                    [Needs Extension]
```

**One new module, two new destinations, one composer extension.** Nothing
else moves.

### 3.2 `js/magicReveal.js` — the only genuinely new logic

An IIFE attached to `window` like every other module. One primary export:

```
revealStages(slide) → [ {slide, label, holdMs}, … ]
```

It clones the slide, strips it back to near-empty, then adds groups back in
paint order. It **never mutates the real slide** — cloning is the whole
safety story, and it is what lets this run during Publish with zero risk to
what the child is looking at.

**Classification: New Capability, ~200 lines.**

### 3.3 The stages

Derived from the render tree, not hand-authored:

| # | Stage | Composition |
|---|---|---|
| 1 | Paper | Page background only — no artwork, no objects, no text |
| 2 | The World arrives | Theme-owned chrome: wall tone, Frame, Place, Layer Pack decorations |
| 3 | The picture arrives | `slide.image` / Place content |
| 4 | Decorations arrive | Story-owned stickers, shapes, doodles — in paint order, in small batches |
| 5 | Words arrive | Story text and text objects, drawing themselves |
| 6 | Rest | The finished page, held still |

**Stages collapse automatically when a page has nothing for them.** A page
with no stickers skips stage 4 entirely rather than showing a beat where
nothing happens. §9.2 covers the sparse-page case.

### 3.4 How each group is suppressed — no renderer changes

This is the part that needed verification rather than assumption. All four
mechanisms already exist:

| Group | Mechanism | Verified |
|---|---|---|
| **Story-owned stickers** | `clone.metadata.stickers = stickers.slice(0, k)` | Plain array on the slide |
| **Scene blueprint elements** (Cover/Hook/End) | `SceneEngine.setVisibility(clone, id, false)` → `elementOverrides[id].visible`, honoured at `slideRenderer.js:4236` | Yes |
| **World-owned Layer Pack objects** | Clone the theme, filter `layerPack`, set `clone.artworkTheme = filteredTheme` — `_artworkTheme(s)` returns `s.artworkTheme` **directly if set** (`slideRenderer.js:82-88`); `LayerEngine.render()` gates on `layer.visible !== false` | Yes — the exact mechanism Screen 2's preview carousel already uses in production |
| **Story text** | `clone.storyBeat = ''` | Plain field |

**Zero changes to `renderer/slideRenderer.js`.** That matters more than it
sounds: that file carries three canonical Museum Gallery render hashes that
every ship in this project's history is checked against. Magic Publish
should not be the first feature to risk them.

### 3.5 The one real trap

Stripping a page can reveal **authoring chrome that must never appear in a
Magic Creation** — most obviously the *"Tap to add your artwork"* dashed
placeholder that draws when a Place has no picture.

The reveal must render a stripped Place as genuinely empty, not as an
invitation. Recommended: a `suppressPlaceholders` flag threaded through the
render payload — **Needs Extension, ~5 lines**, and the smallest possible
renderer touch. This is the one place the "no renderer changes" claim bends,
and it is disclosed rather than glossed.

---

## 4. Answers to the brief's questions

**1. What is the smallest implementation?**
One new module (`js/magicReveal.js`), one new destination, one composer
transition, one 5-line renderer flag. No new persistence, no new backend, no
new dependency, no schema change.

**2. Can this be delivered without a new platform capability?**
**Yes.** `StoryDestinations.register()` exists precisely for this, and the
render/compose path is already shipped end to end. Magic Creation is a new
*output*, not a new *capability*.

**3. Which modules already provide most of it?**
`SlideRenderer` (frames), `ReelComposer` (video), `StoryDestinations`
(plumbing), `PublishStudio` (flow), `_sceneObject()` (the object inventory),
`AudioManager` (music), `ThumbnailEngine` (the off-screen pattern).

**4. What should Publish produce?**

| Artifact | Cost | Notes |
|---|---|---|
| **Book** | Already ships | PDF, unchanged |
| **Cover** | Nearly free | One high-res render of the first page. `_renderSlideInto` already does this. |
| **Magic Creation** | The work | ~20-30s video |
| **Magic Strip** | Small | Static image, §6 |

I would **not** add more. Four artifacts is already a generous celebration;
a fifth turns a curtain call into a file manager.

The Carousel and Reel destinations stay registered and reachable as *"other
formats"* — nothing shipped is removed.

**5. Visual language** — §5.
**6. Magic Strip** — §6.
**7. Evolution into Replay** — §7.
**8. Success criteria** — §8.

---

## 5. Magic Creation specification

### 5.1 The structural guarantee

The audience can never see the cursor, panels, toolbar, or editor chrome —
**not because we are careful, but because none of it exists in these
pixels.** Every frame is `SlideRenderer.render()` onto an off-screen canvas.
The editor is not involved. There is nothing to accidentally leak.

This is worth saying out loud in §10's risk register as a *strength*: the
brief's hardest requirement is satisfied by construction.

### 5.2 Arrival, not appearance

Objects should **arrive**. Recommended per-element motion:

- **Fade in** over ~350ms, paired with
- **a slight rise** (~2% of page height) and
- **a gentle overshoot-and-settle** on scale (0 → 1.04 → 1.00)

The overshoot is what makes it feel *placed by hand* rather than switched
on. It is one easing curve, applied uniformly.

**Backgrounds do not arrive — they wash in.** A full-bleed fill fading up is
right; a full-bleed fill scaling up is not.

### 5.3 Text draws itself

The brief calls this out specifically, and it is the one element that should
behave differently. Recommended: **word-by-word**, not character-by-character
— characters read as a computer terminal, words read as a story being told.
~120ms per word, with the whole line settling into place at the end.

**Needs Extension:** the renderer draws a full string. Slicing the string
per frame and re-rendering is sufficient and needs no renderer change —
`_drawStyledTextLine` already handles whatever it is given.

### 5.4 Pacing

| Beat | Duration |
|---|---|
| Per element arrival | 350ms motion, 250ms breath |
| Per stage | 0.8–1.4s |
| Rest on the finished page | 1.2s |
| Per page total | 4–6s |
| Closing card | 2.5s |

A four-page story lands at roughly **20–25 seconds**. That is deliberately
short. The goal is to be rewatched, not endured.

**Pages are separated by the existing `page-turn` transition** — already
built, already tested, and thematically perfect for a storybook.

### 5.5 Sound

Three tiers, in priority order:

1. **The child's own narration**, if the page has it (`slide.metadata.narration`).
   Nothing beats this and it already exists.
2. **An ambient bed** from `AudioManager`'s Foundation layers — five 30s
   loops already licensed and shipped. **Already Exists**; needs only a
   mixdown path into `ReelComposer`'s existing audio destination.
3. **Silence**, correctly handled — `compose()` already feeds its audio
   track real silence, a fix made after a silent reel composed to zero bytes.

### 5.6 Branding — a closing card, never an overlay

```
        [ story title ]
     ✨ Created in VihuPlanet ✨
```

Held for 2.5s, after the art, over a clean background. A child's page is
never covered.

**Optional, and I think worth it:** the creator's own bonded Story Companion
appears on the closing card. It costs nothing (the art ships), it is
canon-correct (a Story Companion belongs to that Creator), and it turns a
logo into *their* logo. A Traveller with no companion gets the card without
one — no gate, no prompt, no missing-asset gap.

---

## 6. Magic Strip specification

A single still image, because a still image is the thing that survives being
forwarded, printed, and stuck on a fridge.

**Frames: six.** Five reveal stages plus the finished page. Six divides
cleanly into both layouts and matches the stage model exactly — the frame
selection *is* the stage list, so there is no separate selection algorithm
to write.

**Two layouts, one render:**

| Layout | Shape | For |
|---|---|---|
| **Strip** | 1 × 6, wide | Sharing, banners |
| **Grid** | 2 × 3, portrait | Printing, fridges |

**Visual treatment:** a film strip. Sprocket holes down both edges, frames
separated by a thin dark gutter, small numerals. It is instantly legible as
*"stages of making"* without a caption explaining it, and it is cheap in
canvas — rectangles and rounded holes.

**Branding:** a footer bar carrying the story title and *"Made in
VihuPlanet"*. Inside the strip's own chrome, never on the artwork.

**A page with too few stages** (§9.2) drops to a 1 × 3 or 1 × 4 strip rather
than padding with duplicates.

**Classification: New Capability, ~150 lines** — a compositing routine over
frames the reveal already produced.

---

## 7. Publish experience redesign

### 7.1 Today

```
Read My Story → Almost Ready → Choose Story Destination → Publishing → Celebration
```

One destination, one file.

### 7.2 Proposed

```
Read My Story → Almost Ready → Publishing → Celebration
                                    │
                          ✨ Preparing your Story…
                          ✨ Creating Magic…
                          ✓ Book Ready
                          ✓ Magic Creation Ready
```

**Choose Story Destination becomes optional**, reachable as *"Other
formats"* from Celebration for a creator who specifically wants a Carousel
or a Reel. The default path has no fork in it at all.

Celebration presents four things to keep, with the Magic Creation
**already playing**. Not a download button — a playing video. The
celebration *is* the artifact.

**Classification: Needs Extension.** `PublishStudio` already runs an async
`finish()` and already supports per-destination copy (Story Reel proved
both). Running several destinations in sequence is a loop over machinery
that exists.

### 7.3 The honest cost

`ReelComposer` records in **real time** — a 25-second Magic Creation takes
~25 seconds to film. Publishing gets slower.

Mitigations, in order of preference:

1. **Book and Cover first, and shown immediately.** The child has something
   real within a second or two. Magic Creation lands while they are already
   looking at their book.
2. **Honest progress copy** — the brief's own `✨ Creating Magic…` is
   exactly right, and better than a percentage.
3. **Never block Celebration on it.** If filming fails, the child still gets
   a book and never sees an error about a thing they did not ask for.

---

## 8. Evolution into Replay

This is where the MVP earns its keep rather than being thrown away.

**The seam is the frame source.**

```
MVP:     revealStages(slide)        → [slide, slide, slide, …]
Later:   ReplayStore.framesFor(page) → [slide, slide, slide, …]
                                              │
                                              ▼
                              the same composer, the same destination,
                                    the same output, unchanged
```

`revealStages()` returns a list of slide states. A Replay timeline (per
`docs/STORY_REPLAY_ARCHITECTURE.md`) *is* a list of slide states. The
composer, the destination, the transitions, the Magic Strip, the branding,
the pacing — every line of it survives.

**Three evolution steps, none discarding earlier work:**

1. **MVP** — derived stages only.
2. **Hybrid** — real history where it exists, derived reveal where it does
   not. A story authored before Replay shipped still gets a Magic Creation.
   This is not a fallback; it is the permanent right answer, because a page
   created in one sitting has no interesting history either.
3. **Curated** — the differ picks the *interesting* historical moments and
   the reveal fills the gaps. The child's real journey, edited for wonder.

**And the ordering matters commercially as well as technically.** Building
Magic Publish first means the visible product ships in weeks rather than
after a persistence project. Replay then arrives as an *upgrade to something
people already love* rather than as infrastructure asking to be believed in.

---

## 9. Risks

### 9.1 Technical

| Risk | Severity | Mitigation |
|---|---|---|
| **Real-time recording makes Publish slow** | High | §7.3. Book first, honest copy, never block. |
| **Stripped pages reveal authoring placeholders** | High | §3.5's `suppressPlaceholders` flag. Must be caught in verification, not by eye. |
| **Memory: N frames × M pages of full-res canvas** | Medium | Render → encode → release per frame. Never accumulate bitmaps. The composer already consumes frames streaming. |
| **webm rather than mp4** | Medium | Pre-existing and already known. `MIME_CANDIDATES` orders webm first; mp4 is present but never reached on Chromium. |
| **Theme-clone peeling is subtle** | Medium | Proven in production by Screen 2's carousel, but it is a non-obvious mechanism and deserves its own test. |
| **Word-by-word text re-renders per frame** | Low | Text rendering is cheap; the frame budget is dominated by images. |

### 9.2 Product

| Risk | Severity | Mitigation |
|---|---|---|
| **A sparse page has no journey** | High | A page with fewer than three revealable elements should merge stages, not show empty beats. Some pages simply get a shorter reveal — that is fine and should not be padded. |
| **The magic wears off** | High | Every page revealing identically is the failure mode. Vary arrival order and easing slightly per page, seeded deterministically so a rewatch is identical. |
| **It becomes an advert for the tool** | Medium | §5.6 — branding is a closing card, never an overlay. If it reads as marketing, it stops being the child's. |
| **Expectation mismatch** | Medium | Never call it a replay. Never imply it shows what they did. *"Magic Creation"* promises wonder, not fidelity — and that is the honest promise. |
| **Slower publishing dims the celebration** | Medium | §7.3. |
| **We optimise for the shareable output** | Low but real | The test in §8 is *creator* delight first. If a child does not want to watch their own page assemble itself, no amount of polish downstream will fix that. |

---

## 10. Success criteria

Product, not technical.

| # | Signal | Target | Why it is the right measure |
|---|---|---|---|
| 1 | **Watch-through rate** — creator watches their own Magic Creation to the end | > 70% | The single best proxy for delight. If a child will not watch their own, nobody will. |
| 2 | **Rewatch rate** — watched more than once in the same session | > 30% | Rewatching is wonder. Watching once is curiosity. |
| 3 | **Shown to someone** — Magic Creation or Strip kept/shared vs book alone | rising | Directly measures *"how was this made?"* |
| 4 | **Manual creative assets produced by creators** | **zero, permanently** | The brief's own promise. Any creator hand-making a strip is a defect. |
| 5 | **Time from Publish to something worth showing** | < 90s | Celebration decays with delay. |
| 6 | **Second-story latency** — time to the creator's next publish | falling | The strongest signal that publishing became a reward rather than an ending. |
| 7 | **Qualitative** — does anyone ask how it was made? | any at all | The brief's own stated test, and worth collecting verbatim. |

**Deliberately not measured:** time spent authoring, edit counts, session
length. Those describe the worker, not the work — the same line
`docs/STORY_REPLAY_ARCHITECTURE.md` §9.1 draws.

---

## 11. Recommended roadmap

### Phase 1 — Magic Creation exists *(the whole MVP)*

`js/magicReveal.js` + a `magic` destination + a crossfade transition +
`suppressPlaceholders`. Publish still uses today's single-destination flow;
Magic Creation is simply one of the choices.

*Delivers:* the moment. A page assembling itself, downloadable.
*Risk:* low — additive, registry-based, nothing shipped is modified.

### Phase 2 — Magic Strip

The still image, from frames Phase 1 already produces.

*Delivers:* the artifact that survives forwarding and printing.
*Risk:* low — pure compositing.

### Phase 3 — Publish becomes a celebration

The bundle: one press → Book, Cover, Magic Creation, Magic Strip.
Celebration plays the Magic Creation automatically.

*Delivers:* the experience in the brief, complete.
*Risk:* medium — the only phase that modifies a shipped flow.

### Phase 4 — Wonder polish

Companion cameo, ambient bed, per-page variation, arrival-order character.

*Delivers:* the difference between impressive and magical.
*Risk:* low, and independently droppable.

### Phase 5 — Real history *(only if Replay ships)*

Swap the frame source. Hybrid by default. §8.

### Explicitly out of scope

Direct posting to any platform, analytics dashboards, creator-editable
reveals, per-object timing controls, multi-story compilations, and any
authoring-side capture UI.

---

## 12. Summary

1. **Magic Creation needs no history.** The reveal is a decomposition of the
   final page by layer, computable from saved state alone. (§0)
2. **This is the better product, not a shortcut** — a true history replay
   would be honest and boring. (§0)
3. **No new platform capability is required.** `StoryDestinations.register()`
   exists for exactly this. (§4)
4. **One new module, two new destinations, one composer transition, one
   5-line renderer flag.** (§3)
5. **`ReelComposer.compose(pages, opts)` already takes exactly the shape a
   build-up animation produces.** (§2.1)
6. **All four suppression mechanisms already exist**, including the
   theme-clone trick already proven in production. (§3.4)
7. **The one real trap is authoring placeholders leaking into the reveal.**
   (§3.5)
8. **Publish should produce four things and stop there.** (§4)
9. **Branding is a closing card, never an overlay.** (§5.6)
10. **The MVP is the foundation, not a detour** — Replay later swaps the
    frame source and nothing else. (§8)
11. **Ship Magic Publish first, Replay second.** Replay then upgrades
    something people already love. (§8)

---

*No implementation has begun. This document is a proposal awaiting approval
under `CLAUDE.md`'s standing rule that architecture changes require explicit
sign-off.*
