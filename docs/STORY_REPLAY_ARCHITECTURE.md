# Story Replay — Discovery & Architecture Proposal

**Status: proposal only. No code was written for this document.**

Follows the precedent of `docs/ENGINE_V2_PROMOTION_STRATEGY.md`,
`docs/SCENE_ADAPTER_ARCHITECTURE_ANALYSIS.md`, and
`docs/COMPANION_INTELLIGENCE_ARCHITECTURE.md` — investigation-and-design
documents produced *before* implementation, gated behind `CLAUDE.md`'s
standing rule that architecture changes require explicit approval.

Every recommendation is classified **Already Exists** / **Needs Extension** /
**New Capability**, and cites the module it rests on.

---

## 0. Verdict, up front

**The hypothesis is half right, and the half that's wrong changes the entire
architecture.**

> *"VihuStudio already understands the author's work through structured data.
> If that is true, Replay should be generated from semantic authoring events
> rather than captured pixels."*

The first sentence is **true and then some** — VihuStudio's understanding of a
project is complete, semantic, and already serializable in one call.

The second sentence rests on a premise that is **false**: there are no
semantic authoring events. VihuStudio has **state, not events**. The one
dispatch that fires on every mutation — `PageRuntime.notify()` — takes **zero
arguments**. It says *"something changed, everyone refresh."* It does not say
what changed, to which object, from what, or by whom.

So the honest conclusion is neither *"just wire up the events"* nor *"you'd
need a screen recorder."* It is:

> **Replay should be a snapshot timeline, with events *derived by diffing*,
> not captured at the call site.**

That recommendation is not a compromise. It is the better architecture on
this codebase, for reasons set out in §3.

**Should Replay exist as a platform capability?** Yes — but not primarily
because it makes reels. §1 argues its intrinsic value is elsewhere, and §3.5
makes the strongest architectural case: **a snapshot timeline is also the
global undo/redo the platform is currently missing, and which
`docs/COMPANION_INTELLIGENCE_ARCHITECTURE.md` §7.4 named as the hard blocker
on Companion actions.** One foundation, two features, plus recovery.

---

## 1. Product vision

### 1.1 What Story Replay should become

**A record of growth, not a highlight reel.**

The value that survives when nobody shares anything:

| Audience | What Replay gives them | Why it matters |
|---|---|---|
| The child | *"Look how much I changed it"* | Children are shown their output constantly and their **process** almost never. Seeing effort made visible is the thing that builds a creative identity. |
| The parent | Evidence of effort, not just a nice picture | The single most common parent question about a child's creative work is *"did they actually do this?"* Replay answers it without anyone asking. |
| The teacher | A process portfolio | Process-over-product assessment is standard pedagogy and currently impossible to capture without a teacher watching over a shoulder. |
| The platform | Version history, recovery, undo | §3.5. This is the largest engineering payoff and it has nothing to do with sharing. |

### 1.2 What Story Replay should never become

- **A screen recorder.** Explicit in the brief and correct — pixels are the
  wrong representation (§5).
- **A social feature first.** Reels/Magic Strips are *consumers* of Replay
  (§6), not its purpose. If Replay only justifies itself by producing shareable
  video, it should not be built.
- **Surveillance.** This is a record of a child's behaviour. §9.1 treats that
  as the most serious risk in the document, ahead of every technical one.
- **Something the creator operates.** No record button, no timeline scrubber
  in the authoring UI, no "start capturing." The brief is right:
  *"Replay should emerge naturally from the platform."*
- **Analytics.** *"How long did they take, how many undos"* is a different
  product with different ethics. Replay describes the **work**, not the
  worker.

---

## 2. Current platform assessment

### 2.1 What already exists — and it is a great deal

