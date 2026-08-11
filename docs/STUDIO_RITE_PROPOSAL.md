# Studio Rite — Architecture & Implementation Plan

**Status: implemented and verified. All four phases (R1–R4) shipped.**

Studio Rite is approved product direction (Studio Rite Product Decision,
Decisions 1–10). This document realises it within the existing architecture,
preserves VihuPlanet canon, and keeps implementation impact minimal. The canon
itself is `docs/COMPANION_CANON.md` → **Canon 6**.

An earlier revision of this file recorded three open questions against frozen
canon. **All three are now answered** — Decision 5 (Lumo guides), Decision 7
(the Rite ends before Publish), and Decision 4's own word list (Traveller, not
Visitor). Part I records how each decision lands; Part II is the architecture.

> **Decision 7 has since been rewritten.** The Rite no longer stops short of
> Publish: it now ends with the child choosing to let their first story become
> part of VihuPlanet, and that choice opens the Creator Ceremony. The
> child-facing word "Publish" is gone from the Rite entirely
> (`docs/COMPANION_CANON.md` → Canon 7). The Publish architecture is
> unchanged — no service, module or API is renamed. Wherever this document
> still says "the Rite ends before Publish", read it as the superseded
> revision; §R4 below is the part that needs implementation work.

---

## Part I — Canon alignment

Every decision checked against frozen canon. **No decision is technically
impossible, and none contradicts frozen canon.** One carries a constraint
worth stating precisely (D6).

| Decision | Canon status |
|---|---|
| **D1** Studio Rite exists, mandatory, once | New capability. Recorded as Canon 6. No conflict |
| **D2** Answers *Where am I? · Who am I? · What do I do here?* | No conflict. Becomes the Rite's three-act structure (§2) |
| **D3** Teach through creation, never explain tools | No conflict. Constrains the step design (§5) |
| **D4** Establishes Traveller · Creator · Story · Companion | Resolves the vocabulary split — the platform says **Traveller**. `COMPANION_CANON.md` and `KID_JOURNEY.md` updated to match the product, the Gateway, the registry and the code |
| **D5** Lumo guides; Story Egg unchanged | **Canon 1 untouched.** Canon 2 gains one widened clause: Lumo appears at *the two thresholds* rather than only the Creator Ceremony |
| **D6** The Egg accompanies and reacts through animation | No conflict, with one real constraint — see below |
| **D7** *(rewritten)* Rite ends by sharing the first story with VihuPlanet | Canon 4 now reached **through** the Rite. Canon 7 added for the language. See "Decision 7, rewritten" below |
| **D8** Rite extends the Gateway, one continuous journey | No conflict, and it removes a change the earlier revision had proposed — see below |
| **D9** Existing Creators grandfathered by existing mechanisms | No conflict. `MagicCard.list().length > 0` already answers this |
| **D10** Companion assumes the Rite is complete | No conflict. Narrows `docs/COMPANION_V1_PROPOSAL.md` §3.2 scope only |

### D6 — the Egg's reaction vocabulary is exactly five poses

Decision 6 asks the Egg to react emotionally through animation. Canon 1 says
it *"never receives emotional poses such as `happy`/`sad`."* Both hold
simultaneously, and the resulting set is small and worth naming so the Rite is
authored against it rather than discovering it late:

| Canonical Traveller pose | Available to the Rite? |
|---|---|
| `idle` · `curious` · `thinking` · `excited` · `sleep` | **Yes** — real art shipped, all five |
| `hatching` | **No** — Creator Ceremony only (D7 forbids it outright) |
| `magic` | **No** — Ceremony's Glow beat; also no art yet |
| `hero` | No art yet (disclosed under Asset Registration) |

**Five real poses**, verified against `assets/story-egg/` on disk. That is
enough for a warm, reactive presence — `curious` when Lumo asks something,
`thinking` while the child works, `excited` when something lands, `idle`
between, `sleep` if they pause — and it needs no new art and no canon change.

### D8 — the Gateway needs no change at all

The earlier revision recommended editing the Gateway's opening line, because
`'Welcome, Traveller.'` names the child a Traveller without explaining it —
very likely the direct cause of the user-test finding.

**Decision 8 resolves this better, and without touching the Gateway.** The
Gateway's existing Lumo script (`js/gatewaySequence.js:163-166`) already runs:

```
'Welcome, Traveller.'           / "You've found the Gateway."
'I am Lumo.'                    / "It's wonderful to meet you."
'Guardian of Story Companions.' / 'I help stories come to life.'
'Every Creator begins here.'    / 'And every story begins with a spark of imagination.'
```

The word is not unexplained — it was merely *unfinished*, because the Gateway
handed straight off to Studio Home. With the Rite continuing immediately, in
the same voice, from the same guide, "Welcome, Traveller" becomes the moment
the word is **introduced** and the Rite becomes the moment it is **answered**.
One continuous journey, exactly as Decision 8 specifies.

**`js/gatewaySequence.js` is not modified.** Nor is the Gateway redesigned.

---

## Part II — Architecture

### 1. The smallest implementation

One new module and two changed lines.

| Item | File | Note |
|---|---|---|
| The Rite | `js/studioRite.js` *(new)* | Classic IIFE on `window`, one `<script>` tag in `index.html`'s existing block. No build step, no framework, no dependency |
| The gate | `js/app.js` | Two call sites wrapped |
| Canon | `docs/COMPANION_CANON.md` | Canon 6; done |

Reused rather than rebuilt:

| Need | Existing mechanism |
|---|---|
| Staging Lumo on a centred stage | `js/magicCardUI.js`'s Creator Ceremony stage — same pattern, already proven |
| Beat sequencing | `CompanionDirector.getCeremonySequence()`'s data-driven beat shape |
| Mounting Lumo / the Egg | `CompanionEngine` + `loadRegistry()` + `_resolveEntityIdByRole(list,'guardian')` |
| The Rite's project | `CreationFlow` / `ProjectManager`, normal path, fixed theme |
| Page and object work | `PageOps`, `SceneEngine`, `PageRuntime` — untouched |
| Creator detection | `MagicCard.list()` / `MagicCard.getActive()` |
| Traveller vs Creator guide | `CompanionDirector.detectMode()` — **already implements "the guide depends on lifecycle"** |

### 2. The Rite's structure — Decision 2's four questions

Decision 2 gives the Rite its acts, and Decision 3 gives each act its method:
the answer is never told, it is produced by making something.