| Capability | Where | Relevance to Replay |
|---|---|---|
| **Complete semantic serialization** | `ProjectManager.serialize()` (`js/projectManager.js`) | Returns the *entire* project — every page's `pageType`, `image`, `storyBeat`, and full `metadata` bag, plus `theme`/`artworkTheme`/`themeOptions`. This **is** a replay frame. |
| **A debounced write pipeline** | `markDirty()` → 500ms `AUTOSAVE_DEBOUNCE_MS` → `_writeStorage()` | Already runs on every meaningful change. Replay is this pipeline **appending instead of overwriting**. |
| **Assets are references, not bytes** | Draft Asset Architecture (`js/assetStore.js`) | `imageToDataURL()` returns `slide._imageDataURL` verbatim — which since Phase C is a small `vihu-asset:` **reference string**. This is what makes snapshots cheap. See §2.3. |
| **A deterministic renderer** | `SlideRenderer.buildPayload(slide)` + `.render()` | Same slide in, same pixels out. Any historical state can be re-rendered exactly. |
| **Off-screen rendering, twice over** | `ThumbnailEngine.generate()` (`js/thumbnails.js`), `_renderSlideInto()` (`js/storyDestinations.js`) | Rendering an arbitrary slide to an arbitrary canvas is a solved problem. |
| **A video composer** | `ReelComposer.compose()` (`js/reelComposer.js`) | Already turns *N rendered pages* into a video with transitions. Replay is the same composer over *N versions of one page*. |
| **Durable multi-tier storage** | `CreatorProjectCache` (IndexedDB) → `CreatorProjectSync` → Supabase `creator_projects` | Local-first, cloud-backed, owner-scoped RLS, versioned with `expectedUpdatedAt`. |
| **A uniform object model** | `_sceneObject()` (`renderer/slideRenderer.js:3596`) | Every rendered object normalized to `{id,type,label,owner,moveable,editable,visible,visual,bbox}`. |
| **Human-readable object names** | `FRIENDLY_TYPE` (`js/objectStrip.js:86`) | Needed to narrate a diff in child-facing language. |

**The rendering half of Replay already ships.** That is not an
exaggeration — §5 shows the render path needs no new engine at all.

### 2.2 What does not exist — the decisive gap

**There is no event system of any kind.**

Verified, not assumed:

- No `eventBus.js`, no `history.js`, no `undo.js` anywhere in `js/` or
  `tools/world-builder-v2/js/`.