| Act | Question | Answered by | Vocabulary introduced |
|---|---|---|---|
| I | **Where am I?** | Lumo continues straight out of the Gateway; the child sees the place they have arrived in | Story |
| II | **Who am I?** | Lumo defines Traveller and Creator by the act that separates them, then offers the child that act | Traveller, Creator |
| III | **What do I do here?** | Place someone, move them, size them — each framed as a decision about the story, never as an operation on an object | — |
| IV | **Why do stories matter?** | The child names what they made, and Lumo names what just happened | Companion (via the Egg's presence) |

The Rite ends when the tiny story is finished (D7): celebrated, kept, **not
published.** The full screenplay is `docs/STUDIO_RITE_SCRIPT.md`.

### 3. Entry flow

**Today**

```
preload gate → Traveller Gateway → _beginBoot() → restore-session? → Studio Home
```

**Proposed** — one insertion, marked `←`

```
preload gate
   → Traveller Gateway              (unchanged — D8)
   → StudioRite.gate()              ←  NEW
        ├── complete → straight through, zero delay
        └── incomplete → Lumo continues → real canvas → tiny story → unlock
   → _beginBoot()
   → Studio Home
```

For every existing Creator and every returning user, this adds **one
synchronous flag check** to boot and nothing else.

### 4. Routing changes

Two call sites in `js/app.js`, in `_runBootstrap()` and `_afterGateway()`:

```js
// today
GatewaySequence.begin(_beginBoot);

// proposed
GatewaySequence.begin(function(){ StudioRite.gate(_beginBoot); });
```

`StudioRite.gate(next)` — if complete, call `next()` immediately; otherwise run
the Rite and call `next()` when it finishes.

Three properties:

- **`HOME_RETURN_FLAG` already works.** A Home-button reload skips the Gateway
  today and will skip the Rite the same way — correct, since a mid-session
  return is not a first arrival.
- **Fail-open, per platform convention.** A missing or broken
  `js/studioRite.js` falls straight through to `_beginBoot()`, guarded with
  the codebase's standard `try{ if(typeof StudioRite!=='undefined') }`, exactly
  as `GatewaySequence` already is.
- **The Rite is not skippable.** The Gateway wires `onSkipClick()` so a tap
  advances; the Rite deliberately does not, because D1 makes it mandatory.
  A disclosed, intentional difference between two adjacent boot slots — not an
  oversight.

### 5. Lifecycle changes

**None to any existing lifecycle.** That is the design's whole point.

| Lifecycle | Change |
|---|---|
| Authentication / identity | None. Gateway Scene 3 and `MagicCardUI.beginCreatorSignature()` untouched |
| Story Egg | None. Silent, Traveller-only, still vanishes at the Ceremony (D5) |
| Creator | None. `MagicCard.claim()` still happens at the Awakening |
| First publish | None. `shouldOfferAwakening()` still fires on the first real publish (D7) |
| Companion init | None to `CompanionDirector.init()`. The Rite stages Lumo transiently and tears him down before `_beginBoot()` runs, so Studio still mounts the right persistent companion through the existing `detectMode()` path |
| Gateway | None (D8) |

One **additive** state: Rite completion (§7).

### 6. Guide responsibilities during the Rite

| User | Guide | Story Egg |
|---|---|---|
| First-time Traveller | **Lumo**, continuing from the Gateway | Present, accompanying, animation only — five poses (§D6) |
| Returning Creator | Never sees the Rite (D9) | — |

**Lumo is torn down when the Rite ends.** Canon 2 keeps him out of the ongoing
widget; after the Rite, `_beginBoot()`'s existing `CompanionDirector.init()`
mounts the Story Egg exactly as it does today.

Decision 6 is a real design requirement, not decoration: the Rite must
*strengthen* the child's bond with the Egg. The Egg is the constant presence
across the whole Rite, reacting to the child's own actions — Lumo speaks, but
the Egg is the one who is *with them*.

### 7. Unlock mechanism

```js
localStorage['vihu.studioRite.v1'] = '1'
```

`StudioRite.isComplete()` returns true if **either**:

1. the flag is set, **or**
2. `MagicCard.list().length > 0` — the grandfather clause.

Written only when the Rite genuinely finishes. There is no skip, so there is
no path that writes it otherwise.

### 8. Migration for existing Creators (D9)

**No migration system. No backfill. No schema change.** Decision 9 asks for
existing mechanisms, and one already answers the question exactly:
`MagicCard.list().length > 0` is already true for every existing Creator and
already false for every Traveller, and it is already loaded at boot.

| Existing user | Experience |
|---|---|
| Creator with a claimed card | Unchanged. Never sees the Rite |
| Traveller with local projects, never published | Sees the Rite once; **their projects are untouched** |
| New user | Gateway → Rite → Studio |

The middle row is the only behaviour change, and it is intended: someone who
has not published has not been through the Ceremony and does not yet hold the
vocabulary.

**The Rite's project is kept, not discarded** — a normal project, named by the
child in Act III, appearing in My Projects like any other. D3 says the child
should finish having successfully created something; keeping it is what makes
that true.

### 9. Implementation roadmap

**R1 — The gate and the unlock.**
`js/studioRite.js` with `gate()` / `isComplete()` / `markComplete()`, the two
`js/app.js` call sites, the grandfather clause. The Rite itself is a stub that
completes immediately.
*Ships:* nothing visible — deliberately. Proves every existing user's boot is
unchanged before any experience is built on it.
*Risk:* low, fully reversible.

**R2 — Act I: Where am I?**
Lumo staged on the ceremony-pattern stage, continuing straight out of the
Gateway, with the Egg present and reacting. Ends by handing off to Studio.
*Ships:* a continuous, coherent arrival. Addresses the user-test finding on
its own, before any creation step exists.
*Risk:* low — additive, no editor involvement.

**R3 — Acts II & III: Who am I? / What do I do here?**
The Rite creates a real project on a fixed theme; the child makes a page, adds
a character, moves it, sizes it, names it. Uses `PageOps`, `SceneEngine` and
`PageRuntime` as-is. No menu tours, no tool explanations (D3) — Lumo asks for
something and the making teaches it.
*Ships:* teach-through-creation for real.
*Risk:* medium — the only milestone touching the editor. The step gating must
not fight existing selection or Context Panel behaviour.

**R4 — Completion and unlock.**
The tiny story is finished and celebrated, **not published** (D7); the flag is
written; Studio Home unlocks; the project is kept.
*Ships:* the full Rite.
*Risk:* low.

### 10. Risks

| Risk | Mitigation |
|---|---|
| **Time to first creation.** Gateway + Rite back to back could be long for a child | Acts are short and creation starts in Act II; R2 ships separately so the length is measurable before R3 lands |
| **Mandatory + unskippable** is a strong constraint if any step can wedge | Every step needs a guaranteed-completable path; the gate must fail open on any error rather than trap a child before Studio |
| **The Rite's project polluting My Projects** | It is a real project the child made and named — treat it as one, not as a special-cased artifact |
| **Clearing storage repeats the Rite for a Traveller** | Accepted; identical to how local projects already behave. Creators are protected by the Magic Card |
| **Lumo leaking into Studio** | Explicit teardown before `_beginBoot()`; Canon 2 forbids the standing widget |
| **Drift from Companion v1** | D10 narrows `docs/COMPANION_V1_PROPOSAL.md` §3.2 only; ship the Rite first if both are queued |

---

## Effects on adjacent initiatives

**Companion v1** — scope reduction, not an architecture change.
`docs/COMPANION_V1_PROPOSAL.md` stands as written; only `vocabulary.json` gets
smaller, since the Rite establishes Traveller, Creator, Story and Companion
(D10).

**Motion Publishing** — no effect, confirmed rather than assumed. The Rite
touches boot routing and the editor, and never reaches `js/publishStudio.js`,
Magic Publish, or any Publish stage. That is not incidental; it is D7.

**Story Journey** — nothing here builds toward it. No recording, no timeline,
no replay, no storage model, no event model.

---

## Canon updates applied

| Document | Change |
|---|---|
| `docs/COMPANION_CANON.md` → Canon 6 | Studio Rite recorded, with the three questions answered |
| `docs/COMPANION_CANON.md` → Canon 2 | Lumo appears at **the two thresholds**; set closed at two |
| `docs/COMPANION_CANON.md` → Canon 4 | "First" means first *real* Publish; the Rite can never consume it |
| `docs/COMPANION_CANON.md`, `docs/KID_JOURNEY.md` | "Visitor" → "Traveller"; `role:"visitor"` corrected to `role:"traveller"` to match the registry |
| `docs/KID_JOURNEY.md` | New Stage 0 — Studio Rite, marked not-yet-implemented |
| `CLAUDE.md` | Locked Product Decision 8 |

**Canon 1 (Story Egg) and Canon 3 (Story Companions) were not touched.**

---

---

# Part IV — The Nudge (guidance layer)

**Status: designed, not built.** Added after testing raised the question the
Rite could not answer on its own: *when Lumo says "what colour is your sky?",
are we assuming a child can find the Background control?*

We were. That was wrong.

## The rule

Decision 3 forbids explaining tools, and it should. But two different things
had been collapsed into one prohibition:

| | Allowed? |
|---|---|
| **Explaining a tool** — "this is the size control, drag the corner" | **No.** Decision 3 stands |
| **Showing where a tool is** — the control quietly lights up | **Yes.** This is direction, not explanation |

**Lumo never names a control. The interface shows where it is. The child
learns what it does by using it.** Familiarity — *what is where, and how it is
used* — is the Rite's stated purpose, and it cannot be reached by narrative
framing alone.

## Four stages, words last

1. **The glow** — the real control gets a soft ring. If it is nested (inside
   *Add Something*, or requiring the object to be selected first), each step
   lights in turn as the child advances.
2. **The pulse** — no action for a few seconds: the glow strengthens.
3. **Lumo looks** — a light travels from Lumo to the control. He is a character
   standing on the screen; him turning toward something is direction that costs
   no words and breaks no rule.
4. **Words** — last resort, once, still in character and still never naming the
   control: *"It's over on the right, near the Egg."*

## The fading curve — this is what builds confidence

The nudge is **slower on every page**, so the child takes over by degrees:

| Page | Role | Glow appears |
|---|---|---|
| 1 | discover | **immediately**, every time |
| 2 | apply | after **~4s** — a beat to try first |
| 3 | own | after **~12s** — the child leads; the net is still there |

This makes the graduation real rather than rhetorical, and it costs nothing
when it is not needed: a confident child never sees a hint at all.

## The visibility contract — measured, not assumed

**A nudge that points at something off-screen is worse than no nudge.** In band
mode the Rite's own dialogue covers the bottom of the viewport, and the
measurement is not marginal:

| Element | Rect (1343×800 viewport) | |
|---|---|---|
| Rite band | `542 → 800` | **258px — a third of the screen** |
| `.context-set-tiles` (holds the Background tile) | `680 → 734` | **fully occluded** |
| `.object-strip` | `651 → 788` | **fully occluded** |
| `.context-zone-personalize` | `249 → 751` | bottom third occluded |
| `#bookTitle` | `19 → 46` | safe |

The control page 1 asks for **first** is currently behind the Rite's own band.

**Therefore, before any glow is applied, the nudge must:**

1. Resolve the target and compute the **safe area** — the viewport minus the
   band's own rect, read live rather than hardcoded.
2. If the target is not fully inside it, **scroll its scrollable ancestor**
   until it is.
3. Re-measure. If it still cannot be brought into the safe area, **shrink the
   band** for the duration of the beat.
4. Only then glow. If the target cannot be made visible at all, **do not point
   at it** — fall straight to stage 4 (words), which is always visible.

The band should also simply be **smaller in band mode**. 258px of a 800px
screen is more than a dialogue strip needs, and shrinking it reduces how often
steps 2–3 have to fire.

## Built — and what it actually points at

Stages 1, 2 and 4 are implemented (`js/studioRite.js`). **Stage 3, "Lumo
looks", is not built.**

The control map was wrong twice on first attempt, and both errors are the
reason the map needs live verification rather than authoring-by-inspection:

| Target | First attempt | Reality |
|---|---|---|
| Add Something | the whole `.context-add-accordion` | **381px tall** — cannot fit above the band, so the contract correctly refused to point at all. Now the `.context-add-card` for Emojis, or the trigger while it is shut |
| Resize | a row labelled `Width` | the sticker's row is labelled **`Size`** |
| Move | `.nudge-pad` | does not exist for a sticker |

Measured, with a sticker selected at 1343×800 — both rows do belong to the
sticker's own **"✨Your Sticker"** section, so the map is aimed correctly:

| Row | Rect | Pointable? |
|---|---|---|
| `Size260px` | top `826` | yes — off-screen but scrollable into the safe area |
| `Move Left ↔ Right` | `0 × 0` | **no** — hidden inside a collapsed section |
| Object Strip | `651 → 788` | **no** — structurally below the band |

So today: **the first making glows** (the Emojis card, verified inside the safe
area), **resize can glow** once scrolled, and **move falls through to words** —
because there is nothing on screen to ring until the child opens a section, and
a page is a canvas so a sticker has no element of its own. That is the contract
working, not failing.

Because of that, the escalation was changed: if nothing can be shown after
~3.5s, the spoken hint arrives **immediately** rather than waiting out the full
timer. A child staring at nothing is the failure this layer exists to prevent.
The hint is state-aware — *"Tap them first"* before a selection, *"Drag them
where you want"* after.

**Two follow-ups worth doing** when the three-page story is built: give the
sticker's collapsed spatial section a two-step path (point at the section
header, then the row inside it, exactly as Add Something now does), and shrink
the band's resting height so fewer targets need rescuing at all.

## The Rite's page is one sheet of paper

A blank page is not blank. It carries an empty **Artwork Place** — a large white
rectangle over most of the page — and the child's **Background** colour paints
only the paper *around* it. Measured, not assumed: with the background set to
`#7a1030`, the outer card sampled `#7a1030` and the centre of the page sampled
`#ffffff`. So *"Make the sky dark"* left the biggest thing on the page white,
and the Object Strip offered three objects — **Background · Artwork Place ·
Star** — when Lumo only ever talks about two.

The page model (picture card + caption) and the story's model (one sheet you
draw a sky on) genuinely conflict, and the story cannot win that argument by
rewording.

**Resolved: Rite pages declare that they have no picture area.** A per-page
`metadata.noPlace` flag, set once when the Rite opens the Studio and carried to
pages 2 and 3 by duplication. The renderer already had this exact concept — a
Scene converged with zero Places draws no picture area at all — so the flag
joins that existing branch rather than adding a second way to mean the same
thing; `getPlaceRects()` returns none, so the Object Strip drops the Artwork
Place card and hit-testing has nothing to find.

The flag is absent on every page that exists today, and a control run confirms
a page without it renders exactly as before, in the editor *and* through
`buildPayload()` — so Publish shows what the centre pane showed (Creator Rule 5),
and no saved project changes. Verified: editor and publish both sample the
child's own colour at the centre and the corner; the flag survives
`serialize()` and `duplicatePage()`; both goldenBuild suites pass.