- Zero `new CustomEvent` / `dispatchEvent` for application events (the two
  hits are `emojiPicker`/`pageDesigner` firing a DOM `input` event so a
  textarea's own handler runs — unrelated).
- **`PageRuntime.notify()` takes no arguments** (`js/pageRuntime.js:125`). It
  calls refresh on five panels and returns. There is no payload, no verb, no
  subject.
- **No global undo/redo.** Only local per-tool stacks: doodle strokes
  (`js/cardDesigner.js`), Picture Studio brush strokes and `_preCropSnapshot`
  (`js/pictureStudio.js`).
- **The dirty signal is scattered, not centralized.** `markDirty()` is called
  **47 times across 11 files**. `js/sceneEngine.js` — the actual object
  mutation API — calls it **zero** times; its callers do. There is no single
  place that knows *"a mutation just happened."*

That last point is the single most important architectural fact in this
document, and §3.1 turns it into the recommendation.

### 2.3 One accidental enabler worth naming

**Draft Asset Architecture made Replay affordable, and nobody planned that.**

Before it, `serialize()` embedded every uploaded picture as base64 — a
snapshot was megabytes, and a per-change timeline was flatly impossible on a
`localStorage` budget. After it (`docs/DRAFT_ASSET_ARCHITECTURE.md`), an
image in a snapshot is a `vihu-asset:creator:<projectId>:<assetId>` string of
~60 characters, with the bytes living once in IndexedDB and Supabase Storage.

**A hundred snapshots of a project now reference the same picture a hundred
times at ~60 bytes each, instead of storing it a hundred times.** That is the
difference between "obviously infeasible" and "cheap," and it already
shipped.

### 2.4 One real storage trap in `serialize()`

`serialize()` also emits `thumbnail: s.thumbnail || null` — and unlike
`image`, that **is** real bytes: a PNG data URL from
`thumbCanvas.toDataURL('image/png')` (`js/thumbnails.js:61`).

Replay snapshots must **drop `thumbnail`**. It is derived, regenerable data
(`ThumbnailEngine` reproduces it from the slide), and this codebase has
already made exactly this call once before, deliberately: Draft Asset
Architecture Phase D excluded `slide.thumbnail` from asset migration on the
grounds that it is *"small, derived, regenerable data."* The same reasoning
applies with far more force here, where it would be stored N times.

**Classification: Needs Extension** — a snapshot-shaping step, not a change
to `serialize()` itself (which must keep emitting thumbnails for the live
session).

---

## 3. Recommended architecture

### 3.1 Observe, don't publish — and the 47 call sites are the proof

The brief asks directly: *"Should Replay observe the platform? Or should
existing engines explicitly publish replay events?"*

**Observe. Decisively.**

The evidence is `markDirty()`: 47 call sites, 11 files, and the mutation API
itself doesn't call it. If merely *marking the project dirty* — a one-line,
zero-argument obligation — is already scattered across 47 hand-maintained
sites, then requiring every future mutation to also publish a **correctly
shaped, correctly typed, correctly attributed replay event** will drift
within one sprint. Some will be missed, some will be wrong, and nothing will
fail loudly when they are. The Replay would quietly become a lie.

Worse, it is a change to *every* engine — precisely the "duplicate workflows"
and "unnecessary abstractions" the brief warns against.

**Instead: one observer, at one chokepoint, deriving everything.**

`_writeStorage()` is that chokepoint. Whatever the 47 dirty-marking sites do
or forget, the persist path is the one place the platform reliably declares
*"here is the project's complete state right now."* Hooking it captures every
change by construction — including changes made by code that does not exist
yet.

**Classification: New Capability** (the observer), resting entirely on
**Already Exists** infrastructure.

### 3.2 Where Replay lives

The brief offers five candidates. Assessed against the codebase:

| Candidate | Verdict |
|---|---|
| Part of **Publish** | **No.** Publish is an output stage. Replay must capture the whole authoring life, most of which happens long before Publish, and much of which never reaches it. |
| Part of **Studio Runtime** | **No.** `PageRuntime` owns *"what is true right now."* Replay owns *"what was true over time."* Different lifetimes; merging them couples a live editing hot path to a growing archive. |
| Part of **History** | **There is no History.** This is the option that *should* exist — see §3.5, where Replay creates it. |
| An **engine** | **No.** "Engine" in this codebase means a renderer or resolver (`SlideRenderer`, `SceneEngine`, `LayerEngine`, `ThemeEngine`, `ImageViewEngine`). Replay resolves nothing and renders nothing on its own. Calling it an engine would misfile it. |
| A **platform capability** | **Yes** — a thin service, sibling to `ProjectManager`. |

**Recommendation:** a new module, `js/storyReplay.js`, an IIFE attached to
`window` like every other module (`js/pageRuntime.js:147`), sitting
*adjacent* to `ProjectManager` because ProjectManager already owns the
serialize/persist lifecycle Replay observes.

```
  markDirty() ──500ms──▶ _writeStorage()
                              │
                              ├──▶ localStorage / CreatorProjectCache / Supabase   [existing]
                              │
                              └──▶ StoryReplay.observe(snapshot)                    [new]
                                        │
                                        ├──▶ ReplayStore (IndexedDB timeline)        [new]
                                        │
                                        └──▶ ReplayDiff (snapshot → semantic events) [new]
                                                        │
                                     ┌──────────────────┼──────────────────┐
                                     ▼                  ▼                  ▼
                              Timeline view      ReelComposer        Companion / insights
                              [new, thin]        [Already Exists]    [future consumers]
```

### 3.3 Why deriving beats capturing, on the merits

Not just because capture is hard to maintain — derivation is genuinely
better here:

1. **Completeness by construction.** A differ cannot miss a change that
   happened; a call site can.
2. **Retroactive improvement.** Diff quality can be improved *after the fact* —
   ship a rough differ, refine the narration next month, and every existing
   timeline immediately narrates better. Captured events are frozen at
   capture quality forever.
3. **No hot-path cost.** The differ never runs during a drag. It runs on
   demand, when someone actually views a Replay.
4. **Zero coupling.** No engine imports Replay. Deleting `js/storyReplay.js`
   leaves Studio byte-identical — matching the fail-open discipline every
   module in this codebase already follows
   (`try{ if(typeof X!=='undefined') ... }catch(e){}`).

**The trade-off, stated honestly:** a diff cannot recover *intent* or
*ordering within one debounce window*. If a child moves a sticker and
recolours it inside the same 500ms, the timeline records one composite change,
not two. §4.2 addresses this — and argues it is usually the *better*
granularity anyway.

### 3.4 Snapshot cadence

Every `_writeStorage()` would be too many (a drag produces one per 500ms).
Recommended policy, all enforced in the observer:

- **Coalesce** — never store a snapshot within N seconds of the last (start
  at 30s).
- **Deduplicate** — hash the shaped snapshot; identical → discard.
- **Force-keep milestones** — page added/removed, theme/World changed,
  Publish, session start/end are always kept regardless of the timer.
- **Cap and thin** — beyond a per-project ceiling (start at ~200 frames),
  thin the *middle* of the timeline, never the ends. A creative session's
  first and last states matter most; the 87th intermediate nudge does not.

**Classification: New Capability**, ~100 lines.

### 3.5 The argument that should decide this

**A snapshot timeline is version history. Version history is undo.**

`docs/COMPANION_INTELLIGENCE_ARCHITECTURE.md` §7.4 identified the absence of
global undo as the hard blocker on the Companion ever *performing* an action,
and offered two options: build a command/inverse registry (large), or
hand-author inverses per action (fragile).

**A snapshot timeline is a third answer, and a better one.** "Undo" becomes
*"restore the project to a previous snapshot"* — which `ProjectManager.
deserialize()` already implements, today, and which is already exercised on
every session restore and every "Load Cloud Version" freshness check
(`js/app.js`'s `checkStudioCloudFreshness`).

That yields, from one foundation:

- **Story Replay** (the product idea in this brief)
- **Global undo / "go back to yesterday"** (unblocking Companion Phase 4)
- **Crash and corruption recovery** (a real, non-theoretical risk this
  codebase has already been burned by — see the "Story-Forest Adventure"
  data-loss incident behind Cloud-Primary Project Storage)

**If Replay is judged only as a video feature, it is a nice-to-have. Judged
as version history, it is arguably overdue.** That reframing should carry more
weight than any argument in §6.

---

## 4. Replay readiness assessment

The brief asks for a specific classification per capability. Assessed against
what the platform *actually knows*, not what it could be made to know.

| # | Does the platform know… | Status | Evidence / what's needed |
|---|---|---|---|
| 1 | when a **scene/page is created** | **Needs Extension** | State knows page count and content (`AppState.slides`); nothing records *when*. Trivially derivable by diffing page arrays. |
| 2 | when a **scene changes** | **Needs Extension** | Full per-page state exists in `metadata`; change is derivable by diff. |
| 3 | when an **object is added** | **Needs Extension** | `SceneEngine.addSticker` mutates `metadata.stickers[]`; the render tree lists every object with a stable `id`. Diffing id-sets gives add/remove exactly. |
| 4 | when an **object moves** | **Needs Extension** | Positions live in `metadata.elementOverrides[id].position` / sticker `x,y`. Diffable, precisely. |
| 5 | when **colours change** | **Needs Extension** | `setContentOverride(...,'fillColor')`, `cardOverrides.background`, `themeOptions.colours`. All in state; diffable. |
| 6 | when **themes/Worlds change** | **Needs Extension** | `AppState.project.theme` / `.artworkTheme` are serialized (the latter added specifically to fix a real restore bug). A scalar diff. |
| 7 | when **assets are added** | **Already Exists (nearly)** | `AssetStore` mints a `vihu-asset:` ref per upload and queues it in `pendingUploads` with real timestamps. This is the **one** place the platform already has a genuine append-only event log. |
| 8 | when **pages are reordered** | **Needs Extension** | `PageOps.reorderPage` mutates array order; order is serialized. Diffable, though see §4.2. |
| 9 | when **publishing occurs** | **Needs Extension** | `PublishStudio._finalizePublish` is a real, single, named moment — but nothing persists that it happened. The smallest possible addition. |
| 10 | **who** the creator is | **Already Exists** | `MagicCard.getActive()`, and `owner_id` on every Supabase row. |
| 11 | **when** anything happened | **Already Exists** | `AppState.project.createdDate` / `.modifiedDate` are set on every `serialize()`. |
| 12 | how to **re-render any past state** | **Already Exists** | `SlideRenderer.buildPayload()` + `.render()`, deterministic. |
| 13 | how to **turn frames into video** | **Already Exists** | `ReelComposer.compose()`. |

**Summary: 5 Already Exists, 8 Needs Extension, 0 New Capability — at the
data level.** Every single "Needs Extension" is satisfied by *one diff engine*,
not by eight instrumentation projects. That is the finding that makes this
buildable.

The only genuinely **New Capability** items are the three modules in §3.2 —
observer, store, differ — plus a viewer.

### 4.1 Should the event model be extended?

The brief asks for *"the smallest extension necessary"* and warns against
duplicate event systems. Two, and only two, are recommended:

**(a) Milestone markers.** Some moments are semantically important but
invisible to a diff — Publish especially (nothing about the project state
changes when you publish). Recommendation: a single optional call,
`StoryReplay.mark('published')`, at the handful of already-named moments —
`PublishStudio._finalizePublish`, `CreationFlow._finish`, `MagicCard.claim`.
This deliberately mirrors `CompanionDirector.notify(event)`'s existing
seven-string vocabulary rather than inventing a second one.
**Classification: Needs Extension** (~5 one-line calls).

**(b) Nothing else.** In particular: do **not** add a payload to
`PageRuntime.notify()`. It is called from dozens of sites that would all need
to supply an accurate verb, reintroducing exactly the 47-call-site drift
problem §3.1 exists to avoid.

### 4.2 The granularity trade-off, stated plainly

Diffing across a coalescing window loses within-window ordering. Concretely:
move a sticker and change its colour within the same window, and Replay says
*"you changed the star"* rather than *"you moved the star, then coloured it."*

Two reasons this is acceptable, and arguably preferable:

1. **A per-action replay of a child's work is unwatchable.** Nobody wants 400
   frames of nudging. The interesting story is *"blank page → dragon appeared
   → sky turned purple → words arrived."* Coalescing is not a limitation
   here; it is editorial.
2. **It degrades gracefully.** Shorten the coalescing window and granularity
   increases, with no architectural change. If the coarse version proves too
   coarse, the fix is a constant.

Reordering is the one case where a naive diff reads poorly (*"page 3 became
page 1"* vs. five pages all "changing"). Recommendation: diff pages by
identity, not index — which needs a stable per-page id. Pages currently have
no id. **Classification: Needs Extension** — a small, additive `metadata.pageId`
minted on creation, backfilled on read exactly the way `_ensureHolderDefaults`
and `_ordered` already do elsewhere.

---

## 5. Rendering strategy

The brief asks which representation to replay. Assessed:

| Representation | Storage | Fidelity | Verdict |
|---|---|---|---|
| **Rendered frames** (pixels) | Enormous | Perfect but frozen | **No.** Cannot re-render at a new size, cannot re-theme, cannot narrate. This is a screen recorder wearing a hat. |
| **Commands** (do/undo pairs) | Tiny | Perfect | **No.** Requires the 47-call-site instrumentation §3.1 rejects, and every command needs a hand-written inverse. |
| **Semantic events only** | Tiny | Fragile | **No.** Events alone cannot reconstruct state unless *every* event is captured perfectly and replayed in order from the beginning. One missed event corrupts everything after it. |
| **Snapshots** | Moderate | Perfect | **Yes** — with §2.4's shaping and §3.4's cadence. |
| **Snapshots + derived events** | Moderate | Perfect + narratable | **Recommended.** |

**The recommendation is snapshots as the source of truth, with events derived
for narration and for the timeline UI.** Snapshots make every frame
independently renderable — no replay-from-genesis, no error accumulation, and
any frame is directly viewable by handing it to the renderer that already
exists.

### 5.1 The render path needs no new engine

```
snapshot ──▶ ProjectManager.deserialize-shaped slide object   [Already Exists]
          ──▶ SlideRenderer.buildPayload(slide)               [Already Exists]
          ──▶ SlideRenderer.render(payload)                   [Already Exists]
          ──▶ ThumbnailEngine-style offscreen canvas          [Already Exists]
          ──▶ ReelComposer.compose(frames)                    [Already Exists]
```

Every arrow already ships. `ReelComposer` in particular already sequences N
rendered pages into a video with transitions and audio — Replay hands it N
*versions of one page* instead of N *different pages*. Same function, different
input.

**This is the strongest evidence for the brief's own design principle that
Replay should "emerge naturally from the platform."** It largely already has.

One caveat worth surfacing: re-rendering a historical snapshot uses the
World's **current** compiled theme, not the one at capture time. If a Theme
Author republishes their World, old frames re-render with new chrome. Options:
accept it (frames stay "live"), or pin `themeId`+`version` per frame and
degrade honestly when unavailable. **Recommendation: accept it, and record the
theme id per frame** so a future version can do better without a data
migration.

---

## 6. Outputs — one timeline, many renderers

The brief asks whether Story Replay / Magic Strip / Story Journey / Behind The
Scenes / Publish animation / Social Reel are separate features.

**They are one dataset and six renderers.** Every one is a projection of the
same timeline, differing only in frame selection and presentation:

| Output | Frame selection | Presentation |
|---|---|---|
| Story Replay | all kept frames | video, time-ordered |
| Magic Strip | ~6 evenly spaced | static image grid |
| Story Journey | milestone frames only | scrollable narrated page |
| Behind The Scenes | first + last + biggest deltas | short video |
| Publish animation | last N frames | in-app Celebration flourish |
| Social Reel | curated subset | vertical video |

**Recommendation: build the timeline and exactly *one* renderer first.** Not
six. Each additional renderer is then genuinely small — and if the second one
turns out not to be worth building, that is useful information rather than
wasted work.

Which one first? **Not the reel.** Per §1, the reel is the output whose value
depends on sharing. The first renderer should be the one that proves intrinsic
value: a simple in-Studio timeline the child can scrub. If a child doesn't
enjoy watching their own story grow, no amount of video polish will save the
feature — and that is worth learning in Phase 1 rather than Phase 4.

---

## 7. Integration with other systems

| System | Integrate? | How |
|---|---|---|
| **Companion** | **Yes — highest value pairing** | The Companion's Context Reader (`docs/COMPANION_INTELLIGENCE_ARCHITECTURE.md` §5 Tier 3) currently sees only *now*. Replay gives it *before*: *"this page has changed more than any other"*, *"you've been on this for a while"*. This is the cheapest large upgrade to Companion awareness, and needs no AI. |
| **Publish** | **Yes, one-way only** | Publish emits a milestone marker (§4.1a) and may *consume* Replay to offer a Magic Strip. Replay must never become a Publish step — that would make it a chore. |
| **Global undo / recovery** | **Yes — arguably the primary integration** | §3.5. |
| **Creator insights / analytics** | **Not yet, and cautiously** | Technically trivial once the timeline exists, which is exactly why it needs an explicit product decision first (§9.1). |
| **Search** | **Later, cheaply** | Snapshots already contain story text and object labels; a future search indexes the *current* state, not the timeline. |
| **Classroom** | **Later** | A teacher-facing process portfolio is the strongest institutional case for Replay, but it needs a sharing/permission model that does not exist. Do not design for it now; do not preclude it either — owner-scoped RLS on the Replay table keeps the door open. |
| **World Builder** | **No** | Theme authoring is a different job with a different lifecycle. Explicitly out of scope. |

---

## 8. Performance and storage

### 8.1 Storage

A shaped snapshot (thumbnails dropped per §2.4, images as `vihu-asset:` refs
per §2.3) is **JSON at roughly the scale of the project's own current
autosave payload** — which the platform already writes every 500ms of activity
today, to three tiers, without difficulty.

The multiplier is frame count, and §3.4's cadence policy is what bounds it:
coalescing at 30s, deduplicating identical states, capping at ~200 frames, and
thinning the middle. A capped timeline has a **bounded** worst case, not a
growing one — which is the property that matters.

Additional protections, all following existing precedent:

- **Store in IndexedDB, never `localStorage`.** `CreatorProjectCache` already
  proves this pattern; `localStorage`'s small shared quota is exactly what
  caused the incidents behind AV-009 and Cloud-Primary Project Storage.
- **Local-first, cloud-optional.** Replay should be genuinely useful offline
  and sync only if there's an account, mirroring `CreatorProjectSync`.
- **Never store rendered frames.** Rendering is fast and deterministic; store
  the state, render on demand.

### 8.2 Runtime cost

- **Capture:** one shaped clone + one hash, on an already-debounced,
  already-off-the-hot-path write. Negligible.
- **Diff:** never runs during authoring — only when a Replay is viewed.
- **Render:** identical to the existing thumbnail/publish path.
- **Publish:** **zero.** Replay must add nothing to Publish. If a Magic Strip
  is offered, it is generated on request, after Publish completes.

The one real hazard is doing anything during a drag. The codebase has already
been bitten here — `js/contextPanel.js` debounces `ObjectStrip.refresh()`
specifically because it was costing ~49ms per drag tick at 25 objects. Replay
must inherit that lesson: **nothing on the hot path, ever.**

---

## 9. Risks — including reasons not to build this

### 9.1 It is a behavioural record of a child — **highest risk**

Everything else in this section is engineering. This one is not.

A timeline of how a child works, how long they took, what they changed their
mind about, is meaningfully different from the artwork they made. It should
be:

- **local-first and owner-scoped by default**, syncing only for a claimed
  Magic Card identity (mirroring `_scheduleCloudProjectSync`'s existing gate);
- **deletable** — a child or parent must be able to erase a Replay while
  keeping the project;
- **never framed as measurement.** *"You worked for 47 minutes and undid 12
  times"* is a surveillance product. *"Look how your story grew"* is a
  creative one. Same data, opposite products.

**Recommendation: an explicit, recorded Locked Product Decision in
`CLAUDE.md` before any Replay data leaves the device** — the same bar
`docs/COMPANION_INTELLIGENCE_ARCHITECTURE.md` §9.1 set for model calls.

### 9.2 The replay might simply be boring

Worth saying plainly: a three-page story assembled in ten minutes may produce
a Replay nobody wants to watch twice. The mitigation is §6's advice to build
the cheapest renderer first and *find out* — not to build six renderers on the
assumption that the content is inherently compelling.

This is the strongest argument for phasing, and the strongest argument against
starting with the reel.

### 9.3 Diff quality is the whole product

The timeline is only as good as the differ's ability to say *"you added a
dragon"* rather than *"metadata.stickers[3].x changed."* That is real,
ongoing, unglamorous work — and it is where the feature succeeds or fails.
Mitigation: reuse `FRIENDLY_TYPE` (`js/objectStrip.js:86`) and the render
tree's `label` field rather than inventing a third vocabulary.

### 9.4 Snapshot bloat via `metadata`

`metadata` is an open bag, and Studio has been adding to it steadily (V2
layers, place content, voice notes, doodle strokes). Doodle `paintStrokes` in
particular are point arrays that can be large. Mitigation: measure real
snapshot sizes in Phase 0 **before** committing to a cadence, and be willing
to exclude specific heavy sub-trees.

### 9.5 Coupling risk

Low, and structurally so: the observer is a one-line, `try`-wrapped hook in
`_writeStorage`. Nothing imports Replay. Deleting it changes nothing else.
This must remain true — the moment an engine depends on Replay, the
architecture has failed.

### 9.6 Theme drift on historical frames

Covered in §5.1. Accepted, with the theme id recorded so it can be improved
later.

### 9.7 The genuine architectural counter-argument

The honest case *against*: this adds a persistent, growing, privacy-sensitive
data structure to a platform that has repeatedly been burned by storage
problems (AV-009's silent quota failures, the "Story-Forest Adventure"
data-loss incident, the origin-wide `localStorage` ceiling). Adding another
writer to that same storage story deserves scepticism.

The counter to the counter: Phase 0 (§10) is a *measurement* phase that writes
nothing durable. It exists precisely so this concern is answered with numbers
rather than argued about.

---

## 10. Roadmap

Five phases. Each independently valuable. **Phases 0–2 involve no video, no
backend, no sharing, and no new privacy question at all.**

### Phase 0 — Measure (writes nothing durable)

Shape a snapshot (drop `thumbnail`, keep `vihu-asset:` refs), hash it, and
**log sizes only** across real authoring sessions. Answer with numbers: how
big is a frame, how often would one be kept, what does a real project's
timeline actually cost?

*Delivers:* the data to accept or kill this proposal.
*Risk:* none. *Classification: New Capability, ~50 lines.*

### Phase 1 — The timeline exists

`js/storyReplay.js` + an IndexedDB store, hooked into `_writeStorage()` with
§3.4's cadence. No UI. No diff. Just a durable, capped, deduplicated series of
states.

*Delivers:* **version history** — and with it the foundation for global undo
and real crash recovery (§3.5), independent of any Replay UI ever shipping.
*Risk:* low, and Phase 0 has already bounded it.

### Phase 2 — Scrub your own story

The differ (`snapshot → semantic events`) plus the simplest possible viewer:
a scrubber in Studio that re-renders past frames through the existing
`SlideRenderer` path, with a one-line narration per frame.

*Delivers:* the intrinsic-value test in §9.2, answered honestly.
*Risk:* low — read-only, on-demand, off the hot path.

### Phase 3 — One shareable output

Exactly **one** renderer beyond the scrubber, and the milestone markers of
§4.1a. Recommended: **Magic Strip** (a static image grid) over a video —
cheaper, instantly shareable, no `ReelComposer` dependency, no MP4/webm
question, and it makes a genuinely good fridge artefact.

*Delivers:* the first sharable outcome.
*Risk:* medium — gated on §9.1's product decision if it leaves the device.

### Phase 4 — Replay as platform infrastructure

Whichever of these Phases 1–3 have earned:
- **Global undo / restore-to-a-past-state**, unblocking Companion Phase 4;
- **Companion awareness of change over time** (§7);
- **Additional renderers** (reel, journey, behind-the-scenes) — each now small.

*Risk:* varies; each item independently gated.

### Explicitly out of scope

Analytics dashboards, teacher/classroom sharing, cross-project timelines,
collaborative or multi-author replay, and any authoring-side record/edit
controls.

---

## 11. Summary of recommendations

1. **Build it — but as version history that happens to produce a Replay**, not
   as a video feature that happens to store state. (§3.5)
2. **The hypothesis is half right.** VihuStudio has complete semantic *state*
   and essentially no record of *change*. `PageRuntime.notify()` takes zero
   arguments. (§0, §2.2)
3. **Snapshots, not events, as the source of truth** — with events *derived*
   by diffing. (§5)
4. **Observe at `_writeStorage()`, don't publish from 47 call sites.** The
   scattered `markDirty()` is the proof of what explicit publishing would
   become. (§3.1)
5. **Draft Asset Architecture already made this affordable** by turning images
   into references. (§2.3)
6. **Drop `thumbnail` from snapshots** — derived, regenerable, and the one real
   byte-cost in `serialize()`. (§2.4)
7. **The render half already ships**: `buildPayload` → `render` →
   `ThumbnailEngine`-style offscreen → `ReelComposer`. No new engine. (§5.1)
8. **Six proposed outputs are one dataset and six renderers.** Build one.
   Not the reel. (§6)
9. **Replay is not an engine and does not belong in Publish or Studio
   Runtime.** It is a thin service beside `ProjectManager`. (§3.2)
10. **A behavioural record of a child needs an explicit Locked Product
    Decision before it syncs anywhere.** (§9.1)
11. **Phase 0 writes nothing** and exists so this proposal can be killed with
    data rather than defended with argument. (§10)

---

*No implementation has begun. This document is a proposal awaiting approval
under `CLAUDE.md`'s standing rule that architecture changes require explicit
sign-off.*