## Where the Rite speaks from: the left rail

**Decided: the dock.** The conversation leaves the bottom of the screen entirely
and stands in the column under the page thumbnails — the one part of the editor
nothing else ever claims. Measured at 1360×596, the child's page goes from
**265px to 368px tall, a 39% larger canvas**, and at 1343×800 from 430 to 572.

The column reads top to bottom: the mission (a standing note, which finally gets
to wrap instead of being clipped to one ellipsised line), then Lumo and the Egg
at a size worth looking at, then what he just said, then the way on. The panel
is as tall as what has actually been said rather than as tall as the rail, and
the conversation scrolls inside it once it reaches the ceiling.

Geometry is measured, never assumed: `_placeDock()` reads the sidebar's real
rect and the bottom of the page list, because the sidebar's width changes at
five breakpoints and the thumbnails grow as the story does. It re-places on
resize and on every page change.

**The bottom band survives as the fallback.** Below 768px the workspace
collapses to a single column and the sidebar becomes a strip across the top —
there is no rail to dock into, so `.studio-rite-rail` is simply not applied and
every band rule still governs.

Getting that test right mattered more than it looks. Checking the sidebar's
*size* is not enough to tell a left column from a collapsed strip: at a 700px
viewport the collapsed sidebar measures 668px wide, comfortably past any
threshold, and docking there put the conversation directly over the child's
page — caught by an overlap assertion, not by eye. The real test is whether the
sidebar's right edge clears the preview area's left edge, which is the only
thing that actually answers the question being asked.

**One thing the dock gives back for free.** With nothing occluding the bottom of
the screen, the nudge's safe area is the whole viewport again — so the Object
Strip, which the visibility contract had always (correctly) refused to point at
because it structurally could not clear the band, is now a target the glow can
actually paint.

## Where the band lived, and what the Studio hides while it is there

Two separate failures, spotted together on a 1359×581 window.

**The mission and the conversation were painted on top of each other.** Both
were placed in one grid cell (`grid-area:body`), one aligned to the start and
one to the end — which reads as two stacked rows only while the cell is tall
enough for both. In the short band it is not, and the two texts overlapped on
screen; measured, both began at `y=358`. The band is now genuinely two rows, so
this cannot recur at any height.

**The band floated over the child's own page**, covering the bottom 83px of it.
Lifting it clear of the Object Strip was never enough, because the page and the
band were both competing for the same space. The band now publishes its real
height as `--rite-band-h` (kept honest by a `ResizeObserver`, since the band
grows and shrinks as lines accumulate), and the preview column gives up exactly
that much room. The page shrinks to fit *above* the band instead of hiding
behind it.

### The Rite quiets the Studio

*"in the beginning we can hide the non essentials if space crunch is the
issue."* Every rule is scoped to `body.studio-rite-running`, so it lasts exactly
as long as the Rite does — verified after a full run: body class back to
`light-theme`, all eight Add cards shown, every button back, preview margin back
to `12px`, `--rite-band-h` cleared.

| Hidden during the Rite | Why |
|---|---|
| Traveller save notice | 123px of the corner, and its call to action is **Publish Now** — a word Canon 7 says a child is never shown in the Rite |
| Open · Save As · Publish · Home · autosave · theme · Magic Card badge | A child on their first story has nothing to open and nothing to save as |
| Build/release footer | Never child-facing |
| **+ Add Page** | The story teaches *copying* a page; a blank one has no star on it. The ⋮ beside it stays |
| Doodle · Photo · Family Photos · From This World · Voice | Real capabilities they meet the moment the Rite ends — during "add a star" they are five more decisions |
| Object Strip legend | 25px of a sentence written for a grown-up, while Lumo is already saying what to do |

Deliberately still visible: the page thumbnails and their ⋮, Emojis · Shapes ·
Text, the Background tile, the Object Strip cards, and `#bookTitle`.

Nothing is disabled and nothing is removed from the DOM — this is the same rule
the workspace already follows: *the editor should only carry controls that
improve the active workflow*.

## Exploring is allowed — the path is offered, never enforced

The question that follows the glow is what happens when the child taps
something *else*. Two answers were on the table: **stop them** (block the tap,
or say the button was wrong), or **let them explore and keep them on the path**.

**The second, and not as a preference.** Everything reachable in the Studio
during the Rite is a real, safe, undoable creative act — there is nothing to
protect a child from. The Rite's whole premise is that it teaches *through
creation*, and Decision 3 forbids explaining controls; "that was the wrong
button" is both a correction and an explanation, and it would be the first
thing the Studio ever said to a child.

So nothing is ever disabled and nothing is ever refused. Instead:

1. **The glow waits.** It stays on the real control and re-aims itself as the
   child works, so the way back is always lit.
2. **The instruction is offered again, once.** When the child changes something
   that is not what the beat is waiting for, the quiet row under the
   conversation says the beat's own instruction back to them — *"Nice. Now make
   the sky dark."* No new idea, no new vocabulary, no correction. At most once
   every six seconds, and never in the first three, so a child mid-action is
   never talked over.
3. **The beat still waits indefinitely.** Exploration costs them nothing.

The same quiet row carries both this and the escalation hint, so there is only
ever one piece of guidance on screen; a redirect answers something the child
just did, so it outranks the general "here is where that lives" for a few
seconds.

**No dead ends.** A child who explores by *deleting* what they made used to
strand the move / resize / spin beats — nothing to point at, and a condition
that could never be met, on a Rite there is no way out of. On an empty page
those beats now point at *Add Something* and say *"Add something to your page
first."*, and complete properly once there is something to move.

## The control map

A small table of `capability → DOM selector`: the Background tile, the *Add
Something* accordion, the Move & Spin dial, the page thumbnail's **⋮ → Duplicate
Page**, and `#bookTitle`.

**Copying a page is a two-step walk**, and neither step is a button sitting in
the open: the ⋮ on the child's own page thumbnail opens the page menu, and
*Duplicate Page* lives inside it. The nudge lights the ⋮ first, then the menu
item the moment the menu is up — the same "the target changes as they work"
shape the sticker beats already use. Verified in a full run: `.thumb-menu-btn`
rings and escalates, then `[data-action="duplicate"]` rings once the menu opens.

**This is not new architecture.** `docs/COMPANION_V1_PROPOSAL.md` §3.2 already
specifies exactly this as the `surface` pointer carried by every knowledge
entry; the Rite builds it earlier and the Companion later shares it.

**Its one real risk is staleness** — if a control moves and the map is not
updated, the Rite points at nothing, which is worse than not pointing. Same
mitigation as the Companion corpus: a verification pass that resolves every
selector against a live DOM and fails loudly. Given the Rite is mandatory, this
check is not optional.

---

# Part III — Phase-by-phase technical design

**Script:** `docs/STUDIO_RITE_SCRIPT.md` — 18 Lumo lines, 5 blocking child
actions, 5 Egg poses. The phases below realise it.

Each phase names **exactly which files to open and which anchors to read**, so
it can be implemented in a fresh session without re-exploring the codebase.
Anything not listed under "Open" should not be read.

## The content dependency, and how it is removed

The Rite needs the child to make something real. Two facts decide how:

1. **Studio ships with zero built-in Worlds** — Repository-only
   (`js/themeRegistry.js`'s own disclosure; also noted in
   `docs/KID_JOURNEY.md`). A Rite that required a World would fail on a first
   launch with no network — on a **mandatory gate that blocks the Studio.**
   That would be a hard failure, not a degraded experience.
2. **`CREATION_TYPES` already has `{id:'blank', blank:true}`** —
   *"A blank page — no world, just your ideas"*, which
   `js/creationFlow.js:82-94` documents as *"the ONE branch on Screen 1: the
   card skips Screen 2 entirely and lands straight in the editor on a page
   with no World at all."*

**The Rite uses the `blank` path.** No World, no Repository, no network, no new
content pipeline — and it is the existing, shipped code path, not a special
case built for the Rite. The character in Act III is an emoji-glyph sticker
from `StickerLibrary`'s built-in `characters` category, which is local and
offline too.

This removes the only hard dependency the Rite had.

## Phase R1 — Gate and unlock

*Ships: nothing visible. Proves boot is unchanged before anything is built on
it.*

**Create** `js/studioRite.js` — IIFE on `window`, mirroring
`js/pageRuntime.js`'s module shape.

```js
StudioRite.isComplete()   // localStorage flag  ||  MagicCard.list().length>0
StudioRite.markComplete() // writes the flag, once, only on real completion
StudioRite.gate(next)     // complete ? next() : run(next)
```

**Edit** `js/app.js` — two call sites, both wrapping the same expression:

| Anchor | Change |
|---|---|
| `_runBootstrap()`, the `GatewaySequence.begin(_beginBoot)` call | wrap: `GatewaySequence.begin(function(){ StudioRite.gate(_beginBoot); })` |
| `_afterGateway()`, both `_beginBoot()` exits | wrap the same way, so a broken Gateway still reaches the Rite |

**Edit** `index.html` — one `<script>` tag before `js/app.js`, plus the `?v=`
bump across the block (currently `0363`).

**Open:** `js/app.js` `_runBootstrap` / `_afterGateway` only ·
`js/pageRuntime.js` (147 lines, the module-shape reference) · `index.html`
script block.
**Do not open:** the editor, renderer, Companion, or Gateway internals.

**Verify:** with the stub completing immediately, an existing Creator's boot is
byte-for-byte unchanged; `HOME_RETURN_FLAG` still skips; deleting
`js/studioRite.js` still boots.

**Risk:** low, fully reversible.

## Phase R2 — Act I and the Lumo stage

*Ships: a continuous arrival. Addresses the user-test finding on its own.*

**Reuse, do not rebuild:** the Creator Ceremony's centred stage in
`js/magicCardUI.js`, and the data-driven beat shape of
`CompanionDirector.getCeremonySequence()`. The Rite's script becomes the same
kind of beat array — data, not control flow.

Mount Lumo via `CompanionEngine` + `loadRegistry()` +
`_resolveEntityIdByRole(list,'guardian')`. Mount the Egg alongside, pose-only.
**Tear Lumo down before calling `next()`** — Canon 2 keeps him out of the
standing widget.

**Open:** `js/companionDirector.js` `getCeremonySequence` / `_mountEntity` /
`_resolveEntityIdByRole` · `js/magicCardUI.js` ceremony-stage section only ·
`js/companionEngine.js` public API (`setState`/`speak`/`load`/`destroy`).

**Verify:** Gateway → Rite reads as one journey with no seam; Lumo is gone and
the Egg is mounted correctly by the time Studio Home renders.

**Risk:** low — additive, no editor involvement.

## Phase R3 — Acts II and III

*Ships: teach-through-creation.*

Create the project through the existing `blank` path
(`CreationFlow` / `ProjectManager`), then gate five beats on real editor
events. The Rite **observes**; it never drives the editor.

| Beat | Waits for | Existing mechanism |
|---|---|---|
| begins | project created | `CreationFlow` |
| place character | a sticker exists on the page | `SceneEngine.addSticker` → `PageRuntime.notify()` |
| move | its position changed | `SceneEngine.setPosition` → same |
| resize | its size changed | `SceneEngine.setSize` → same |

`PageRuntime.notify()` already fires on every mutation and already dispatches
to five subscribers (`js/pageRuntime.js:125-132`). The Rite becomes a sixth.
**No polling, no new event model, no editor changes.**

**Open:** `js/pageRuntime.js` (whole, 147 lines) · `js/sceneEngine.js`
`addSticker`/`setPosition`/`setSize` signatures only · `js/creationFlow.js`
`CREATION_TYPES` + `start()` only.
**Do not open:** `renderer/slideRenderer.js`, `js/cardDesigner.js`,
`js/contextPanel.js` — the Rite reads outcomes, not rendering.

**Verify:** every beat completes by a child's own action; nothing auto-advances;
pausing mid-beat drifts the Egg to `sleep` and recovers.

**Risk:** medium — the only phase touching editor flow. The gating must not
fight existing selection or Context Panel behaviour, which is why it observes
`notify()` rather than intercepting input.

## Phase R4 — Act IV, completion, unlock

*Ships: the full Rite.*

The title beat writes `#bookTitle` — the existing, visible project-name field
(`CLAUDE.md` → Locked Product Decision 1, as amended). Completion calls
`markComplete()`, tears down the stage, and hands to `_beginBoot()`. The
project is **kept** as a normal project.

**Never call:** `PublishStudio`, `MagicCard.claim()`,
`MagicCard.shouldOfferAwakening()`, or any `hatching`/`magic` pose. D7 is
enforced by never importing the path, not by a runtime check.

**Open:** `js/studioRite.js` (own) · the `#bookTitle` binding in `js/app.js`.

**Verify:** the flag is written only on genuine completion; a second launch
goes straight to Studio Home; `shouldOfferAwakening()` is still untouched and
fires on the child's first real publish afterwards.

**Risk:** low.

## Milestone boundaries

R1 ↔ R2 is the important one: R1 changes routing with no experience attached,
so a regression there is unambiguous. R2 ships a complete narrative with no
editor coupling. R3 is the only phase that touches creation flow. R4 is
closure. **Each phase is independently reviewable and independently
revertable.**

## Keeping implementation cheap

- The script is **data** (a beat array), so R2–R4 add lines to a JSON-shaped
  constant rather than logic.
- The Rite **observes `PageRuntime.notify()`**; it never re-implements
  selection, hit-testing or rendering, so no large file needs to be read.
- The three largest files in the repo — `renderer/slideRenderer.js` (344 KB),
  `js/cardDesigner.js` (194 KB), `js/contextPanel.js` (172 KB) — are **not
  touched in any phase.**

---

---

## Build status — all four phases shipped

| Phase | Status | Commit |
|---|---|---|
| R1 — gate and unlock | shipped | boot routing, grandfather clause |
| R2 — Act I and the Lumo stage | shipped | full-screen stage, 3 beats |
| R3 — Acts II & III | shipped | band mode, real editor, `await` beats |
| R4 — Act IV, completion, unlock | shipped | title beat, flag written once |

**Two seams were added to existing modules**, both additive, neither changing
any existing call site's behaviour:

- `PageRuntime.observe(fn)` — the Rite is the sixth subscriber, as designed.
- `CreationFlow.startBlank()` — exposes the existing `_finishBlank()` the
  "Start Something New" card already calls, rather than duplicating it.

**Verified end to end in headless Chromium**, driving the whole Rite: all 18
beats in order, each `await` beat rendering its prompt and then resolving on a
real mutation, completion written exactly once, and a second launch skipping
the Rite entirely. `MagicCard.shouldOfferAwakening()` is **still true after the
Rite** — the Creator Ceremony was not consumed (D7). The standing widget
afterwards is `assets/story-egg/*`, never Lumo (Canon 2).

**One real bug was caught by that verification and fixed before shipping.**
`js/state.js` seeds `bookTitle:'My Adventure'` and `#bookTitle` ships it as a
value attribute, so a project is born already named. The first implementation
tested "the story has a name", which was true before the child touched
anything — Act IV's *"What is this one called?"* was being skipped every single
run, silently deleting the emotional peak of the Rite. The condition is now
"the child changed it from what it said when the beat began, and left something
behind."*
